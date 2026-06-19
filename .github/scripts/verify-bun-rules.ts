import { Glob } from "bun";

/**
 * Bun-Native Compliance Verification Script
 *
 * Scans the codebase for patterns that violate Bun-native philosophy.
 * Enforces a strict boundary between Browser (src/app) and Server code.
 * Platform-agnostic (Windows/Linux) path handling.
 */

interface ViolationResult {
  file: string;
  rule: string;
  count: number;
  suggestion: string;
  severity: string;
}

interface Rule {
  name: string;
  pattern: RegExp;
  suggestion: string;
  severity: "error" | "warning" | "info";
  scope?: "server" | "browser" | "all";
  excludePaths?: string[]; // Relative to project root
  allowPaths?: string[]; // Relative to project root
}

const RULES: Rule[] = [
  // ═══════════════════════════════════════════════════════════
  // Core Runtime — applies everywhere
  // ═══════════════════════════════════════════════════════════
  {
    name: "Node fs read/write helpers",
    pattern:
      /(import\s*\{[^}]*\b(readFile|readFileSync|writeFile|writeFileSync|existsSync|mkdirSync|mkdir|rmSync|rm|readdirSync|readdir|cpSync|cp)\b[^}]*\}\s*from\s*["'](?:node:)?fs(?:\/promises)?["']|\bfs\.(readFile|readFileSync|writeFile|writeFileSync|existsSync|mkdirSync|mkdir|rmSync|rm|readdirSync|readdir|cpSync|cp)\b|from\s+["'](?:node:)?fs\/promises["']|import\(\s*["'](?:node:)?fs(?:\/promises)?["']\s*\)|require\(\s*["'](?:node:)?fs(?:\/promises)?["']\s*\))(?![\s;]*\/\/\s*verify-ignore)/g,
    suggestion:
      "Use Bun.file() and Bun.write() in server/tooling code unless a missing fs feature is truly required.",
    severity: "error",
    scope: "all",
  },
  {
    name: "child_process import",
    pattern:
      /(from\s+["'](?:node:)?child_process["']|import\(\s*["'](?:node:)?child_process["']\s*\)|require\(\s*["'](?:node:)?child_process["']\s*\))(?![\s;]*\/\/\s*verify-ignore)/g,
    suggestion: "Use Bun.spawn() or Bun Shell ($) instead of child_process in repo code.",
    severity: "error",
    scope: "all",
  },
  {
    name: "require() usage",
    pattern: /\brequire\s*\((?!\s*["'](node:|bun:|@\/))(?![\s;]*\/\/\s*verify-ignore)/g,
    suggestion: "Use ESM imports instead.",
    severity: "error",
    scope: "all",
  },
  {
    name: "Unapproved Bun SQLite usage",
    pattern: /(from\s+["']bun:sqlite["']|new\s+Database\s*\()(?![\s;]*\/\/\s*verify-ignore)/g,
    suggestion:
      "Keep Bun SQLite usage centralized in apps/server/src/db; do not create ad-hoc SQLite clients elsewhere.",
    severity: "error",
    scope: "all",
    allowPaths: ["apps/server/src/db/"],
  },
  {
    name: "Bun SQL usage",
    pattern: /(\bBun\.sql\b|\bBun\.SQL\b|from\s+["']bun:sql["'])(?![\s;]*\/\/\s*verify-ignore)/g,
    suggestion: "Do not use Bun.sql, Bun.SQL, or bun:sql for app data; keep database access on Drizzle + Bun SQLite.",
    severity: "error",
    scope: "all",
  },

  // ═══════════════════════════════════════════════════════════
  // Server-only mandatory replacements
  // ═══════════════════════════════════════════════════════════
  {
    name: "process.env usage",
    pattern: /process\.env\b(?![\s;]*\/\/\s*verify-ignore)/g,
    suggestion:
      "Use Bun.env in server and tooling code. Reserve process.env for test setup or compatibility-only cases.",
    severity: "error",
    scope: "server",
  },
  {
    name: "bcrypt or argon2 package usage",
    pattern:
      /(from\s+["'](?:bcrypt|bcryptjs|argon2)["']|import\(\s*["'](?:bcrypt|bcryptjs|argon2)["']\s*\)|require\(\s*["'](?:bcrypt|bcryptjs|argon2)["']\s*\))(?![\s;]*\/\/\s*verify-ignore)/g,
    suggestion:
      "Use Bun.password.hash() and Bun.password.verify() for server-side password hashing.",
    severity: "error",
    scope: "server",
  },
  {
    name: "External Redis client usage",
    pattern:
      /(from\s+["'](?:redis|ioredis|iovalkey|@valkey\/valkey)["']|import\(\s*["'](?:redis|ioredis|iovalkey|@valkey\/valkey)["']\s*\)|require\(\s*["'](?:redis|ioredis|iovalkey|@valkey\/valkey)["']\s*\))(?![\s;]*\/\/\s*verify-ignore)/g,
    suggestion: "Use Bun's RedisClient for Valkey integration in this repo.",
    severity: "warning",
    scope: "server",
  },

  // ═══════════════════════════════════════════════════════════
  // Elysia boundary — Bun server APIs must not replace Elysia
  // ═══════════════════════════════════════════════════════════
  {
    name: "Bun.serve in App Runtime",
    pattern: /\bBun\.serve\s*\((?!\s*\/\/\s*verify-ignore)/g,
    suggestion:
      "Elysia is the HTTP backbone. Bun.serve() is only for isolated test probes, not app server implementation.",
    severity: "error",
    scope: "server",
  },
  {
    name: "Bun WebSocket server in App Runtime",
    pattern: /websocket:\s*\{[^}]*\b(message|open|close)\b(?!\s*\/\/\s*verify-ignore)/gs,
    suggestion:
      "Elysia handles all WebSocket server routes. Do not use Bun.serve({websocket}) for app WebSocket logic.",
    severity: "error",
    scope: "server",
    excludePaths: ["tests/", ".agents", ".agent"],
  },

  // ═══════════════════════════════════════════════════════════
  // Server-side Bun-native replacements (warnings)
  // ═══════════════════════════════════════════════════════════
  {
    name: "setTimeout in Server",
    pattern: /\bsetTimeout\s*\((?!\s*\/\/\s*verify-ignore)/g,
    suggestion: "Use await Bun.sleep(ms) for cleaner, promise-native async delays.",
    severity: "warning",
    scope: "server",
  },
  {
    name: "crypto.randomUUID in Server",
    pattern: /crypto\.randomUUID\s*\(\)(?!\s*\/\/\s*verify-ignore)/g,
    suggestion: "Use Bun.randomUUIDv7() for faster, time-sortable UUIDs.",
    severity: "warning",
    scope: "server",
  },

  // ═══════════════════════════════════════════════════════════
  // External packages with Bun-native replacements
  // ═══════════════════════════════════════════════════════════
  {
    name: "External dotenv package",
    pattern:
      /(from\s+["'](?:dotenv|dotenv-expand)["']|import\(\s*["'](?:dotenv|dotenv-expand)["']\s*\)|require\(\s*["'](?:dotenv|dotenv-expand)["']\s*\))(?!\s*\/\/\s*verify-ignore)/g,
    suggestion:
      "Bun automatically loads .env files with expansion support. Remove dotenv/dotenv-expand.",
    severity: "warning",
    scope: "server",
  },
  {
    name: "External YAML parser",
    pattern:
      /(from\s+["'](?:js-yaml|yaml|yamljs)["']|import\(\s*["'](?:js-yaml|yaml|yamljs)["']\s*\)|require\(\s*["'](?:js-yaml|yaml|yamljs)["']\s*\))(?!\s*\/\/\s*verify-ignore)/g,
    suggestion:
      "Use Bun.YAML.parse() or import YAML files directly (import config from './file.yaml').",
    severity: "warning",
    scope: "server",
  },
  {
    name: "External TOML parser",
    pattern:
      /(from\s+["'](?:toml|smol-toml|@iarna\/toml)["']|import\(\s*["'](?:toml|smol-toml|@iarna\/toml)["']\s*\)|require\(\s*["'](?:toml|smol-toml|@iarna\/toml)["']\s*\))(?!\s*\/\/\s*verify-ignore)/g,
    suggestion:
      "Use Bun.TOML.parse() or import TOML files directly (import config from './file.toml').",
    severity: "warning",
    scope: "server",
  },
  {
    name: "External JSON5 parser",
    pattern:
      /(from\s+["']json5["']|import\(\s*["']json5["']\s*\)|require\(\s*["']json5["']\s*\))(?!\s*\/\/\s*verify-ignore)/g,
    suggestion:
      "Use Bun.JSON5.parse() or import JSON5 files directly (import config from './file.json5').",
    severity: "warning",
    scope: "server",
  },
  {
    name: "External Markdown parser",
    pattern:
      /(from\s+["'](?:marked|markdown-it|remark|rehype)["']|import\(\s*["'](?:marked|markdown-it|remark|rehype)["']\s*\)|require\(\s*["'](?:marked|markdown-it|remark|rehype)["']\s*\))(?!\s*\/\/\s*verify-ignore)/g,
    suggestion:
      "Use Bun.markdown.html(), Bun.markdown.ansi(), or Bun.markdown.render() for Markdown processing in server code.",
    severity: "warning",
    scope: "server",
  },
  {
    name: "External semver package",
    pattern:
      /(from\s+["']semver["']|import\(\s*["']semver["']\s*\)|require\(\s*["']semver["']\s*\))(?!\s*\/\/\s*verify-ignore)/g,
    suggestion: "Use Bun.semver.satisfies() and Bun.semver.order() (~20x faster than node-semver).",
    severity: "warning",
    scope: "server",
  },
  {
    name: "External glob package",
    pattern:
      /(from\s+["'](?:glob|fast-glob|globby)["']|import\(\s*["'](?:glob|fast-glob|globby)["']\s*\)|require\(\s*["'](?:glob|fast-glob|globby)["']\s*\))(?!\s*\/\/\s*verify-ignore)/g,
    suggestion:
      "Use Bun.Glob for file pattern matching (import { Glob } from 'bun'; new Glob('**/*.ts').scan()).",
    severity: "warning",
    scope: "server",
  },
  {
    name: "External string-width or strip-ansi",
    pattern:
      /(from\s+["'](?:string-width|strip-ansi|ansi-regex|wrap-ansi|slice-ansi|cli-truncate)["']|import\(\s*["'](?:string-width|strip-ansi|ansi-regex|wrap-ansi|slice-ansi|cli-truncate)["']\s*\))(?!\s*\/\/\s*verify-ignore)/g,
    suggestion:
      "Use Bun.stringWidth(), Bun.stripANSI(), Bun.wrapAnsi(), or Bun.sliceAnsi() (6-6756x faster).",
    severity: "warning",
    scope: "server",
  },
  {
    name: "External CSRF package",
    pattern:
      /(from\s+["'](?:csurf|csrf|@fastify\/csrf)["']|import\(\s*["'](?:csurf|csrf|@fastify\/csrf)["']\s*\))(?!\s*\/\/\s*verify-ignore)/g,
    suggestion: "Use Bun.CSRF.generate() and Bun.CSRF.verify() for CSRF token handling.",
    severity: "warning",
    scope: "server",
  },
  {
    name: "node:zlib for compression",
    pattern:
      /(from\s+["'](?:node:)?zlib["']|import\(\s*["'](?:node:)?zlib["']\s*\)|require\(\s*["'](?:node:)?zlib["']\s*\))(?!\s*\/\/\s*verify-ignore)/g,
    suggestion:
      "Use Bun.gzipSync()/Bun.gunzipSync() or Bun.zstdCompress()/Bun.zstdDecompress() (up to 5.5x faster via zlib-ng).",
    severity: "warning",
    scope: "server",
  },
  {
    name: "External color package",
    pattern:
      /(from\s+["'](?:color|tinycolor2|chroma-js)["']|import\(\s*["'](?:color|tinycolor2|chroma-js)["']\s*\)|require\(\s*["'](?:color|tinycolor2|chroma-js)["']\s*\))(?!\s*\/\/\s*verify-ignore)/g,
    suggestion:
      "Use Bun.color(input, format) for color conversion. Supports CSS, ANSI, hex, RGB, HSL, and more.",
    severity: "warning",
    scope: "server",
  },

  // ═══════════════════════════════════════════════════════════
  // Browser boundary (src/app)
  // ═══════════════════════════════════════════════════════════
  {
    name: "Bun API in Browser",
    pattern: /(\bBun\.\w+\b|from\s+["']bun["']|from\s+["']bun:.*["'])(?!\s*\/\/\s*verify-ignore)/g,
    suggestion: "DO NOT use Bun APIs in the browser. Use standard Web APIs (fetch, setTimeout).",
    severity: "error",
    scope: "browser",
  },

  // ═══════════════════════════════════════════════════════════
  // Database & Storage
  // ═══════════════════════════════════════════════════════════
  {
    name: "Prisma usage",
    pattern: /PrismaClient|prisma\./g,
    suggestion: "Project has migrated to Drizzle ORM. Remove legacy Prisma references.",
    severity: "error",
    scope: "all",
    excludePaths: ["docs", ".agent", ".agents"],
  },
];

const EXCLUDES = [
  "node_modules",
  "dist",
  "apps/server/dist",
  "apps/web/dist",
  ".git",
  ".agents",
  ".github/scripts/verify-bun-rules.ts",
  "docs/verify-bun-rules.ts",
  "verify_output.txt",
  "public",
];

function isExcludedPath(normalizedFile: string): boolean {
  return (
    EXCLUDES.some((exclude) => normalizedFile === exclude || normalizedFile.startsWith(`${exclude}/`)) ||
    normalizedFile.includes("/dist/")
  );
}

async function verify() {
  console.log("\x1b[36m%s\x1b[0m", "🔍 Verifying Bun-Native Compliance...");

  const results: ViolationResult[] = [];
  const glob = new Glob("**/*.{ts,tsx,js,jsx}");
  const files = await Array.fromAsync(glob.scan({ cwd: ".", onlyFiles: true }));

  for (const file of files) {
    const normalizedFile = file.replace(/\\/g, "/");
    if (isExcludedPath(normalizedFile)) continue;

    const isBrowser = normalizedFile.startsWith("apps/web/src/") || normalizedFile.startsWith("src/app/");
    const isTest = normalizedFile.startsWith("test/") || normalizedFile.includes(".test.");
    const isScript =
      normalizedFile.startsWith("scripts/") ||
      normalizedFile.startsWith(".github/scripts/") ||
      normalizedFile === "dev.ts";
    const isServer =
      !isBrowser &&
      !isTest &&
      (normalizedFile.startsWith("apps/server/src/") || normalizedFile.startsWith("src/") || isScript);

    const content = await Bun.file(file).text();

    for (const rule of RULES) {
      // Check scope
      if (rule.scope === "browser" && !isBrowser) continue;
      if (rule.scope === "server" && !isServer) continue; // Only server code gets strict bun replacements

      // Skip excluded paths for specific rules
      if (rule.excludePaths?.some((p) => normalizedFile.includes(p))) continue;
      if (rule.allowPaths?.some((p) => normalizedFile.startsWith(p))) continue;

      const matches = content.match(rule.pattern);
      if (matches) {
        // Tests may intentionally use Node compatibility or process.env for setup.
        let severity = rule.severity;
        if (isTest && rule.name === "process.env usage") severity = "info";
        if (isTest && severity === "error") severity = "warning";

        results.push({
          file: normalizedFile,
          rule: rule.name,
          count: matches.length,
          suggestion: rule.suggestion,
          severity: severity,
        });
      }
    }
  }

  if (results.length === 0) {
    console.log("\n\x1b[32m%s\x1b[0m", "✅ All Bun-Native rules respected!");
    process.exit(0);
  }

  // Sort and display
  const errors = results.filter((r) => r.severity === "error");
  const warnings = results.filter((r) => r.severity === "warning");
  const infos = results.filter((r) => r.severity === "info");

  if (errors.length > 0) {
    console.log(
      "\n\x1b[31m%s\x1b[0m",
      `❌ FAILED: ${errors.length} Architectural Violations Found`
    );
    for (const err of errors) {
      console.log(`  [ERROR] ${err.file}: ${err.rule} (${err.count} matches)`);
      console.log(`    💡 ${err.suggestion}\n`);
    }
  }

  if (warnings.length > 0) {
    console.log("\x1b[33m%s\x1b[0m", `⚠️ WARNING: ${warnings.length} Optimization Suggestions`);
    for (const warn of warnings) {
      console.log(`  [WARN] ${warn.file}: ${warn.rule} (${warn.count} matches)`);
      console.log(`    💡 ${warn.suggestion}\n`);
    }
  }

  if (infos.length > 0) {
    console.log("\x1b[34m%s\x1b[0m", `ℹ️ INFO: ${infos.length} Minor Notes`);
    for (const info of infos) {
      console.log(`  [INFO] ${info.file}: ${info.rule} (${info.count} matches)`);
    }
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

verify().catch(console.error);
