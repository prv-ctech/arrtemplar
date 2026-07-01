import type { ProxyProfileSummary } from "@arrtemplar/shared";
import type { ProxyProfile } from "../db/schema";

export function toProxyProfileSummary(profile: ProxyProfile): ProxyProfileSummary {
  return {
    id: profile.id,
    kind: profile.kind,
    variant: profile.variant,
    name: profile.name,
    description: profile.description,
    enabled: profile.enabled,
    scheme: profile.scheme,
    host: profile.host,
    port: profile.port,
    path: profile.path,
    requestTimeoutMs: profile.requestTimeoutMs,
    sessionName: profile.sessionName,
    sessionTtlMinutes: profile.sessionTtlMinutes,
    username: profile.username,
    hasPassword: Boolean(profile.passwordEncrypted),
    lastTestedAt: profile.lastTestedAt,
    lastTestOutcome: profile.lastTestOutcome,
    lastTestMessage: profile.lastTestMessage,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export function readProxyProfileAuditMetadata(profile: ProxyProfile): Record<string, unknown> {
  return {
    kind: profile.kind,
    variant: profile.variant,
    name: profile.name,
    enabled: profile.enabled,
    scheme: profile.scheme,
    host: profile.host,
    port: profile.port,
    path: profile.path,
    requestTimeoutMs: profile.requestTimeoutMs,
    hasPassword: Boolean(profile.passwordEncrypted),
    lastTestOutcome: profile.lastTestOutcome,
    lastTestedAt: profile.lastTestedAt,
  };
}
