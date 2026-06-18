---
name: security-and-hardening
description: Hardens code against vulnerabilities. Use when handling user input, authentication, data storage, or external integrations. Use when building any feature that accepts untrusted data, manages user sessions, or interacts with third-party services.
---

# Security and Hardening

## Overview

Security-first development practices for web applications. Treat every external input as hostile, every secret as sacred, and every authorization check as mandatory. Security isn't a phase — it's a constraint on every line of code that touches user data, authentication, or external systems.

## Verified Workspace Stack

Use guidance that matches this repository, not generic Node/Express examples:

- **Runtime and package manager:** use `bun`, `bun ci`, `bun audit`, Bun Shell, `Bun.env`, `Bun.password`, `Bun.CSRF`, and Web APIs.
- **HTTP server:** Elysia `1.4.x`; use Elysia route schemas, guards, lifecycle hooks, plugins, and `status()` responses.
- **Validation:** Elysia `t` / TypeBox is the default validation layer. Do not introduce Zod for route validation unless the user explicitly approves a validator change.
- **Security headers and CORS:** Use the existing `elysiajs-helmet` and `@elysia/cors` patterns, especially `apps/server/src/security/headers.ts` and `apps/server/src/security/cors.ts`.
- **Frontend:** Vite `8` with React. Only `VITE_*` env vars are exposed to the browser, so no `VITE_*` variable may contain secrets.
- **Database:** Drizzle ORM. Use Drizzle parameterization and existing schema/query patterns; never concatenate user input into SQL.

### Stale Stack Patterns to Remove

If you see these in proposed guidance or examples, replace them before acting:

- `npm audit`, `npm ci`, or `npm install` → `bun audit`, `bun ci`, `bun install --frozen-lockfile`, `bun add`.
- Express middleware examples → Elysia plugins, guards, lifecycle hooks, and route options.
- Zod route schemas → Elysia `t` / TypeBox route schemas.
- `bcrypt` / `argon2` packages → `Bun.password.hash()` and `Bun.password.verify()`.
- Node-only SSRF examples using `node:dns/promises` as the default → Bun/Web `URL` + allowlisted hosts + `fetch` controls; use network egress controls for arbitrary URLs.
- `process.env` examples in server code → `Bun.env` unless interacting with a dependency API that requires `process.env`.

## When to Use

- Building anything that accepts user input
- Implementing authentication or authorization
- Storing or transmitting sensitive data
- Integrating with external APIs or services
- Adding file uploads, webhooks, or callbacks
- Handling payment or PII data

## Mandatory Audit Report

When invoked by the user or a supervising agent to perform a security audit, write a concise AI-readable report under `docs/audit/security/` before finishing. Create the directory if it does not exist.

Use one report per audit, named with the current date and a short scope slug: `docs/audit/security/YYYY-MM-DD-<scope>.md`. If continuing the same audit, update the existing report instead of creating duplicates.

Keep the report minimal, structured, and action-oriented so another AI agent can resume without rereading the whole codebase:

```markdown
# Security Audit: <scope>

Date: YYYY-MM-DD
Trigger: user | super-agent
Scope: <files, routes, features, or trust boundaries reviewed>

## Affected Areas
- `<path>` — <why it matters>

## Findings
- `<id>` — <severity> — <status> — `<path>:<line>` — <issue> — <required fix>

## Next Actions
- <ordered action with owner/context>

## Verification
- <checks run or checks still required>
```

If there are no findings, still write the report with `Findings: none` and list the checks performed. Do not include secrets, full tokens, raw private data, or noisy logs. Include only the file paths, exact affected surfaces, severity, remediation steps, and verification commands/results needed for a follow-up AI agent.

## Process: Threat Model First

Controls bolted on without a threat model are guesses. Before hardening, spend five minutes thinking like an attacker:

1. **Map the trust boundaries.** Where does untrusted data cross into your system? HTTP requests, form fields, file uploads, webhooks, third-party APIs, message queues, and **LLM output**. Every boundary is attack surface.
2. **Name the assets.** What's worth stealing or breaking? Credentials, PII, payment data, admin actions, money movement.
3. **Run STRIDE over each boundary** — a quick lens, not a ceremony:

