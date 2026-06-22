# Authentik OAuth settings for Arrtemplar

This note captures the live Authentik OAuth/OIDC values needed for Arrtemplar's `Settings -> Auth` form.

## Source of truth

- Authentik admin: `https://auth.prvmr.com/if/admin/#/core/providers/3`
- Provider name: `Provider for Arrtemplar`
- Linked application slug: `arrtemplar`

## Values to enter in Arrtemplar

| Arrtemplar field | Value |
| --- | --- |
| Provider | `On` |
| Issuer | `https://auth.prvmr.com/application/o/arrtemplar/` |
| Client ID | `VhTYKIi0nzCUeFct3pEKqB5dANpxeXgRM1g9JLc6` |
| Client secret | **Do not store in git.** Copy the current value directly from Authentik: `Providers -> Provider for Arrtemplar -> Edit OAuth2/OpenID Provider -> Client Secret`. |
| Scopes | `openid profile email` |
| Redirect URIs | `http://localhost:3000/api/auth/callback/authentik` |

## Important related provider settings

- Client type: `Confidential`
- Authorization flow: `default-provider-authorization-implicit-consent (Authorize Application)`
- Allowed grant types: `Authorization Code` only
- Logout URI: `http://localhost:3000/api/auth/logout/callback`
- Logout method: `Back-channel`
- Signing key: `authentik Self-signed Certificate`
- Subject mode: `Based on the User's hashed ID`
- Issuer mode: `Each provider has a different issuer, based on the application slug`

## Why the redirect URI uses port 3000

Arrtemplar's OAuth callbacks terminate on the server, not the Vite frontend. The backend exposes:

- `GET /api/auth/callback/:provider`
- `GET /api/auth/logout/callback`

For the Authentik provider, the live redirect target is therefore `http://localhost:3000/api/auth/callback/authentik`, even when the settings UI is being viewed from `http://localhost:5173/settings/auth`.

## Useful Authentik endpoints

- OpenID configuration: `https://auth.prvmr.com/application/o/arrtemplar/.well-known/openid-configuration`
- Authorize URL: `https://auth.prvmr.com/application/o/authorize/`
- Token URL: `https://auth.prvmr.com/application/o/token/`
- Userinfo URL: `https://auth.prvmr.com/application/o/userinfo/`
- End-session URL: `https://auth.prvmr.com/application/o/arrtemplar/end-session/`
- JWKS URL: `https://auth.prvmr.com/application/o/arrtemplar/jwks/`

## Security note

The current Authentik client secret is visible in the provider edit dialog, but it should stay out of repository files, screenshots, and commit history. If the secret is ever pasted into a tracked file or shared broadly, rotate it in Authentik and re-save the updated value in Arrtemplar.
