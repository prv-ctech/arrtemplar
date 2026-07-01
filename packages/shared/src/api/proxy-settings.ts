export const PROXY_PROFILE_KIND_VALUES = ["challenge_solver", "http_proxy"] as const;

export type ProxyProfileKind = (typeof PROXY_PROFILE_KIND_VALUES)[number];

export const CHALLENGE_SOLVER_VARIANT_VALUES = ["trawl", "flaresolverr", "byparr"] as const;

export type ChallengeSolverVariant = (typeof CHALLENGE_SOLVER_VARIANT_VALUES)[number];

export const HTTP_PROXY_SCHEME_VALUES = ["http", "https"] as const;

export type HttpProxyScheme = (typeof HTTP_PROXY_SCHEME_VALUES)[number];

export const PROXY_PROFILE_TEST_OUTCOME_VALUES = ["success", "failed", "skipped"] as const;

export type ProxyProfileTestOutcome = (typeof PROXY_PROFILE_TEST_OUTCOME_VALUES)[number];

export const DEFAULT_CHALLENGE_SOLVER_VARIANT = "trawl" as const;
export const DEFAULT_CHALLENGE_SOLVER_PATH = "/v1" as const;
export const DEFAULT_PROXY_REQUEST_TIMEOUT_MS = 60_000 as const;

export const PROXY_SETTINGS_API_ROUTES = {
  collection: "/api/settings/proxies",
  detail: "/api/settings/proxies/:proxyProfileId",
  test: "/api/settings/proxies/:proxyProfileId/test",
} as const;

export type ProxyProfileConfig = {
  kind: ProxyProfileKind;
  variant: ChallengeSolverVariant | null;
  name: string;
  description: string | null;
  enabled: boolean;
  scheme: HttpProxyScheme;
  host: string;
  port: number;
  path: string | null;
  requestTimeoutMs: number;
  sessionName: string | null;
  sessionTtlMinutes: number | null;
  username: string | null;
};

export type ProxyProfileSummary = ProxyProfileConfig & {
  id: string;
  hasPassword: boolean;
  lastTestedAt: string | null;
  lastTestOutcome: ProxyProfileTestOutcome | null;
  lastTestMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProxyProfileListResponse = {
  profiles: ProxyProfileSummary[];
};

export type ProxyProfileResponse = {
  profile: ProxyProfileSummary;
};

export type ProxyProfileMutationResponse = {
  status: "ok";
  profile: ProxyProfileSummary;
};

export type DeleteProxyProfileResponse = {
  status: "ok";
  deletedId: string;
  deletedKind: ProxyProfileKind;
};

export type UpsertProxyProfileRequest = Pick<
  ProxyProfileConfig,
  "host" | "kind" | "name" | "port" | "scheme"
> & {
  variant?: ProxyProfileConfig["variant"];
  description?: ProxyProfileConfig["description"];
  enabled?: ProxyProfileConfig["enabled"];
  path?: ProxyProfileConfig["path"];
  requestTimeoutMs?: ProxyProfileConfig["requestTimeoutMs"];
  sessionName?: ProxyProfileConfig["sessionName"];
  sessionTtlMinutes?: ProxyProfileConfig["sessionTtlMinutes"];
  username?: ProxyProfileConfig["username"];
  password?: string;
  clearPassword?: boolean;
};

export type ProxyProfileTestResult = {
  profileId: string;
  kind: ProxyProfileKind;
  outcome: ProxyProfileTestOutcome;
  message: string;
  testedAt: string;
  statusCode: number | null;
  responseTimeMs: number | null;
};

export type ProxyProfileTestResponse = {
  result: ProxyProfileTestResult;
};

export function isProxyProfileKind(value: unknown): value is ProxyProfileKind {
  return typeof value === "string" && PROXY_PROFILE_KIND_VALUES.some((kind) => kind === value);
}

export function isChallengeSolverVariant(value: unknown): value is ChallengeSolverVariant {
  return (
    typeof value === "string" &&
    CHALLENGE_SOLVER_VARIANT_VALUES.some((variant) => variant === value)
  );
}

export function isHttpProxyScheme(value: unknown): value is HttpProxyScheme {
  return typeof value === "string" && HTTP_PROXY_SCHEME_VALUES.some((scheme) => scheme === value);
}

export function isProxyProfileTestOutcome(value: unknown): value is ProxyProfileTestOutcome {
  return (
    typeof value === "string" &&
    PROXY_PROFILE_TEST_OUTCOME_VALUES.some((outcome) => outcome === value)
  );
}
