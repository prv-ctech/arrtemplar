---
name: "Agent Runtime Behavior"
description: "Use on every session. Enforces single-instance bun dev management (reuse the existing terminal, never spawn duplicates) and requires reading admin credentials from .secrets/credentials.txt instead of guessing."
applyTo: "**"
---

## 🖥️ Single-Instance `bun dev` — Reuse the Existing Terminal

There must only ever be **one** running `bun dev` process. Running it multiple times opens duplicate ports and app instances, which we do not want.

Before starting the dev server:

1. **Check every existing terminal first.** If a terminal is already hosting `bun dev`, reuse it. Do **not** open a new terminal to run `bun dev` again.
2. If the app **crashes** or needs a **full restart**, stop the `bun dev` process in the terminal that is already running it, then start it again **in that same terminal**.
3. Only start `bun dev` in a new terminal when **no** existing terminal is running it.
4. Never leave a crashed or stale `bun dev` running alongside a freshly started one. Close the old one before (or instead of) starting a new one.

Rule of thumb: one `bun dev`, one terminal. Reuse, don't duplicate.

---

## 🔐 Login Credentials — Read `.secrets/credentials.txt`, Never Assume

When logging into the app, the admin credentials live in `.secrets/credentials.txt`.

- **Always read `.secrets/credentials.txt`** to get the username and password before logging in.
- **NEVER assume** you know the credentials, the username, or the password.
- **NEVER** hardcode, reuse from memory, or guess credentials — read the file every time login is required.
- Do not log, print, or expose the credentials beyond what is strictly needed to perform the login.
