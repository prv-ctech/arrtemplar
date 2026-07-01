import {
  APP_LOG_CATEGORY,
  type ChallengeSolverVariant,
  type ProxyProfileTestResult,
} from "@arrtemplar/shared";
import { getLogger } from "@logtape/logtape";
import {
  buildValidatedBaseUrl,
  OutboundRequestPolicyError,
  type OutboundTextRequestOptions,
  type OutboundTextResponse,
  requestOutboundText,
} from "../outbound/request-target-policy";

const logger = getLogger([APP_LOG_CATEGORY, "settings", "proxies", "challenge-solver"]);

type ChallengeSolverRequest = (
  options: OutboundTextRequestOptions,
) => Promise<OutboundTextResponse>;

export type ChallengeSolverTestInput = {
  proxyProfileId: string;
  variant: ChallengeSolverVariant;
  scheme: "http" | "https";
  host: string;
  port: number;
  timeoutMs: number;
};

export type ChallengeSolverTestDependencies = {
  requestText?: ChallengeSolverRequest;
  now?: () => string;
};

export async function testChallengeSolverConnection(
  input: ChallengeSolverTestInput,
  dependencies: ChallengeSolverTestDependencies = {},
): Promise<ProxyProfileTestResult> {
  const requestText = dependencies.requestText ?? requestOutboundText;
  const now = dependencies.now ?? (() => new Date().toISOString());
  const label = readVariantLabel(input.variant);
  const steps = readVariantSteps(input.variant);

  logger.debug("Challenge solver test started for {proxyProfileId}.", {
    event: "settings.proxies.challenge_solver.test.started",
    proxyProfileId: input.proxyProfileId,
    variant: input.variant,
    host: input.host,
    port: input.port,
    path: steps[0],
    timeoutMs: input.timeoutMs,
  });

  let baseUrl: URL;

  try {
    baseUrl = buildValidatedBaseUrl({
      label,
      scheme: input.scheme,
      host: input.host,
      port: input.port,
    });
  } catch (error) {
    if (error instanceof OutboundRequestPolicyError) {
      return createFailureResult(input, {
        message: error.message,
        now,
        reason: error.message,
        step: "validate",
      });
    }

    throw error;
  }

  let lastFailure: ProxyProfileTestResult | null = null;

  for (const step of steps) {
    const startedAt = performance.now();

    try {
      const response = await requestText({
        baseUrl,
        label,
        path: step,
        timeoutMs: input.timeoutMs,
      });
      const responseTimeMs = Math.round(performance.now() - startedAt);

      if (response.status >= 200 && response.status < 300) {
        return createSuccessResult(input, {
          message: `${label} responded on ${step}.`,
          now,
          responseTimeMs,
          statusCode: response.status,
        });
      }

      lastFailure = createFailureResult(input, {
        message: `${label} responded with HTTP ${response.status} on ${step}.`,
        now,
        reason: `http_${response.status}`,
        responseTimeMs,
        statusCode: response.status,
        step,
      });
    } catch (error) {
      if (error instanceof OutboundRequestPolicyError) {
        return createFailureResult(input, {
          message: error.message,
          now,
          reason: error.code,
          responseTimeMs: Math.round(performance.now() - startedAt),
          step,
        });
      }

      throw error;
    }
  }

  return (
    lastFailure ??
    createFailureResult(input, {
      message: `${label} did not respond on a supported readiness endpoint.`,
      now,
      reason: "unsupported_response",
      step: steps.at(-1) ?? "/",
    })
  );
}

function readVariantLabel(variant: ChallengeSolverVariant): string {
  switch (variant) {
    case "trawl":
      return "Trawl";
    case "flaresolverr":
      return "FlareSolverr";
    case "byparr":
      return "Byparr";
  }
}

function readVariantSteps(variant: ChallengeSolverVariant): readonly string[] {
  switch (variant) {
    case "trawl":
      return ["/health"];
    case "flaresolverr":
      return ["/health", "/"];
    case "byparr":
      return ["/", "/docs"];
  }
}

function createSuccessResult(
  input: ChallengeSolverTestInput,
  options: {
    message: string;
    now: () => string;
    responseTimeMs: number;
    statusCode: number;
  },
): ProxyProfileTestResult {
  logger.info("Challenge solver test succeeded for {proxyProfileId}.", {
    event: "settings.proxies.challenge_solver.test.succeeded",
    proxyProfileId: input.proxyProfileId,
    variant: input.variant,
    statusCode: options.statusCode,
    responseTimeMs: options.responseTimeMs,
  });

  return {
    profileId: input.proxyProfileId,
    kind: "challenge_solver",
    outcome: "success",
    message: options.message,
    testedAt: options.now(),
    statusCode: options.statusCode,
    responseTimeMs: options.responseTimeMs,
  };
}

function createFailureResult(
  input: ChallengeSolverTestInput,
  options: {
    message: string;
    now: () => string;
    reason: string;
    step: string;
    responseTimeMs?: number | undefined;
    statusCode?: number | undefined;
  },
): ProxyProfileTestResult {
  logger.warn("Challenge solver test failed at {step} with {reason}.", {
    event: "settings.proxies.challenge_solver.test.failed",
    proxyProfileId: input.proxyProfileId,
    variant: input.variant,
    step: options.step,
    statusCode: options.statusCode ?? null,
    reason: options.reason,
    responseTimeMs: options.responseTimeMs ?? null,
  });

  return {
    profileId: input.proxyProfileId,
    kind: "challenge_solver",
    outcome: "failed",
    message: options.message,
    testedAt: options.now(),
    statusCode: options.statusCode ?? null,
    responseTimeMs: options.responseTimeMs ?? null,
  };
}
