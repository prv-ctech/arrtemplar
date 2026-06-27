import { basename, extname, join } from "node:path";
import {
  APP_LOG_CATEGORY,
  type ApiErrorResponse,
  HELP_TICKET_ACCEPTED_UPLOAD_MIME_TYPES,
  HELP_TICKET_ID_PATTERN,
  HELP_TICKET_IMAGE_MIME_TYPES,
  HELP_TICKET_LIMITS,
  HELP_TICKET_VIDEO_MIME_TYPES,
  type HelpTicketAcceptedUploadMimeType,
  type HelpTicketMediaKind,
} from "@arrtemplar/shared";
import { getLogger } from "@logtape/logtape";
import { fileTypeFromBuffer } from "file-type";
import { resolveWorkspacePath } from "../config/database-paths";
import type {
  HelpTicketScanMetadata,
  HelpTicketScannerService,
  ScanHelpAttachmentResult,
} from "./scanner.service";

const logger = getLogger([APP_LOG_CATEGORY, "help", "attachments"]);
const allowedUploadMimeTypes = new Set<string>(HELP_TICKET_ACCEPTED_UPLOAD_MIME_TYPES);
const imageMimeTypes = new Set<string>(HELP_TICKET_IMAGE_MIME_TYPES);
const videoMimeTypes = new Set<string>(HELP_TICKET_VIDEO_MIME_TYPES);
const outputImageMimeType = "image/webp" satisfies HelpTicketAcceptedUploadMimeType;

export type PreparedHelpTicketAttachment = HelpTicketScanMetadata & {
  bytes: Uint8Array;
  height: number | null;
  id: string;
  mediaKind: HelpTicketMediaKind;
  mimeType: HelpTicketAcceptedUploadMimeType;
  originalFileName: string;
  sha256: string;
  sizeBytes: number;
  storedFileName: string;
  storedSizeBytes: number;
  width: number | null;
};

export type HelpTicketAttachmentServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 422 | 500 | 503; body: ApiErrorResponse };

export class HelpTicketAttachmentService {
  private readonly resolvedStorageRoot: string;
  private readonly resolvedTemporaryRoot: string;

  constructor(
    storageRoot: string,
    private readonly scannerService: HelpTicketScannerService,
  ) {
    this.resolvedStorageRoot = resolveWorkspacePath(storageRoot);
    this.resolvedTemporaryRoot = join(this.resolvedStorageRoot, ".tmp");
  }

  async prepareAttachments(input: {
    attachments: File[];
    userId: string;
  }): Promise<HelpTicketAttachmentServiceResult<PreparedHelpTicketAttachment[]>> {
    if (input.attachments.length > HELP_TICKET_LIMITS.maxAttachmentCount) {
      return {
        ok: false,
        status: 422,
        body: helpAttachmentRejectedError("attachments", "Too many attachments."),
      };
    }

    const prepared: PreparedHelpTicketAttachment[] = [];

    for (const attachment of input.attachments) {
      const preparedAttachment = await this.prepareSingleAttachment({
        attachment,
        userId: input.userId,
      });

      if (!preparedAttachment.ok) {
        return preparedAttachment;
      }

      prepared.push(preparedAttachment.value);
    }

    return { ok: true, value: prepared };
  }

