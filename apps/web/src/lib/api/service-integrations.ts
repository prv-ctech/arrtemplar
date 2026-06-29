import type {
  DeleteServiceIntegrationResponse,
  ServiceIntegrationKind,
  ServiceIntegrationProbeResponse,
  ServiceIntegrationSavedConfig,
  UpsertServiceIntegrationRequest,
} from "@arrtemplar/shared";
import { requestApiJson } from "./client";
import {
  normalizeDeleteServiceIntegrationResponse,
  normalizeServiceIntegrationListResponse,
  normalizeServiceIntegrationProbeResponse,
  normalizeServiceIntegrationResponse,
  requireServiceIntegrationConfig,
  requireServiceIntegrationConfigById,
} from "./normalizers";

export async function listServiceIntegrationConfigs(): Promise<ServiceIntegrationSavedConfig[]> {
  const response = await requestApiJson({
    fallback: "Service integration settings request failed.",
    method: "GET",
    path: "/api/settings/services",
  });

  return normalizeServiceIntegrationListResponse(response).integrations;
}

export async function upsertServiceIntegrationConfig(
  kind: ServiceIntegrationKind,
  input: UpsertServiceIntegrationRequest,
): Promise<ServiceIntegrationSavedConfig> {
  const response = await requestApiJson({
    body: input,
    fallback: "Service integration settings save failed.",
    method: "PUT",
    path: `/api/settings/services/${encodeURIComponent(kind)}`,
  });

  return requireServiceIntegrationConfig(normalizeServiceIntegrationResponse(response), kind);
}

export async function createServiceIntegrationConfig(
  kind: ServiceIntegrationKind,
  input: UpsertServiceIntegrationRequest,
): Promise<ServiceIntegrationSavedConfig> {
  const response = await requestApiJson({
    body: input,
    fallback: "Service integration settings save failed.",
    method: "POST",
    path: `/api/settings/services/${encodeURIComponent(kind)}/instances`,
  });

  return requireServiceIntegrationConfig(normalizeServiceIntegrationResponse(response), kind);
}

export async function updateServiceIntegrationConfig(
  integrationId: string,
  input: UpsertServiceIntegrationRequest,
): Promise<ServiceIntegrationSavedConfig> {
  const response = await requestApiJson({
    body: input,
    fallback: "Service integration settings save failed.",
    method: "PUT",
    path: `/api/settings/services/instances/${encodeURIComponent(integrationId)}`,
  });

  return requireServiceIntegrationConfigById(
    normalizeServiceIntegrationResponse(response),
    integrationId,
  );
}

export async function deleteServiceIntegrationConfigById(
  integrationId: string,
): Promise<DeleteServiceIntegrationResponse> {
  const response = await requestApiJson({
    fallback: "Service integration delete failed.",
    method: "DELETE",
    path: `/api/settings/services/instances/${encodeURIComponent(integrationId)}`,
  });

  return normalizeDeleteServiceIntegrationResponse(response, undefined, integrationId);
}

export async function testServiceIntegrationConfig(
  kind: ServiceIntegrationKind,
): Promise<ServiceIntegrationProbeResponse> {
  const response = await requestApiJson({
    body: {},
    fallback: "Service integration test failed.",
    method: "POST",
    path: `/api/settings/services/${encodeURIComponent(kind)}/test`,
  });

  return normalizeServiceIntegrationProbeResponse(response, kind);
}

export async function testServiceIntegrationConfigById(
  integrationId: string,
): Promise<ServiceIntegrationProbeResponse> {
  const response = await requestApiJson({
    body: {},
    fallback: "Service integration test failed.",
    method: "POST",
    path: `/api/settings/services/instances/${encodeURIComponent(integrationId)}/test`,
  });

  return normalizeServiceIntegrationProbeResponse(response);
}

export async function getServiceIntegrationStatus(
  kind: ServiceIntegrationKind,
): Promise<ServiceIntegrationProbeResponse> {
  const response = await requestApiJson({
    fallback: "Service integration status request failed.",
    method: "GET",
    path: `/api/settings/services/${encodeURIComponent(kind)}/status`,
  });

  return normalizeServiceIntegrationProbeResponse(response, kind);
}

export async function getServiceIntegrationStatusById(
  integrationId: string,
): Promise<ServiceIntegrationProbeResponse> {
  const response = await requestApiJson({
    fallback: "Service integration status request failed.",
    method: "GET",
    path: `/api/settings/services/instances/${encodeURIComponent(integrationId)}/status`,
  });

  return normalizeServiceIntegrationProbeResponse(response);
}
