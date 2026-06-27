import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import { Buffer } from "node:buffer";
import { HelpTicketAttachmentService } from "../../../../../apps/server/src/help/attachment.service";
import { HelpTicketScannerService } from "../../../../../apps/server/src/help/scanner.service";
import { HELP_TICKET_LIMITS } from "../../../../../packages/shared/src";

const attachmentStorageRoot = "data/media/test-help-attachments";
const pngBytes = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2Z0f8AAAAASUVORK5CYII=",
    "base64",
  ),
);
let jpegBytes: Uint8Array<ArrayBufferLike> = new Uint8Array();
let webpBytes: Uint8Array<ArrayBufferLike> = new Uint8Array();

beforeAll(async () => {
  jpegBytes = await new Bun.Image(pngBytes).jpeg().bytes();
  webpBytes = await new Bun.Image(pngBytes).webp().bytes();
});

afterEach(async () => {
  const proc = Bun.spawn(["rm", "-rf", "data/media/test-help-attachments"]);
  await proc.exited;
});

describe("help ticket attachment service", () => {
  it("accepts JPEG, PNG, and WebP images and normalizes them to WebP", async () => {
    const service = createAttachmentService();
    const fixtures = [
      { bytes: jpegBytes, mimeType: "image/jpeg", name: "sample.jpg" },
      { bytes: pngBytes, mimeType: "image/png", name: "sample.png" },
      { bytes: webpBytes, mimeType: "image/webp", name: "sample.webp" },
    ] as const;

    for (const fixture of fixtures) {
      const result = await service.prepareAttachments({
        attachments: [
          new File([new Uint8Array(fixture.bytes)], fixture.name, { type: fixture.mimeType }),
        ],
        userId: "Viewer001",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value[0]).toMatchObject({
          mediaKind: "image",
          mimeType: "image/webp",
          originalFileName: fixture.name,
          scanStatus: "not_configured",
          width: 1,
          height: 1,
        });
        expect(result.value[0]?.storedFileName).toEndWith(".webp");
        expect(result.value[0]?.storedSizeBytes).toBeGreaterThan(0);
      }
    }
  });

  it("accepts MP4, WebM, and MOV video signatures as pass-through files", async () => {
    const service = createAttachmentService();
    const fixtures = [
      {
        bytes: Uint8Array.from([
          0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02,
          0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
        ]),
        mimeType: "video/mp4",
        name: "clip.mp4",
      },
      {
        bytes: Uint8Array.from([
          0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2,
          0x81, 0x04, 0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d, 0x42, 0x87,
          0x81, 0x02,
        ]),
        mimeType: "video/webm",
        name: "clip.webm",
      },
      {
        bytes: Uint8Array.from([
          0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20, 0x00, 0x00, 0x00,
          0x00, 0x71, 0x74, 0x20, 0x20,
        ]),
        mimeType: "video/quicktime",
        name: "clip.mov",
      },
    ] as const;

    for (const fixture of fixtures) {
      const result = await service.prepareAttachments({
        attachments: [new File([fixture.bytes], fixture.name, { type: fixture.mimeType })],
        userId: "Viewer001",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value[0]).toMatchObject({
          mediaKind: "video",
          mimeType: fixture.mimeType,
          originalFileName: fixture.name,
          scanStatus: "not_configured",
          width: null,
          height: null,
        });
      }
    }
  });

  it("rejects unsupported text and archive payloads before storage", async () => {
    const service = createAttachmentService();
    const svgResult = await service.prepareAttachments({
      attachments: [new File(["<svg></svg>"], "vector.svg", { type: "image/svg+xml" })],
      userId: "Viewer001",
    });
    const zipResult = await service.prepareAttachments({
      attachments: [
        new File(
          [Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00])],
          "archive.zip",
          { type: "application/zip" },
        ),
      ],
      userId: "Viewer001",
    });

    expect(svgResult.ok).toBe(false);
    expect(zipResult.ok).toBe(false);
    if (!svgResult.ok) {
      expect(svgResult.status).toBe(422);
      expect(svgResult.body.error.code).toBe("HELP_ATTACHMENT_REJECTED");
    }
    if (!zipResult.ok) {
      expect(zipResult.status).toBe(422);
      expect(zipResult.body.error.code).toBe("HELP_ATTACHMENT_REJECTED");
    }
  });

  it("rejects oversized uploads and too many files", async () => {
    const service = createAttachmentService();
    const oversized = await service.prepareAttachments({
      attachments: [
        new File([new Uint8Array(HELP_TICKET_LIMITS.maxAttachmentBytes + 1)], "huge.mp4", {
          type: "video/mp4",
        }),
      ],
      userId: "Viewer001",
    });
    const tooMany = await service.prepareAttachments({
      attachments: Array.from(
        { length: HELP_TICKET_LIMITS.maxAttachmentCount + 1 },
        (_, index) => new File([pngBytes], `capture-${index}.png`, { type: "image/png" }),
      ),
      userId: "Viewer001",
    });

    expect(oversized.ok).toBe(false);
    expect(tooMany.ok).toBe(false);
    if (!oversized.ok) {
      expect(oversized.status).toBe(422);
    }
    if (!tooMany.ok) {
      expect(tooMany.status).toBe(422);
    }
  });

  it("propagates infected and failed scanner outcomes", async () => {
    const infectedService = createAttachmentService(
      new HelpTicketScannerService({
        mode: "clamscan",
        runCommand: async () => ({
          exitCode: 1,
          stderr: "",
          stdout: "capture.png: Eicar-Test-Signature FOUND",
        }),
      }),
    );
    const failedService = createAttachmentService(
      new HelpTicketScannerService({
        mode: "clamd",
        runCommand: async () => ({
          exitCode: 2,
          stderr: "scan failed",
          stdout: "",
        }),
      }),
    );

    const infected = await infectedService.prepareAttachments({
      attachments: [new File([pngBytes], "capture.png", { type: "image/png" })],
      userId: "Viewer001",
    });
    const failed = await failedService.prepareAttachments({
      attachments: [new File([pngBytes], "capture.png", { type: "image/png" })],
      userId: "Viewer001",
    });

    expect(infected.ok).toBe(false);
    expect(failed.ok).toBe(false);
    if (!infected.ok) {
      expect(infected.status).toBe(422);
      expect(infected.body.error.code).toBe("HELP_ATTACHMENT_INFECTED");
    }
    if (!failed.ok) {
      expect(failed.status).toBe(503);
      expect(failed.body.error.code).toBe("HELP_ATTACHMENT_SCAN_FAILED");
    }
  });
});

function createAttachmentService(scannerService = new HelpTicketScannerService({ mode: "none" })) {
  return new HelpTicketAttachmentService(attachmentStorageRoot, scannerService);
}
