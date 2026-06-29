import { APP_LOG_CATEGORY, type ApiErrorResponse } from "@arrtemplar/shared";
import { getLogger } from "@logtape/logtape";
import type { HelpTicketScanMode } from "../config/env";

const logger = getLogger([APP_LOG_CATEGORY, "help", "scanner"]);

export type HelpTicketScanMetadata = {
  scanEngine: string | null;
  scanResult: string | null;
  scanStatus: "clean" | "failed" | "infected" | "not_configured";
};

export type ScanHelpAttachmentResult =
  | ({ ok: true } & HelpTicketScanMetadata)
  | ({
      ok: false;
      status: 422 | 503;
      body: ApiErrorResponse;
    } & HelpTicketScanMetadata);

export type HelpTicketScannerServiceOptions = {
  mode: HelpTicketScanMode;
  runCommand?: (argv: string[]) => Promise<{
    exitCode: number;
    stderr: string;
    stdout: string;
  }>;
};

export class HelpTicketScannerService {
  private readonly runCommand: NonNullable<HelpTicketScannerServiceOptions["runCommand"]>;

  constructor(private readonly options: HelpTicketScannerServiceOptions) {
    this.runCommand = options.runCommand ?? runScannerCommand;
  }

  async scanFile(input: {
    attachmentId: string;
    filePath: string;
  }): Promise<ScanHelpAttachmentResult> {
    if (this.options.mode === "none") {
      return {
        ok: true,
        scanEngine: null,
        scanResult: null,
        scanStatus: "not_configured",
      };
    }

    const scanEngine = this.options.mode === "clamd" ? "clamdscan" : "clamscan";
    const argv =
      this.options.mode === "clamd"
        ? ["clamdscan", "--no-summary", "--fdpass", input.filePath]
        : ["clamscan", "--no-summary", input.filePath];

    try {
      const result = await this.runCommand(argv);
      const scanResult = readScannerOutput(result.stdout, result.stderr);

      if (result.exitCode === 0) {
        return {
          ok: true,
          scanEngine,
          scanResult,
          scanStatus: "clean",
        };
      }

      if (result.exitCode === 1) {
        logger.warn("Blocked infected help attachment {attachmentId}", {
          attachmentId: input.attachmentId,
          scannerMode: this.options.mode,
          scanResult,
        });

        return {
          ok: false,
          status: 422,
          body: infectedAttachmentError(),
          scanEngine,
          scanResult,
          scanStatus: "infected",
        };
      }

      logger.error("Help attachment scan failed for {attachmentId}", {
        attachmentId: input.attachmentId,
        scannerMode: this.options.mode,
        errorName: `${scanEngine}_exit_${result.exitCode}`,
      });

      return {
        ok: false,
        status: 503,
        body: scanFailedError(),
        scanEngine,
        scanResult,
        scanStatus: "failed",
      };
    } catch (error) {
      logger.error("Help attachment scan failed for {attachmentId}", {
        attachmentId: input.attachmentId,
        scannerMode: this.options.mode,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });

      return {
        ok: false,
        status: 503,
        body: scanFailedError(),
        scanEngine,
        scanResult: error instanceof Error ? error.message : "Scanner execution failed.",
        scanStatus: "failed",
      };
    }
  }
}

async function runScannerCommand(argv: string[]): Promise<{
  exitCode: number;
  stderr: string;
  stdout: string;
}> {
  const proc = Bun.spawn(argv, {
    stderr: "pipe",
    stdout: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { exitCode, stderr, stdout };
}

function readScannerOutput(stdout: string, stderr: string): string | null {
  const text = stdout.trim() || stderr.trim();

  if (!text) {
    return null;
  }

  const separatorIndex = text.indexOf(":");

  return separatorIndex >= 0 ? text.slice(separatorIndex + 1).trim() : text;
}

function infectedAttachmentError(): ApiErrorResponse {
  return {
    error: {
      code: "HELP_ATTACHMENT_INFECTED",
      message: "Attachment rejected by malware scan.",
    },
  };
}

function scanFailedError(): ApiErrorResponse {
  return {
    error: {
      code: "HELP_ATTACHMENT_SCAN_FAILED",
      message: "Attachment scan failed.",
    },
  };
}
