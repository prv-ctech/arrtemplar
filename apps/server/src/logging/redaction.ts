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
  /^authorization$/i,
  /^proxy[-_]?authorization$/i,
  /^cookie$/i,
  /^set[-_]?cookie$/i,
  /^email$/i,
  /^error$/i,
  /^error[-_]?description$/i,
  /^errorMessage$/i,
  /^error[-_]?stack$/i,
  /^error[-_]?text$/i,
  /^formattedQuery$/i,
  /^query$/i,
  /^params$/i,
  /^stack$/i,
  /^key$/i,
  /api[-_]?key/i,
  /cookie/i,
  /authorization/i,
  /csrf/i,
  /email/i,
  /oauth/i,
  /password/i,
  /secret/i,
  /token/i,
  /formatted[-_]?query/i,
  /session[-_]?token/i,
  /token[-_]?hash/i,
  /password[-_]?hash/i,
];

const urlSensitiveFields: FieldPatterns = [
  /^callbackUrl$/i,
  /^href$/i,
  /^originalUrl$/i,
  /^redirectUri$/i,
  /^redirectUrl$/i,
  /^referer$/i,
  /^referrer$/i,
  /^requestUrl$/i,
  /^returnUrl$/i,
  /^uri$/i,
  /^url$/i,
];

const appSensitivePatterns: RedactionPatterns = [
  EMAIL_ADDRESS_PATTERN,
  JWT_PATTERN,
  CREDIT_CARD_NUMBER_PATTERN,
  {
    pattern: /arrtemplar_session=[^;\s]+/g,
    replacement: "arrtemplar_session=[REDACTED]",
  },
  {
    pattern: /\b((?:authorization|proxy-authorization)\s*[:=]\s*(?:bearer|basic)\s+)([^\s,;]+)/gi,
    replacement: "$1[REDACTED]",
  },
  {
    pattern:
      /\b((?:cookie|set-cookie)\s*:\s*[^;\s=]*(?:auth|csrf|key|session|token)[^=]*=)([^;\s]+)/gi,
    replacement: "$1[REDACTED]",
  },
  {
    pattern:
      /((?:^|[;\s])[^=;\s]*(?:api[-_]?key|auth|csrf|key|oauth|password|secret|session|token)[^=;\s]*=)([^;&#\s]+)/gi,
    replacement: "$1[REDACTED]",
  },
  {
    pattern:
      /([?&](?:access[-_]?token|api[-_]?key|auth|authorization|client[-_]?secret|code[-_]?verifier|csrf|csrf[-_]?token|id[-_]?token|oauth[-_]?token|password|refresh[-_]?token|secret|session|session[-_]?token|state|token)=)([^&#\s;]+)/gi,
    replacement: "$1[REDACTED]",
  },
  {
    pattern:
      /\b(access[-_]?token|api[-_]?key|auth|authorization|client[-_]?secret|code[-_]?verifier|csrf|csrf[-_]?token|id[-_]?token|oauth[-_]?token|password|refresh[-_]?token|secret|session|session[-_]?token|state|token)=([^&#\s;]+)/gi,
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
  const url = new URL(value, "http://app.local");

  for (const key of url.searchParams.keys()) {
    url.searchParams.set(key, "[REDACTED]");
  }

  if (isAbsolute) {
    return url.toString();
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
