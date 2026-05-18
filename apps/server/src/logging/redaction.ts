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
  /cookie/i,
  /authorization/i,
  /csrf/i,
  /session[-_]?token/i,
  /token[-_]?hash/i,
  /password[-_]?hash/i,
];

const urlSensitiveFields: FieldPatterns = [/^referrer$/i, /^url$/i];

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
    pattern:
      /(^|[^\d.])((?:4\d{12}(?:\d{3})?|5[1-5]\d{14}|3[47]\d{13}|6(?:011|5\d{2})\d{12}))(?![\d.])/g,
    replacement: "$1[CARD REDACTED]",
  },
];

export function createRedactedSink<TSink extends Sink>(sink: TSink): TSink {
  const urlRedactedSink = redactByField(sink, {
    fieldPatterns: urlSensitiveFields,
    action: redactUrlField,
  });

  return redactByField(urlRedactedSink, {
    fieldPatterns: appSensitiveFields,
    action: () => "[REDACTED]",
  }) as TSink;
}

export function createRedactedTextFormatter(formatter: TextFormatter): TextFormatter {
  return redactByPattern(formatter, appSensitivePatterns) as TextFormatter;
}

function redactUrlField(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return redactParsedUrl(value);
  } catch {
    return value.replace(
      /\b(cookie|token|session|secret|password|auth|key)=([^&\s;]+)/gi,
      "$1=[REDACTED]",
    );
  }
}

function redactParsedUrl(value: string): string {
  const isAbsolute = /^[a-z][a-z\d+.-]*:/i.test(value);
  const url = new URL(value, "http://arrweeb.local");

  for (const key of url.searchParams.keys()) {
    url.searchParams.set(key, "[REDACTED]");
  }

  if (isAbsolute) {
    return url.toString();
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
