import type { Sink, TextFormatter } from "@logtape/logtape";
import {
  CREDIT_CARD_NUMBER_PATTERN,
  DEFAULT_REDACT_FIELDS,
  EMAIL_ADDRESS_PATTERN,
  type FieldPatterns,
  JWT_PATTERN,
  type RedactionPatterns,
  redactByField,
  redactByPattern,
} from "@logtape/redaction";

const appSensitiveFields: FieldPatterns = [
  ...DEFAULT_REDACT_FIELDS,
  "email",
  "sessionToken",
  "tokenHash",
  "passwordHash",
  /^errorMessage$/i,
  /^formattedQuery$/i,
  /^params$/i,
  /^referrer$/i,
  /^url$/i,
  /cookie/i,
  /authorization/i,
  /csrf/i,
  /session[-_]?token/i,
  /token[-_]?hash/i,
  /password[-_]?hash/i,
];

const appSensitivePatterns: RedactionPatterns = [
  EMAIL_ADDRESS_PATTERN,
  JWT_PATTERN,
  CREDIT_CARD_NUMBER_PATTERN,
  {
    pattern: /arrweeb_session=[^;\s]+/g,
    replacement: "arrweeb_session=[REDACTED]",
  },
  {
    pattern: /\b(cookie|token|session|secret|password|auth|key)=([^&\s;]+)/gi,
    replacement: "$1=[REDACTED]",
  },
  {
    pattern: /\b(?:\d[ -]?){13,19}\b/g,
    replacement: "[CARD REDACTED]",
  },
];

export function createRedactedSink<TSink extends Sink>(sink: TSink): TSink {
  return redactByField(sink, {
    fieldPatterns: appSensitiveFields,
    action: () => "[REDACTED]",
  }) as TSink;
}

export function createRedactedTextFormatter(formatter: TextFormatter): TextFormatter {
  return redactByPattern(formatter, appSensitivePatterns) as TextFormatter;
}