| Threat | Ask | Typical mitigation |
|---|---|---|
| **S**poofing | Can someone impersonate a user/service? | Authentication, signature verification |
| **T**ampering | Can data be altered in transit or at rest? | Integrity checks, parameterized queries, HTTPS |
| **R**epudiation | Can an action be denied later? | Audit logging of security events |
| **I**nformation disclosure | Can data leak? | Encryption, field allowlists, generic errors |
| **D**enial of service | Can it be overwhelmed? | Rate limiting, input size caps, timeouts |
| **E**levation of privilege | Can a user gain rights they shouldn't? | Authorization checks, least privilege |

4. **Write abuse cases next to use cases.** For each feature, ask "how would I misuse this?" — then make that your first test.

If you can't name the trust boundaries for a feature, you're not ready to secure it. This is OWASP **A04: Insecure Design** — most breaches begin in design, not code.

## The Three-Tier Boundary System

### Always Do (No Exceptions)

- **Validate all external input** at the system boundary (API routes, form handlers)
- **Parameterize all database queries** — never concatenate user input into SQL
- **Encode output** to prevent XSS (use framework auto-escaping, don't bypass it)
- **Use HTTPS** for all external communication
- **Hash passwords** with Bun-native `Bun.password.hash()` / `Bun.password.verify()` using Argon2id unless a legacy hash migration requires bcrypt compatibility
- **Set security headers** with `elysiajs-helmet` and repo-approved CSP, HSTS, frame, referrer, CORP, COOP, and permissions-policy settings
- **Use httpOnly, secure, sameSite cookies** for sessions
- **Run `bun audit`** before every release; use `bun audit --prod` for production dependency gates and `bun audit --audit-level=high` for high-severity blocking
- **Run `bun ci`** in CI so installs use the committed `bun.lock` and fail when `package.json` and the lockfile disagree

### Ask First (Requires Human Approval)

Use VS Code's native `vscode_askQuestions` tool for every item in this section. Do not write the approval question only in markdown/plain chat and wait for a reply. Include concise options such as `Approve`, `Reject`, and `Needs more context`, and do not proceed until the tool returns explicit approval.

- Adding new authentication flows or changing auth logic
- Storing new categories of sensitive data (PII, payment info)
- Adding new external service integrations
- Changing CORS configuration
- Adding file upload handlers
- Modifying rate limiting or throttling
- Granting elevated permissions or roles

### Never Do

- **Never commit secrets** to version control (API keys, passwords, tokens)
- **Never log sensitive data** (passwords, tokens, full credit card numbers)
- **Never trust client-side validation** as a security boundary
- **Never disable security headers** for convenience
- **Never use `eval()` or `innerHTML`** with user-provided data
- **Never store sessions in client-accessible storage** (localStorage for auth tokens)
- **Never expose stack traces** or internal error details to users

## OWASP Top 10 Prevention Patterns

These are prevention patterns, not a ranking. For the 2021 ordering, see the quick-reference table in `references/security-checklist.md`.

### Injection (SQL, NoSQL, OS Command)

```typescript
// BAD: SQL injection via string concatenation
const query = `SELECT * FROM users WHERE id = '${userId}'`;

// GOOD: Drizzle query builder parameterizes values
const user = await db.query.users.findFirst({
	where: eq(users.publicUserId, publicUserId),
});

// GOOD: Drizzle sql template parameterizes interpolated values
const rows = await db.all(sql`select * from users where public_user_id = ${publicUserId}`);
```

### Broken Authentication

```typescript
// Password hashing: Bun defaults to Argon2id and stores parameters in PHC format.
const passwordHash = await Bun.password.hash(plaintextPassword, {
	algorithm: "argon2id",
});

const isValid = await Bun.password.verify(plaintextPassword, passwordHash);

// Cookie/session policy: keep session tokens server-issued and browser-protected.
cookie.session.set({
	value: sessionToken,
	httpOnly: true,
	secure: Bun.env.NODE_ENV === "production",
	sameSite: "lax",
	path: "/",
});
```

OWASP recommends Argon2id for new password storage, with bcrypt reserved mostly for legacy systems. Bun's `Bun.password.hash()` automatically salts hashes and encodes the algorithm/parameters in the hash so `verify()` can detect the correct verifier. Use async hashing APIs on request paths; the sync variants block the runtime.

### Cross-Site Scripting (XSS)

```typescript
// BAD: Rendering user input as HTML
element.innerHTML = userInput;

// GOOD: Use framework auto-escaping (React does this by default)
return <div>{userInput}</div>;

// If you MUST render HTML, sanitize first
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userInput);
```

### Broken Access Control

```typescript
// Always check authorization, not just authentication
app.patch('/api/tasks/:id', authenticate, async (req, res) => {
	const task = await taskService.findById(req.params.id);

	// Check that the authenticated user owns this resource
	if (task.ownerId !== req.user.id) {
		return res.status(403).json({
			error: { code: 'FORBIDDEN', message: 'Not authorized to modify this task' }
		});
	}

	// Proceed with update
	const updated = await taskService.update(req.params.id, req.body);
	return res.json(updated);
});
```

### Security Misconfiguration

```typescript
import { cors } from "@elysia/cors";
import { Elysia } from "elysia";
import { elysiaHelmet } from "elysiajs-helmet";

const allowedOrigin = Bun.env.WEB_ORIGIN ?? "http://localhost:5173";

new Elysia()
	.use(elysiaHelmet(securityHeaderConfig))
	.use(
		cors({
			origin: allowedOrigin,
			methods: corsAllowedMethods,
			allowedHeaders: corsAllowedHeaders,
			credentials: true,
		}),
	)
	.onAfterHandle(removeRejectedOriginCredentials(allowedOrigin));
```

Keep CORS origin allowlists explicit. Elysia CORS defaults can allow broad sharing, and Vite warns that `server.cors: true` or `server.allowedHosts: true` can expose source through DNS rebinding. If credentials are enabled, never allow wildcard origins.

### Sensitive Data Exposure

```typescript
// Never return sensitive fields in API responses
function sanitizeUser(user: UserRecord): PublicUser {
	const { passwordHash, resetToken, ...publicFields } = user;
	return publicFields;
}

// Use environment variables for secrets
const API_KEY = Bun.env.STRIPE_API_KEY;
if (!API_KEY) throw new Error('STRIPE_API_KEY not configured');
```

For Vite client code, never put secrets in variables prefixed with `VITE_`; Vite bundles `VITE_*` values into client-side source at build time. Put secret-backed operations behind the Elysia API instead.

### Server-Side Request Forgery (SSRF)

Any time the server fetches a URL the user influenced — webhooks, "import from URL", image proxies, link previews — an attacker can aim it at internal services (cloud metadata, `localhost`, private IPs).

```typescript
// BAD: fetch whatever the user gives you
await fetch(req.body.webhookUrl);

// GOOD: construct outbound targets from a fixed allowlist, not arbitrary input
const allowedWebhookOrigins = new Set(["https://hooks.example.com"]);
const allowedWebhookPaths = new Set(["/arrtemplar/events"]);

function assertAllowedWebhookUrl(raw: string): URL {
	const url = new URL(raw);

	if (url.protocol !== "https:") throw new Error("https only");
	if (!allowedWebhookOrigins.has(url.origin)) throw new Error("origin not allowed");
	if (!allowedWebhookPaths.has(url.pathname)) throw new Error("path not allowed");
	if (url.username || url.password) throw new Error("credentials in URL are not allowed");

	for (const param of url.searchParams.keys()) {
		if (!new Set(["eventId"]).has(param)) throw new Error("query parameter not allowed");
	}

	return url;
}

await fetch(assertAllowedWebhookUrl(req.body.webhookUrl), {
	method: "POST",
	redirect: "error",
	signal: AbortSignal.timeout(5_000),
});
```

Do not implement a generic "fetch any URL" feature in app code. Bun `fetch()` supports `http:`, `https:`, `file:`, `data:`, `blob:`, and `s3:` style inputs, plus proxy and Unix socket options; that is useful, but it increases SSRF blast radius if any part is user-controlled. OWASP's safest SSRF pattern is a strict allowlist for trusted integrations. For arbitrary URL fetches, require explicit human approval and use network-level egress filtering or a dedicated SSRF-filtering proxy; URL parsing alone is not enough to stop DNS rebinding or internal metadata access.

## Input Validation Patterns

### Schema Validation at Boundaries

```typescript
import { Elysia, t } from "elysia";

const CreateTaskBody = t.Object({
	title: t.String({ minLength: 1, maxLength: 200 }),
	description: t.Optional(t.String({ maxLength: 2_000 })),
	priority: t.UnionEnum(["low", "medium", "high"]),
});

new Elysia().post(
	"/api/tasks",
	async ({ body, status }) => {
		const task = await taskService.create(body);
		return status(201, task);
	},
	{
		body: CreateTaskBody,
		response: {
			201: t.Object({ id: t.String(), title: t.String() }),
		},
	},
);
```

Elysia route schemas validate `body`, `query`, `params`, `headers`, `cookie`, and `response` at the boundary, infer TypeScript types, and generate OpenAPI schema from one source of truth. Use `guard()` for shared validation across groups of routes, and keep error responses generic so validation failures do not expose internal details.

### File Upload Safety

```typescript
import { Elysia, t } from "elysia";

new Elysia().post(
	"/api/profile/avatar",
	({ body }) => saveAvatar(body.avatar),
	{
		body: t.Object({
			avatar: t.File({ maxSize: "5m" }),
		}),
	},
);
```

Use Elysia `t.File()` / `t.Files()` for file upload schemas, cap file size, restrict expected media types, and validate content by magic number when type matters. Do not trust client-provided extensions or `Content-Type` alone.

## Triaging `bun audit` Results

Not all audit findings require immediate action. Use this decision tree:

```
bun audit reports a vulnerability
├── Severity: critical or high
│   ├── Is the vulnerable code reachable in your app?
│   │   ├── YES --> Fix immediately (update, patch, or replace the dependency)
│   │   └── NO (dev-only dep, unused code path) --> Fix soon, but not a blocker
│   └── Is a fix available?
│       ├── YES --> Update to the patched version
│       └── NO --> Check for workarounds, consider replacing the dependency, or add to allowlist with a review date
├── Severity: moderate
│   ├── Reachable in production? --> Fix in the next release cycle
│   └── Dev-only? --> Fix when convenient, track in backlog
└── Severity: low
		└── Track and fix during regular dependency updates
```

**Key questions:**
- Is the vulnerable function actually called in your code path?
- Is the dependency a runtime dependency or dev-only?
- Is the vulnerability exploitable given your deployment context (e.g., a server-side vulnerability in a client-only app)?
- Does `bun audit --prod` still report it after excluding dev-only dependencies?
- Is the package from the default npm registry? Bun skips packages installed from registries other than the default registry during `bun audit`.

When you defer a fix, document the reason and set a review date.

### Supply-Chain Hygiene

`bun audit` catches known vulnerabilities; it won't catch every malicious, compromised, or typosquatted package. Also:

- **Commit `bun.lock`** and install with `bun ci` or `bun install --frozen-lockfile` in CI — reproducible builds, no silent version drift.
- **Review new dependencies before adding them** — maintenance, download counts, and whether they truly earn their place. Every dependency is attack surface (OWASP **A06: Vulnerable Components**, **LLM03: Supply Chain**).
- **Keep Bun's lifecycle-script protections intact** — Bun does not run arbitrary dependency lifecycle scripts unless a package is listed in `trustedDependencies`; only add trusted packages after review.
- **Use `minimumReleaseAge`** in `bunfig.toml` for hardened install paths so brand-new package versions are filtered during resolution.
- **Use Bun's security scanner API** when an approved scanner is configured; scanners can fail installs on fatal findings and automatically disable auto-install for security.
- **Watch for typosquats** — `cross-env` vs `crossenv`, `react-dom` vs `reactdom`.

## Rate Limiting

```typescript
const loginRateLimiter = new LoginRateLimiter(5, 15 * 60 * 1000);

new Elysia().post("/api/auth/login", ({ body, request, status }) => {
	const key = deriveLoginRateLimitKey(request, body.email);

	if (loginRateLimiter.isBlocked(key)) {
		return status(429, {
			error: { code: "RATE_LIMITED", message: "Too many login attempts." },
		});
	}

	// On failed login: loginRateLimiter.recordFailure(key)
	// On successful login: loginRateLimiter.clear(key)
});
```

Keep authentication limits stricter than general API limits. If adopting an Elysia rate-limit plugin for broader API throttling, review its storage model and proxy handling first. Only trust `X-Forwarded-*`, `CF-Connecting-IP`, or similar headers after the deployment restricts inbound traffic to the trusted proxy; otherwise use the direct client IP.

## Secrets Management

```
.env files:
	├── .env.example  → Committed (template with placeholder values)
	├── .env          → NOT committed (contains real secrets)
	└── .env.local    → NOT committed (local overrides)

.gitignore must include:
	.env
	.env.local
	.env.*.local
	*.pem
	*.key
```

Bun automatically loads `.env`, mode-specific `.env.*`, and `.env.local` files unless disabled with `--no-env-file` or `env = false` in `bunfig.toml`. In production and CI, prefer explicit system environment variables and avoid automatic local `.env` loading. Vite also loads `.env` files, but only `VITE_*` variables are available to browser code; never prefix secrets with `VITE_`.

Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0`, `tls.rejectUnauthorized: false`, `BUN_CONFIG_VERBOSE_FETCH`, or `fetch({ verbose: true })` in production. These settings can weaken TLS validation or leak headers and URLs into logs.

**Always check before committing:**
```bash
# Check for accidentally staged secrets
git diff --cached | grep -i "password\|secret\|api_key\|token"
```

**If a secret is ever committed, rotate it.** Deleting the line or rewriting history is not enough — assume it's compromised the moment it reaches a remote. Revoke and reissue the key first, then purge it from history.

## Securing AI / LLM Features

If your app calls an LLM — chatbots, summarizers, agents, RAG — it inherits a new attack surface. Map it to the [OWASP Top 10 for LLM Applications (2025)](https://genai.owasp.org/llm-top-10/):

- **Treat all model output as untrusted input (LLM05: Improper Output Handling).** Never pass LLM output straight into `eval`, SQL, a shell, `innerHTML`, or a file path. Validate and encode it exactly as you would raw user input.
- **Assume prompts can be hijacked (LLM01: Prompt Injection).** Untrusted text in the context window — a user message, a fetched web page, a PDF — can carry instructions. The system prompt is not a security boundary; enforce permissions in code, not in the prompt.
- **Keep secrets and other users' data out of prompts (LLM02 / LLM07).** Anything in the context can be echoed back. Don't put API keys, cross-tenant data, or the full system prompt where the model can repeat it.
- **Constrain tool and agent permissions (LLM06: Excessive Agency).** Scope tools to the minimum, require confirmation for destructive or irreversible actions, and validate every tool argument.
- **Bound consumption (LLM10: Unbounded Consumption).** Cap tokens, request rate, and loop/recursion depth so a crafted input can't run up cost or hang the system.
- **Isolate retrieval data (LLM08: Vector and Embedding Weaknesses).** In RAG, treat the vector store as a trust boundary: partition embeddings per tenant so one user can't retrieve another's data, and validate documents before indexing so poisoned content can't steer answers.

```typescript
// BAD: trusting model output as a command or as markup
const sql = await llm.generate(`Write SQL for: ${userQuestion}`);
await db.query(sql);                                   // arbitrary query execution
container.innerHTML = await llm.reply(userMessage);   // stored XSS, via the model

// GOOD: model output is data — parse defensively, then validate, then encode
const intent = await parseAndValidateModelIntent(await llm.replyJson(userMessage));
await runAllowlistedAction(intent.action, intent.params);
container.textContent = await llm.reply(userMessage);
```

For route inputs that include model output, validate with Elysia `t` / TypeBox at the API boundary. For non-route model output, parse JSON defensively, validate against an explicit allowlist schema, and reject unknown actions or parameters. If a model output influences a Bun Shell command, remember that Bun Shell escapes interpolated strings by default but cannot prevent argument injection against the target program; validate allowed commands and flags before execution.

## Security Review Checklist

```markdown
### Authentication
- [ ] Passwords hashed and verified with async `Bun.password` Argon2id APIs
- [ ] Session tokens are httpOnly, secure, sameSite
- [ ] Login has rate limiting
- [ ] Password reset tokens expire

### Authorization
- [ ] Every endpoint checks user permissions
- [ ] Users can only access their own resources
- [ ] Admin actions require admin role verification

### Input
- [ ] All user input validated at Elysia route boundaries with `t` / TypeBox
- [ ] SQL queries are parameterized
- [ ] HTML output is encoded/escaped
- [ ] Server-side URL fetches are allowlisted (no SSRF to internal services)

### Data
- [ ] No secrets in code or version control
- [ ] Sensitive fields excluded from API responses
- [ ] PII encrypted at rest (if applicable)

### Infrastructure
- [ ] `elysiajs-helmet` security headers configured (CSP, HSTS, frame, referrer, CORP, COOP, permissions policy)
- [ ] `@elysia/cors` restricted to known origins; no wildcard credentials
- [ ] Vite dev/preview `allowedHosts` and `cors` are explicit, never `true`
- [ ] Dependencies audited with `bun audit` / `bun audit --prod`
- [ ] Error messages don't expose internals

### Supply Chain
- [ ] `bun.lock` committed; CI installs with `bun ci` or `bun install --frozen-lockfile`
- [ ] New dependencies reviewed before `bun add`
- [ ] `trustedDependencies` entries reviewed and justified
- [ ] Bun security scanner / `minimumReleaseAge` considered for release pipelines

### AI / LLM (if used)
- [ ] Model output treated as untrusted (no eval/SQL/innerHTML/shell)
- [ ] Secrets and other users' data kept out of prompts
- [ ] Tool/agent permissions scoped; destructive actions require confirmation
```

## See Also

For detailed security checklists and pre-commit verification steps, see `references/security-checklist.md`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "This is an internal tool, security doesn't matter" | Internal tools get compromised. Attackers target the weakest link. |
| "We'll add security later" | Security retrofitting is 10x harder than building it in. Add it now. |
| "No one would try to exploit this" | Automated scanners will find it. Security by obscurity is not security. |
| "The framework handles security" | Frameworks provide tools, not guarantees. You still need to use them correctly. |
| "It's just a prototype" | Prototypes become production. Security habits from day one. |
| "Threat modeling is overkill here" | Five minutes of "how would I attack this?" prevents the design flaws no control can patch later. |
| "It's just LLM output, it's only text" | That "text" can be a SQL statement, a script tag, or a shell command. Treat it like any untrusted input. |

## Red Flags

- User input passed directly to database queries, shell commands, or HTML rendering
- Secrets in source code or commit history
- API endpoints without authentication or authorization checks
- Missing CORS configuration or wildcard (`*`) origins
- No rate limiting on authentication endpoints
- Stack traces or internal errors exposed to users
- Dependencies with known critical vulnerabilities
- Server fetches user-supplied URLs without an allowlist (SSRF)
- LLM/model output passed into a query, the DOM, a shell, or `eval`
- Secrets, PII, or the full system prompt placed inside an LLM context window
- `VITE_*` variables containing API keys, tokens, database URLs, or private service URLs
- Vite `server.allowedHosts: true`, `server.cors: true`, or broad `/@fs/` access
- `Bun.CSRF.generate()` without an explicit production secret and session binding
- `Bun Shell` commands that start `bash -c` or pass unvalidated user-controlled flags to external programs
