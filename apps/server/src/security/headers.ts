import { permission, type SecurityConfig } from "elysiajs-helmet";

export const securityHeaderConfig = {
  csp: {
    defaultSrc: [permission.SELF],
    scriptSrc: [permission.SELF],
    styleSrc: [permission.SELF],
    imgSrc: [permission.SELF, permission.DATA, permission.BLOB, permission.HTTPS],
    fontSrc: [permission.SELF],
    connectSrc: [permission.SELF],
    frameSrc: [permission.SELF],
    objectSrc: [permission.NONE],
    baseUri: [permission.SELF],
    reportOnly: true,
  },
  frameOptions: "DENY",
  xssProtection: false,
  referrerPolicy: "strict-origin-when-cross-origin",
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    "interest-cohort": [],
  },
  hsts: {
    maxAge: 63_072_000,
    includeSubDomains: true,
    preload: true,
  },
  corp: "same-origin",
  coop: "same-origin",
  customHeaders: {
    "X-XSS-Protection": "0",
  },
} satisfies Partial<SecurityConfig>;

const cspReportOnlyHeader = "Content-Security-Policy-Report-Only";
const supplementalCspDirectives = ["frame-ancestors 'none'", "form-action 'self'"];

export function appendSupplementalCspDirectives({
  set,
}: {
  set: { headers: Record<string, string | number | boolean | undefined> };
}): void {
  const currentPolicy = set.headers[cspReportOnlyHeader];

  if (typeof currentPolicy !== "string" || currentPolicy.length === 0) {
    return;
  }

  const missingDirectives = supplementalCspDirectives.filter(
    (directive) => !currentPolicy.includes(directive),
  );

  if (missingDirectives.length === 0) {
    return;
  }

  set.headers[cspReportOnlyHeader] = `${currentPolicy}; ${missingDirectives.join("; ")}`;
}