  async storePreparedAttachments(input: {
    attachments: PreparedHelpTicketAttachment[];
    ticketId: string;
  }): Promise<HelpTicketAttachmentServiceResult<void>> {
    if (!HELP_TICKET_ID_PATTERN.test(input.ticketId)) {
      return {
        ok: false,
        status: 500,
        body: storeAttachmentFailedError(),
      };
    }

    const directoryPath = this.resolveTicketDirectoryPath(input.ticketId);

    try {
      await ensureDirectory(directoryPath);

      for (const attachment of input.attachments) {
        await Bun.write(join(directoryPath, attachment.storedFileName), attachment.bytes);
      }

      return { ok: true, value: undefined };
    } catch (error) {
      logger.error("Failed to store help attachment for ticket {ticketId}", {
        ticketId: input.ticketId,
        mediaKind: input.attachments[0]?.mediaKind ?? null,
        detectedMime: input.attachments[0]?.mimeType ?? null,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      await this.deleteTicketStorage(input.ticketId);

      return {
        ok: false,
        status: 500,
        body: storeAttachmentFailedError(),
      };
    }
  }

  async deleteTicketStorage(ticketId: string): Promise<void> {
    if (!HELP_TICKET_ID_PATTERN.test(ticketId)) {
      return;
    }

    const directoryPath = this.resolveTicketDirectoryPath(ticketId);
    const proc = Bun.spawn(["rm", "-rf", directoryPath]);
    await proc.exited;
  }

  async readStoredAttachment(input: {
    storedFileName: string;
    ticketId: string;
  }): Promise<Bun.BunFile | null> {
    if (!HELP_TICKET_ID_PATTERN.test(input.ticketId)) {
      return null;
    }

    const storedFileName = basename(input.storedFileName);
    const file = Bun.file(join(this.resolveTicketDirectoryPath(input.ticketId), storedFileName));

    return (await file.exists()) ? file : null;
  }

  private async prepareSingleAttachment(input: {
    attachment: File;
    userId: string;
  }): Promise<HelpTicketAttachmentServiceResult<PreparedHelpTicketAttachment>> {
    const originalFileName = sanitizeOriginalFileName(input.attachment.name);
    const declaredMime = input.attachment.type || null;
    const sizeBytes = input.attachment.size;
    const attachmentId = Bun.randomUUIDv7();

    if (sizeBytes <= 0 || sizeBytes > HELP_TICKET_LIMITS.maxAttachmentBytes) {
      this.logRejectedAttachment({
        declaredMime,
        detectedMime: null,
        reason: "size_limit",
        sizeBytes,
        userId: input.userId,
      });

      return {
        ok: false,
        status: 422,
        body: helpAttachmentRejectedError(
          "attachments",
          `Each attachment must be ${formatMegabytes(HELP_TICKET_LIMITS.maxAttachmentBytes)} or smaller.`,
        ),
      };
    }

    const bytes = new Uint8Array(await input.attachment.arrayBuffer());
    const detected = await fileTypeFromBuffer(bytes);
    const detectedMime = detected?.mime ?? null;
    const detectedExtension = detected?.ext ?? "bin";

    if (!detectedMime || !allowedUploadMimeTypes.has(detectedMime)) {
      this.logRejectedAttachment({
        declaredMime,
        detectedMime,
        reason: "invalid_type",
        sizeBytes,
        userId: input.userId,
      });

      return {
        ok: false,
        status: 422,
        body: helpAttachmentRejectedError(
          "attachments",
          "Only JPEG, PNG, WebP, MP4, WebM, and MOV files are allowed.",
        ),
      };
    }

    const tempPath = join(
      this.resolvedTemporaryRoot,
      `${attachmentId}${extname(input.attachment.name) || `.${detectedExtension}`}`,
    );
    let scanResult: ScanHelpAttachmentResult;

    try {
      await ensureDirectory(this.resolvedTemporaryRoot);
      await Bun.write(tempPath, bytes);
      scanResult = await this.scannerService.scanFile({ attachmentId, filePath: tempPath });
    } finally {
      await Bun.file(tempPath)
        .delete()
        .catch(() => undefined);
    }

    if (!scanResult.ok) {
      return scanResult;
    }

    if (imageMimeTypes.has(detectedMime)) {
      return await this.prepareImageAttachment({
        attachmentId,
        bytes,
        originalFileName,
        scanMetadata: scanResult,
        sizeBytes,
      });
    }

    if (videoMimeTypes.has(detectedMime)) {
      return {
        ok: true,
        value: {
          ...scanResult,
          bytes,
          height: null,
          id: attachmentId,
          mediaKind: "video",
          mimeType: detectedMime as HelpTicketAcceptedUploadMimeType,
          originalFileName,
          sha256: createSha256(bytes),
          sizeBytes,
          storedFileName: `${Bun.randomUUIDv7()}.${readVideoExtension(detectedMime)}`,
          storedSizeBytes: bytes.byteLength,
          width: null,
        },
      };
    }

    this.logRejectedAttachment({
      declaredMime,
      detectedMime,
      reason: "invalid_type",
      sizeBytes,
      userId: input.userId,
    });

    return {
      ok: false,
      status: 422,
      body: helpAttachmentRejectedError("attachments", "Unsupported attachment type."),
    };
  }

  private async prepareImageAttachment(input: {
    attachmentId: string;
    bytes: Uint8Array;
    originalFileName: string;
    scanMetadata: HelpTicketScanMetadata;
    sizeBytes: number;
  }): Promise<HelpTicketAttachmentServiceResult<PreparedHelpTicketAttachment>> {
    try {
      const metadata = await new Bun.Image(input.bytes, {
        maxPixels: HELP_TICKET_LIMITS.maxImagePixels,
      }).metadata();
      const outputBytes = await new Bun.Image(input.bytes, {
        maxPixels: HELP_TICKET_LIMITS.maxImagePixels,
      })
        .webp({ quality: 80 })
        .bytes();

      if (outputBytes.byteLength > HELP_TICKET_LIMITS.maxAttachmentBytes) {
        return {
          ok: false,
          status: 422,
          body: helpAttachmentRejectedError(
            "attachments",
            `Each attachment must be ${formatMegabytes(HELP_TICKET_LIMITS.maxAttachmentBytes)} or smaller.`,
          ),
        };
      }

      logger.debug("Optimized help image attachment {attachmentId}", {
        attachmentId: input.attachmentId,
        inputMime: metadata.format,
        outputMime: outputImageMimeType,
        width: metadata.width,
        height: metadata.height,
        inputSizeBytes: input.sizeBytes,
        outputSizeBytes: outputBytes.byteLength,
      });

      return {
        ok: true,
        value: {
          ...input.scanMetadata,
          bytes: outputBytes,
          height: metadata.height,
          id: input.attachmentId,
          mediaKind: "image",
          mimeType: outputImageMimeType,
          originalFileName: input.originalFileName,
          sha256: createSha256(outputBytes),
          sizeBytes: input.sizeBytes,
          storedFileName: `${Bun.randomUUIDv7()}.webp`,
          storedSizeBytes: outputBytes.byteLength,
          width: metadata.width,
        },
      };
    } catch {
      return {
        ok: false,
        status: 422,
        body: helpAttachmentRejectedError(
          "attachments",
          "Image attachment could not be processed.",
        ),
      };
    }
  }

  private logRejectedAttachment(input: {
    declaredMime: string | null;
    detectedMime: string | null;
    reason: string;
    sizeBytes: number;
    userId: string;
  }): void {
    logger.warn("Rejected help attachment for user {userId}: {reason}", {
      userId: input.userId,
      reason: input.reason,
      detectedMime: input.detectedMime,
      declaredMime: input.declaredMime,
      sizeBytes: input.sizeBytes,
    });
  }

  private resolveTicketDirectoryPath(ticketId: string): string {
    return join(this.resolvedStorageRoot, ticketId);
  }
}

function helpAttachmentRejectedError(field: string, message: string): ApiErrorResponse {
  return {
    error: {
      code: "HELP_ATTACHMENT_REJECTED",
      message,
      fieldErrors: [
        {
          field,
          code: "HELP_ATTACHMENT_REJECTED",
          message,
        },
      ],
    },
  };
}

function storeAttachmentFailedError(): ApiErrorResponse {
  return {
    error: {
      code: "HELP_ATTACHMENT_STORE_FAILED",
      message: "Attachment storage failed.",
    },
  };
}

function sanitizeOriginalFileName(value: string): string {
  let normalized = "";

  for (const character of basename(value)) {
    const code = character.charCodeAt(0);

    if ((code >= 0 && code <= 31) || code === 127) {
      continue;
    }

    normalized += character === "/" || character === "\\" ? "-" : character;
  }

  normalized = normalized.trim();

  return normalized ? normalized.slice(0, 120) : "attachment";
}

function readVideoExtension(mimeType: string): string {
  switch (mimeType) {
    case "video/mp4":
      return "mp4";
    case "video/webm":
      return "webm";
    case "video/quicktime":
      return "mov";
    default:
      return "bin";
  }
}

function createSha256(bytes: Uint8Array): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(bytes);

  return hasher.digest("hex");
}

async function ensureDirectory(directoryPath: string): Promise<void> {
  const markerPath = join(directoryPath, ".arrtemplar-help-dir");

  await Bun.write(markerPath, "", { createPath: true });
  await Bun.file(markerPath).delete();
}

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
