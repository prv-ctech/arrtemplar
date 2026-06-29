import { describe, expect, it } from "bun:test";
import { HelpTicketScannerService } from "../../../../../apps/server/src/help/scanner.service";

describe("help ticket scanner service", () => {
  it("returns not_configured when scanning is disabled", async () => {
    const scanner = new HelpTicketScannerService({ mode: "none" });

    const result = await scanner.scanFile({
      attachmentId: "attachment-1",
      filePath: "/tmp/attachment-1.bin",
    });

    expect(result).toEqual({
      ok: true,
      scanEngine: null,
      scanResult: null,
      scanStatus: "not_configured",
    });
  });

  it("reports infected attachments from clamscan", async () => {
    const scanner = new HelpTicketScannerService({
      mode: "clamscan",
      runCommand: async () => ({
        exitCode: 1,
        stderr: "",
        stdout: "attachment.bin: Eicar-Test-Signature FOUND",
      }),
    });

    const result = await scanner.scanFile({
      attachmentId: "attachment-2",
      filePath: "/tmp/attachment-2.bin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.scanEngine).toBe("clamscan");
      expect(result.scanStatus).toBe("infected");
      expect(result.body).toEqual({
        error: {
          code: "HELP_ATTACHMENT_INFECTED",
          message: "Attachment rejected by malware scan.",
        },
      });
    }
  });

  it("reports scanner execution failures for clamd mode", async () => {
    const scanner = new HelpTicketScannerService({
      mode: "clamd",
      runCommand: async () => ({
        exitCode: 2,
        stderr: "scan error",
        stdout: "",
      }),
    });

    const result = await scanner.scanFile({
      attachmentId: "attachment-3",
      filePath: "/tmp/attachment-3.bin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.scanEngine).toBe("clamdscan");
      expect(result.scanStatus).toBe("failed");
      expect(result.body).toEqual({
        error: {
          code: "HELP_ATTACHMENT_SCAN_FAILED",
          message: "Attachment scan failed.",
        },
      });
    }
  });
});
