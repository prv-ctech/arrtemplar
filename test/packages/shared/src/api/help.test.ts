import { describe, expect, it } from "bun:test";
import {
  HELP_TICKET_ID_PATTERN_SOURCE,
  HELP_TICKET_LIMITS,
  isHelpTicketId,
} from "../../../../../packages/shared/src";

describe("help ticket shared contracts", () => {
  it("accepts arr-prefixed numeric ticket ids only", () => {
    expect(HELP_TICKET_ID_PATTERN_SOURCE).toBe("^arr[0-9]+$");
    expect(isHelpTicketId("arr1241415")).toBe(true);
    expect(isHelpTicketId("arr1")).toBe(true);
    expect(isHelpTicketId("ARR1241415")).toBe(false);
    expect(isHelpTicketId("arr-1241415")).toBe(false);
    expect(isHelpTicketId("ticket1241415")).toBe(false);
  });

  it("keeps conservative shared limits for ticket drafts and uploads", () => {
    expect(HELP_TICKET_LIMITS).toEqual({
      titleMaxLength: 120,
      descriptionMaxLength: 5_000,
      maxAttachmentCount: 5,
      maxAttachmentBytes: 25 * 1024 * 1024,
      maxImagePixels: 40_000_000,
    });
  });
});
