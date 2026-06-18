export const devServerAllowedHosts = [
  "localhost",
  ".localhost",
  "127.0.0.1",
  "[::1]",
  ".github.dev",
  ".app.github.dev",
];

export const devServerAllowedOrigins = [
  /^https?:\/\/localhost(?::\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?$/,
  /^https?:\/\/\[::1\](?::\d+)?$/,
  /^https:\/\/.*\.github\.dev$/,
  /^https:\/\/.*\.app\.github\.dev$/,
];

export const devServerDenyFiles = [
  ".env",
  ".env.*",
  "*.{crt,pem}",
  "*.key",
  "**/.git/**",
  "**/*.sqlite",
  "**/*.sqlite-shm",
  "**/*.sqlite-wal",
];
