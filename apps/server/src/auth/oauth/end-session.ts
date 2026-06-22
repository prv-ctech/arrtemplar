import type { AuthProvider } from "../../db/schema";
import { createOAuthRandomValue, decryptOAuthIdToken } from "../../security/oauth-crypto";
import { createLogoutStateCookieValue } from "../../security/oauth-state";
import { fetchOidcDiscovery } from "./discovery";

type OAuthSessionToken = {
  provider: AuthProvider["slug"];
  idTokenEncrypted: string;
  masterKeyId: string;
};

type EndSessionInput = {
  provider: AuthProvider;
  oauthSessionToken: OAuthSessionToken;
  encryptionKey: string;
  postLogoutRedirectUri: string;
};

type EndSessionResult = {
  html: string;
  logoutStateCookieValue: string;
};

/**
 * Builds an OIDC RP-Initiated Logout continuation: a server-rendered,
 * auto-submitting POST form so `id_token_hint` stays in the request body
 * and never appears in a URL. Returns null when true SSO logout is not
 * possible, so the caller can fall back to local logout.
 */
export async function buildEndSessionRedirect(
  input: EndSessionInput,
): Promise<EndSessionResult | null> {
  let endSessionEndpoint: string | null;

  try {
    endSessionEndpoint = (await fetchOidcDiscovery(input.provider.issuer)).endSessionEndpoint;
  } catch {
    return null;
  }

  if (!endSessionEndpoint) {
    return null;
  }

  let idTokenHint: string;

  try {
    idTokenHint = await decryptOAuthIdToken(
      input.oauthSessionToken.idTokenEncrypted,
      input.encryptionKey,
    );
  } catch {
    return null;
  }

  const state = createOAuthRandomValue();
  const logoutStateCookieValue = await createLogoutStateCookieValue(state, input.encryptionKey);

  return {
    html: buildEndSessionFormHtml({
      action: endSessionEndpoint,
      clientId: input.provider.clientId,
      idTokenHint,
      postLogoutRedirectUri: input.postLogoutRedirectUri,
      state,
    }),
    logoutStateCookieValue,
  };
}

function buildEndSessionFormHtml(input: {
  action: string;
  clientId: string;
  idTokenHint: string;
  postLogoutRedirectUri: string;
  state: string;
}): string {
  const fields = [
    `name="id_token_hint" value="${escapeHtmlAttribute(input.idTokenHint)}"`,
    `name="client_id" value="${escapeHtmlAttribute(input.clientId)}"`,
    `name="post_logout_redirect_uri" value="${escapeHtmlAttribute(input.postLogoutRedirectUri)}"`,
    `name="state" value="${escapeHtmlAttribute(input.state)}"`,
  ];

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    "<title>Signing out</title>",
    "</head>",
    "<body>",
    `<form id="end-session" method="post" action="${escapeHtmlAttribute(input.action)}">`,
    ...fields.map((field) => `<input type="hidden" ${field} />`),
    '<noscript><button type="submit">Continue</button></noscript>',
    "</form>",
    "<script>(function(){document.getElementById('end-session').submit();})();</script>",
    "</body>",
    "</html>",
  ].join("");
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
