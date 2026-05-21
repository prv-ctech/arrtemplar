# Suwayomi fork baseline verification

Date: 2026-05-18

## Scope

Task 1 from `docs/plans/suwayomi-minimal-fork-2026-05-18-plan.md` created the fork baseline and evidence record only. No Arrweeb runtime code was modified.

Task 2 updated the fork defaults to local-only headless source-runner mode and added a generated-config regression test. No Arrweeb runtime code was modified.

Task 3 made KCEF/WebView explicitly opt-in, disabled the WebView endpoint when the setting is false, and verified that a default headless smoke run no longer downloads or initializes KCEF/JCEF. No Arrweeb runtime code was modified.

## Fork target and pin

- Fork target/name: `arrweeb-suwayomi-source-runner`
- Local clone path: `/workspaces/arrweeb-suwayomi-source-runner`
- Baseline branch: `arrweeb/source-runner-baseline`
- Upstream repository: `https://github.com/Suwayomi/Suwayomi-Server.git`
- Upstream commit pin: `c0618fcc5cf8540129760cf709d0cc857bea11e1`
- Upstream short commit: `c0618fc`
- Upstream commit date: `2026-05-18T14:17:52-04:00`
- Upstream commit subject: `Try to keep cached images usable on manga rename (#2052)`
- Fork files touched for baseline metadata:
  - `/workspaces/arrweeb-suwayomi-source-runner/README.md`
  - `/workspaces/arrweeb-suwayomi-source-runner/CONTRIBUTING.md`
- Fork files touched for Task 2:
  - `/workspaces/arrweeb-suwayomi-source-runner/server/server-config/src/main/kotlin/suwayomi/tachidesk/server/ServerConfig.kt`
  - `/workspaces/arrweeb-suwayomi-source-runner/server/src/test/kotlin/suwayomi/tachidesk/server/SourceRunnerDefaultConfigTest.kt`
  - `/workspaces/arrweeb-suwayomi-source-runner/docs/Configuring-Suwayomi‐Server.md`
- Fork files touched for Task 3:
  - `/workspaces/arrweeb-suwayomi-source-runner/server/server-config/src/main/kotlin/suwayomi/tachidesk/server/ServerConfig.kt`
  - `/workspaces/arrweeb-suwayomi-source-runner/server/src/main/kotlin/suwayomi/tachidesk/server/ServerSetup.kt`
  - `/workspaces/arrweeb-suwayomi-source-runner/server/src/main/kotlin/suwayomi/tachidesk/global/controller/WebViewController.kt`
  - `/workspaces/arrweeb-suwayomi-source-runner/AndroidCompat/src/main/java/xyz/nulldev/androidcompat/AndroidCompatInitializer.kt`
  - `/workspaces/arrweeb-suwayomi-source-runner/server/src/test/kotlin/suwayomi/tachidesk/global/controller/WebViewControllerTest.kt`
  - `/workspaces/arrweeb-suwayomi-source-runner/server/src/test/kotlin/suwayomi/tachidesk/server/KcefRuntimeSetupTest.kt`
  - `/workspaces/arrweeb-suwayomi-source-runner/server/src/test/kotlin/suwayomi/tachidesk/server/SourceRunnerDefaultConfigTest.kt`
  - `/workspaces/arrweeb-suwayomi-source-runner/server/src/test/kotlin/suwayomi/tachidesk/test/ApplicationTest.kt`
  - `/workspaces/arrweeb-suwayomi-source-runner/docs/Configuring-Suwayomi‐Server.md`
- Fork `LICENSE` status: preserved from upstream unchanged.

## License obligations

Suwayomi-Server is licensed under MPL-2.0. The upstream README also credits Apache-2.0 portions adopted from Mihon/Tachiyomi and Android compatibility code.

Arrweeb fork obligations recorded for this baseline:

- Preserve Suwayomi's MPL-2.0 `LICENSE` file and upstream copyright/license notices.
- Do not remove or alter license notices except for factual corrections permitted by MPL-2.0.
- If distributing an executable fork artifact, make the MPL-covered source form and Arrweeb modifications available by reasonable means.
- Keep Apache-2.0 attributions for adopted Mihon/Tachiyomi and Android compatibility portions.
- Track changed fork source files in future release evidence so source-availability obligations are easy to satisfy.

## Environment

- OS: Debian GNU/Linux 13 (trixie) x86_64
- Kernel/runtime host line from Gradle: Linux `6.6.87.2-microsoft-standard-WSL2` amd64
- Git: `git version 2.47.3`
- Java runtime: `openjdk version "21.0.11" 2026-04-21`
- Javac: `javac 21.0.11`
- Gradle wrapper: Gradle `9.5.1`
- Gradle Kotlin: `2.3.20`
- Gradle Groovy: `4.0.29`
- Gradle Ant: `1.10.15`

## Source-driven build configuration note

The first clean `:server:shadowJar` attempt failed during `:server:compileKotlin` with `java.lang.OutOfMemoryError: GC overhead limit exceeded`. The container had available system memory, but the fork had no project or user `gradle.properties`; Gradle's documented default daemon heap is `-Xmx512m`, which was too small for this full Kotlin compile.

Authoritative docs checked:

- Gradle build environment docs: `https://docs.gradle.org/current/userguide/build_environment.html`
  - Documents `org.gradle.jvmargs` as the Gradle daemon JVM arguments and notes the default is `-Xmx512m`.
  - Documents `GRADLE_OPTS` as a way to pass `org.gradle.jvmargs` through an environment variable.
- Kotlin Gradle plugin compilation/cache docs: `https://kotlinlang.org/docs/gradle-compilation-and-caches.html`
  - Documents Kotlin daemon JVM argument configuration with `kotlin.daemon.jvm.options` and `kotlin.daemon.jvmargs`.

For this environment, the reproducible server-only jar build used:

```bash
GRADLE_OPTS='-Dorg.gradle.jvmargs=-Xmx3g -Dkotlin.daemon.jvm.options=-Xmx3g'
```

No Gradle build files were changed for Task 1.

## Verification commands and outputs

All commands below were run from `/workspaces/arrweeb-suwayomi-source-runner` unless otherwise noted.

### 1. Clone and pin

```bash
git clone https://github.com/Suwayomi/Suwayomi-Server.git arrweeb-suwayomi-source-runner
git checkout c0618fc
git switch -c arrweeb/source-runner-baseline
git remote rename origin upstream
git rev-parse HEAD
git show -s --format=%cI HEAD
git remote get-url upstream
```

Output evidence:

```txt
HEAD is now at c0618fcc Try to keep cached images usable on manga rename (#2052)
Branch: arrweeb/source-runner-baseline
Upstream remote: https://github.com/Suwayomi/Suwayomi-Server.git
HEAD: c0618fcc5cf8540129760cf709d0cc857bea11e1
Commit date: 2026-05-18T14:17:52-04:00
```

### 2. Generate server settings

```bash
./gradlew :server:server-config-generate:generateSettings --no-daemon
```

Result: passed.

Relevant output:

```txt
> Task :server:server-config-generate:generateSettings
Generating settings files from ServerConfig registry...
 - Total: 87
 - Deprecated: 10
 - Require restart: 2
Settings config file generated successfully! Total settings: 77
- Main config: /workspaces/arrweeb-suwayomi-source-runner/server/build/generated/src/main/resources/server-reference.conf
- Test config: /workspaces/arrweeb-suwayomi-source-runner/server/build/generated/src/test/resources/server-reference.conf
Graphql type generated successfully! Total settings: 87
BackupServerSettingsGenerator generated successfully! Total settings: 87
BackupServerSettings generated successfully! Total settings: 87
✅ Settings files generation completed successfully!
BUILD SUCCESSFUL in 26s
14 actionable tasks: 14 executed
```

### 3. Build server-only jar without WebUI.zip

Required command attempted first:

```bash
rm -f server/src/main/resources/WebUI.zip && ./gradlew :server:shadowJar --no-daemon -x test
```

First attempt result: failed in `:server:compileKotlin` due Kotlin compiler heap exhaustion.

Relevant output:

```txt
> Task :server:compileKotlin FAILED
e: java.lang.OutOfMemoryError: GC overhead limit exceeded
Execution failed for task ':server:compileKotlin' (registered by plugin 'org.jetbrains.kotlin.jvm').
> A failure occurred while executing org.jetbrains.kotlin.compilerRunner.btapi.BuildToolsApiCompilationWork
   > Not enough memory to run compilation. Try to increase it via 'gradle.properties':
     kotlin.daemon.jvmargs=-Xmx<size>
BUILD FAILED in 38s
```

Root-cause retry with documented heap settings:

```bash
rm -f server/src/main/resources/WebUI.zip && GRADLE_OPTS='-Dorg.gradle.jvmargs=-Xmx3g -Dkotlin.daemon.jvm.options=-Xmx3g' ./gradlew :server:shadowJar --no-daemon -x test
```

Result: passed.

Relevant output:

```txt
BUILD SUCCESSFUL in 44s
24 actionable tasks: 4 executed, 20 up-to-date
```

Artifact evidence:

```bash
ls -lh server/build/*.jar
sha256sum server/build/*.jar
jar tf server/build/*.jar | grep -c '^WebUI\.zip$'
```

Output:

```txt
-rw-r--r-- 1 root root 166M May 18 21:30 server/build/Suwayomi-Server-v2.2.2159.jar
a67278e453d355a327a0dd9c0f608d03cbaa66b2ed4da7f233a3c31ceab0d9a4  server/build/Suwayomi-Server-v2.2.2159.jar
0
```

Conclusion: the fork builds a server-only jar, and the jar contains no root `WebUI.zip` entry.

### 4. Headless local-only smoke run

Disposable smoke config was written to `/tmp/suwayomi-source-runner-smoke/server.conf`:

```hocon
server.ip = "127.0.0.1"
server.port = 14567
server.webUIEnabled = false
server.initialOpenInBrowserEnabled = false
server.systemTrayEnabled = false
server.authMode = NONE
server.extensionRepos = []
```

Startup command:

```bash
java -Dsuwayomi.tachidesk.config.server.rootDir=/tmp/suwayomi-source-runner-smoke -jar server/build/Suwayomi-Server-v2.2.2159.jar
```

Result: server started and bound to `127.0.0.1:14567`.

Relevant output:

```txt
21:31:37.260 [main] INFO suwayomi.tachidesk.server.ServerSetup -- Running Suwayomi-Server v2.2.2159
21:31:40.214 [main] INFO io.javalin.Javalin -- Listening on http://127.0.0.1:14567/
```

Headless flags used:

- `server.ip = "127.0.0.1"`
- `server.webUIEnabled = false`
- `server.initialOpenInBrowserEnabled = false`
- `server.systemTrayEnabled = false`
- `server.authMode = NONE`

### 5. GraphQL aboutServer smoke query

```bash
curl --fail-with-body -sS \
  -X POST http://127.0.0.1:14567/api/graphql \
  -H 'Content-Type: application/json' \
  --data '{"query":"{ aboutServer { name version revision buildType github } }"}'
```

Result: passed.

Output:

```json
{"data":{"aboutServer":{"name":"Suwayomi-Server","version":"v2.2.2159","revision":"r2159","buildType":"Preview","github":"https://github.com/Suwayomi/Suwayomi-Server"}}}
```

## Task 2 verification: local-only headless defaults

Task 2 changed fresh fork defaults so Arrweeb does not need to pass WebUI/browser/tray safety flags for normal source-runner startup.

Changed defaults:

- `server.ip`: `0.0.0.0` → `127.0.0.1`
- `server.webUIEnabled`: `true` → `false`
- `server.initialOpenInBrowserEnabled`: `true` → `false`
- `server.systemTrayEnabled`: `true` → `false`
- `server.port`: unchanged at `4567`, still configurable.

### 1. Generated-config regression test

Added `/workspaces/arrweeb-suwayomi-source-runner/server/src/test/kotlin/suwayomi/tachidesk/server/SourceRunnerDefaultConfigTest.kt`.

The test reads the generated `server-reference.conf` test resource and asserts the source-runner-safe defaults.

RED run before changing defaults:

```bash
./gradlew :server:test --tests suwayomi.tachidesk.server.SourceRunnerDefaultConfigTest --no-daemon
```

Relevant failure:

```txt
SourceRunnerDefaultConfigTest > generatedReferenceConfigDefaultsToLocalHeadlessSourceRunnerMode() FAILED
    org.opentest4j.AssertionFailedError at SourceRunnerDefaultConfigTest.kt:15
1 test completed, 1 failed
BUILD FAILED in 22s
```

GREEN run after changing defaults:

```bash
./gradlew :server:test --tests suwayomi.tachidesk.server.SourceRunnerDefaultConfigTest --no-daemon
```

Relevant output:

```txt
SourceRunnerDefaultConfigTest > generatedReferenceConfigDefaultsToLocalHeadlessSourceRunnerMode() PASSED
BUILD SUCCESSFUL in 16s
27 actionable tasks: 11 executed, 16 up-to-date
```

### 2. Generate server settings

```bash
./gradlew :server:server-config-generate:generateSettings --no-daemon
```

Result: passed.

Relevant output:

```txt
BUILD SUCCESSFUL in 6s
14 actionable tasks: 1 executed, 13 up-to-date
```

Generated `server/build/generated/src/main/resources/server-reference.conf` now contains:

```txt
server.ip = "127.0.0.1" # default: "127.0.0.1"
server.initialOpenInBrowserEnabled = false # default: false ; Open client on startup
server.webUIEnabled = false # default: false
server.systemTrayEnabled = false # default: false
```

### 3. Build server-only jar after defaults change

```bash
rm -f server/src/main/resources/WebUI.zip && GRADLE_OPTS='-Dorg.gradle.jvmargs=-Xmx3g -Dkotlin.daemon.jvm.options=-Xmx3g' ./gradlew :server:shadowJar --no-daemon -x test
```

Result: passed.

Relevant output:

```txt
BUILD SUCCESSFUL in 24s
24 actionable tasks: 4 executed, 20 up-to-date
```

Artifact evidence:

```txt
WebUI.zip entries: 0
a75d41de45e9c535c0278aa6fe46ea0e0f866f1624a4669a72fec9bf860d23f7  server/build/Suwayomi-Server-v2.2.2159.jar
-rw-r--r-- 1 root root 166M May 18 23:13 server/build/Suwayomi-Server-v2.2.2159.jar
```

### 4. Headless smoke without WebUI/browser/tray flags

Disposable smoke config was written to `/tmp/suwayomi-source-runner-task2/server.conf` with only a port override:

```hocon
server.port = 14568
```

Startup command:

```bash
java -Dsuwayomi.tachidesk.config.server.rootDir=/tmp/suwayomi-source-runner-task2 -jar server/build/Suwayomi-Server-v2.2.2159.jar
```

Result: server started from defaults and bound to `127.0.0.1:14568`.

Relevant loaded config output:

```txt
"initialOpenInBrowserEnabled" : false,
"ip" : "127.0.0.1",
"port" : 14568,
"systemTrayEnabled" : false,
"webUIEnabled" : false,
```

Relevant listening output:

```txt
23:13:37.467 [main] INFO io.javalin.Javalin -- Listening on http://127.0.0.1:14568/
```

GraphQL smoke query:

```bash
curl --fail-with-body -sS \
  -X POST http://127.0.0.1:14568/api/graphql \
  -H 'Content-Type: application/json' \
  --data '{"query":"{ aboutServer { name version revision buildType github } }"}'
```

Output:

```json
{"data":{"aboutServer":{"name":"Suwayomi-Server","version":"v2.2.2159","revision":"r2159","buildType":"Preview","github":"https://github.com/Suwayomi/Suwayomi-Server"}}}
```

Task 3 risk before implementation: this Task 2 smoke still logged KCEF/JCEF initialization despite WebUI/browser/tray being disabled:

```txt
KCEF download progress: 0%
KCEF download progress: 100%
Could not load 'jcef' library
Can't load libcef, error: no jawt in java.library.path
```

### 5. Broader fork verification

Fork server test suite:

```bash
./gradlew :server:test --no-daemon
```

Result: passed.

Relevant output:

```txt
SourceRunnerDefaultConfigTest > generatedReferenceConfigDefaultsToLocalHeadlessSourceRunnerMode() PASSED
BUILD SUCCESSFUL in 25s
27 actionable tasks: 6 executed, 21 up-to-date
```

The suite still emitted KCEF/JCEF shutdown/init noise, consistent with the Task 3 follow-up.

Fork lint:

```bash
./gradlew ktlintCheck --no-daemon
```

First run caught a missing trailing newline in `SourceRunnerDefaultConfigTest.kt`; after adding the newline, it passed:

```txt
BUILD SUCCESSFUL in 7s
21 actionable tasks: 5 executed, 16 up-to-date
```

Targeted regression test after the lint-only newline fix:

```bash
./gradlew :server:test --tests suwayomi.tachidesk.server.SourceRunnerDefaultConfigTest --no-daemon
```

Result: passed.

Relevant output:

```txt
SourceRunnerDefaultConfigTest > generatedReferenceConfigDefaultsToLocalHeadlessSourceRunnerMode() PASSED
BUILD SUCCESSFUL in 13s
27 actionable tasks: 6 executed, 21 up-to-date
```

Arrweeb workspace quality gate after evidence-doc updates:

```bash
bun run check:quality:code:full
```

Result: passed.

Relevant output:

```txt
Checked 112 files in 804ms. No fixes applied.
85 pass
0 fail
362 expect() calls
Dead Code: No issues found
Duplication: No duplication found
Complexity: 468 functions analyzed, 0 above threshold, average maintainability 93.5
React Doctor: 96 / 100 Great
```

React Doctor reported existing warnings in UI files unrelated to this fork task; no Arrweeb runtime code was changed.

## Task 3 verification: KCEF/WebView opt-in

Task 3 added a new source-runner-safe setting:

- `server.webViewEnabled = false` by default.
- When false, `applicationSetup()` does not call `KCEF.init`, does not register a KCEF shutdown hook, and initializes AndroidCompat without the KCEF WebView provider factory.
- WebView endpoints gate on the startup-effective WebView runtime state, not only on the live mutable config value, so changing the restart-required setting to true at runtime still returns a restart-required response until the server restarts.
- When false, `GET /api/v1/webview` returns `503 Service Unavailable` with a clear disabled message.
- When false, WebView websocket connections close with policy violation code `1008` and the same disabled message.

### 1. RED regression tests

Task 3 started with two failing test changes:

- `SourceRunnerDefaultConfigTest` expected generated `server-reference.conf` to include `server.webViewEnabled = false`.
- `KcefRuntimeSetupTest` expected `setupKcefRuntime(..., webViewEnabled = false)` to skip both KCEF startup and shutdown-hook registration, and expected `webViewEnabled = true` to execute both paths through injected test callbacks.

Initial RED command:

```bash
./gradlew :server:test \
  --tests suwayomi.tachidesk.server.SourceRunnerDefaultConfigTest \
  --tests suwayomi.tachidesk.server.KcefRuntimeSetupTest \
  --no-daemon
```

Relevant failure before implementation:

```txt
> Task :server:compileTestKotlin FAILED
e: .../KcefRuntimeSetupTest.kt:17:32 Unresolved reference 'setupKcefRuntime'.
e: .../KcefRuntimeSetupTest.kt:35:32 Unresolved reference 'setupKcefRuntime'.
BUILD FAILED in 22s
```

### 2. GREEN targeted tests

After adding `server.webViewEnabled` and gating KCEF setup:

```bash
./gradlew :server:test \
  --tests suwayomi.tachidesk.server.SourceRunnerDefaultConfigTest \
  --tests suwayomi.tachidesk.server.KcefRuntimeSetupTest \
  --no-daemon
```

Result: passed.

Relevant output:

```txt
KcefRuntimeSetupTest > skipsKcefStartupAndShutdownHookWhenWebViewIsDisabled() PASSED
KcefRuntimeSetupTest > startsKcefAndRegistersShutdownHookWhenWebViewIsEnabled() PASSED
SourceRunnerDefaultConfigTest > generatedReferenceConfigDefaultsToLocalHeadlessSourceRunnerMode() PASSED
BUILD SUCCESSFUL in 24s
```

### 3. Generated settings

```bash
./gradlew :server:server-config-generate:generateSettings --no-daemon
```

Result: passed.

Relevant generated setting:

```txt
server.webViewEnabled = false # default: false ; Enable KCEF/WebView support for sources that require an embedded browser.
```

Generator summary after Task 3:

```txt
Total: 88
Deprecated: 10
Require restart: 3
Settings config file generated successfully! Total settings: 78
BUILD SUCCESSFUL in 7s
```

### 4. Full fork server tests

```bash
./gradlew :server:test --no-daemon
```

Result: passed.

Relevant output:

```txt
KCEF/WebView support disabled by server.webViewEnabled=false
KcefRuntimeSetupTest > skipsKcefStartupAndShutdownHookWhenWebViewIsDisabled() PASSED
KcefRuntimeSetupTest > startsKcefAndRegistersShutdownHookWhenWebViewIsEnabled() PASSED
SourceRunnerDefaultConfigTest > generatedReferenceConfigDefaultsToLocalHeadlessSourceRunnerMode() PASSED
BUILD SUCCESSFUL in 17s
```

The full server tests still include one pre-existing skipped mass test:

```txt
CloudFlareTest > test nhentai browse() SKIPPED
```

### 5. Fork lint

```bash
./gradlew ktlintCheck --no-daemon
```

First Task 3 lint run found formatting in `KcefRuntimeSetupTest.kt`; the test was reformatted instead of suppressing lint. Final result: passed.

Relevant output:

```txt
BUILD SUCCESSFUL in 14s
21 actionable tasks: 5 executed, 16 up-to-date
```

### 6. Server-only jar build

```bash
rm -f server/src/main/resources/WebUI.zip && \
GRADLE_OPTS='-Dorg.gradle.jvmargs=-Xmx3g -Dkotlin.daemon.jvm.options=-Xmx3g' \
  ./gradlew :server:shadowJar --no-daemon -x test
```

Result: passed.

Relevant output:

```txt
BUILD SUCCESSFUL in 40s
24 actionable tasks: 4 executed, 20 up-to-date
```

Artifact evidence:

```txt
server/build/Suwayomi-Server-v2.2.2159.jar
sha256: 478efaf05a5d90aa2345482535461baeb8c20e8721107dcad0c33ee2f330eb08
WebUI.zip entries: 0
```

### 7. Headless local-only smoke run without WebView flags

Disposable smoke config was written to `/tmp/suwayomi-source-runner-task3-review/server.conf` with only a port override:

```hocon
server.port = 14571
```

Startup command:

```bash
java -Dsuwayomi.tachidesk.config.server.rootDir=/tmp/suwayomi-source-runner-task3-review \
  -jar server/build/Suwayomi-Server-v2.2.2159.jar
```

Result: server started from defaults and bound to `127.0.0.1:14571`.

Relevant output:

```txt
KCEF/WebView support disabled by server.webViewEnabled=false
Listening on http://127.0.0.1:14571/
```

GraphQL smoke query:

```bash
curl --fail-with-body -sS \
  -X POST http://127.0.0.1:14571/api/graphql \
  -H 'Content-Type: application/json' \
  --data '{"query":"{ aboutServer { name version revision buildType github } }"}'
```

Output:

```json
{"data":{"aboutServer":{"name":"Suwayomi-Server","version":"v2.2.2159","revision":"r2159","buildType":"Preview","github":"https://github.com/Suwayomi/Suwayomi-Server"}}}
```

WebView disabled response:

```txt
HTTP/1.1 503 Service Unavailable
Content-Type: text/plain

WebView support is disabled. Enable server.webViewEnabled to use this endpoint.
```

KCEF/JCEF log check:

```bash
grep -E 'KCEF download progress|Could not load.*jcef|no jawt|libcef' /tmp/suwayomi-source-runner-task3-review.log
```

Result:

```txt
No KCEF download or jcef/jawt errors found
```

Conclusion: Task 3 resolved the Task 2 KCEF/JCEF warning by making KCEF/WebView explicitly opt-in and fail-closed by default.

### 8. Reviewer-requested hardening

The first implementation review was recorded in `docs/code-review/suwayomi-task3-kcef-webview-opt-in-2026-05-19-review.md` with `REQUEST CHANGES`. The review found three robustness gaps, all fixed before proceeding:

- `AndroidCompatInitializer.init()` no longer has a no-argument default that enables the KCEF provider; call sites must pass the desired WebView state explicitly.
- `WebViewRuntime` records whether the current process actually started with WebView enabled. REST/WebSocket handlers now require both `server.webViewEnabled.value == true` and startup-effective WebView runtime availability.
- `WebViewControllerTest` adds automated coverage for:
  - HTTP `503 text/plain` when WebView is disabled.
  - HTTP `503 text/plain` with a restart-required message when `server.webViewEnabled` is toggled to true after startup.
  - WebSocket close code `1008` with the restart-required message when toggled true after startup.

Reviewer-fix verification:

```bash
./gradlew :server:test \
  --tests suwayomi.tachidesk.global.controller.WebViewControllerTest \
  --tests suwayomi.tachidesk.server.KcefRuntimeSetupTest \
  --no-daemon --console=plain
```

Result: passed by exit code.

```bash
./gradlew ktlintCheck --no-daemon --console=plain
```

Result: passed by exit code after formatting the new tests and the restart-required message.

Final full fork server test after reviewer fixes:

```bash
./gradlew :server:test --no-daemon --console=plain
```

Relevant output:

```txt
WebViewControllerTest > webviewWebSocketClosesWhenConfigIsEnabledAfterStartup() PASSED
WebViewControllerTest > webviewEndpointRequiresRestartWhenConfigIsEnabledAfterStartup() PASSED
WebViewControllerTest > webviewEndpointReturnsDisabledResponseWhenWebViewIsDisabled() PASSED
KcefRuntimeSetupTest > skipsKcefStartupAndShutdownHookWhenWebViewIsDisabled() PASSED
KcefRuntimeSetupTest > startsKcefAndRegistersShutdownHookWhenWebViewIsEnabled() PASSED
SourceRunnerDefaultConfigTest > generatedReferenceConfigDefaultsToLocalHeadlessSourceRunnerMode() PASSED
BUILD SUCCESSFUL in 27s
```

## Risks and follow-ups

| Risk | Evidence | Follow-up |
| --- | --- | --- |
| Kotlin compile heap is too small by default in this container | Initial `:server:shadowJar` failed with `GC overhead limit exceeded`; heap env made it pass. | Decide in a future fork tooling task whether to commit a conservative `gradle.properties` or document CI heap settings. |
| KCEF/WebView initializes despite WebUI/browser/tray being disabled | Task 2 smoke logged KCEF download and `jcef`/`jawt` errors; Task 3 smoke logged `KCEF/WebView support disabled by server.webViewEnabled=false` and no KCEF/JCEF native-load noise. | Resolved by Task 3; keep the log grep in future runtime smoke checks. |
| Default network bind was broad in upstream | Task 2 changed generated default config to `server.ip = "127.0.0.1"`; Task 3 final smoke again reached `http://127.0.0.1:14571/` without an IP override. | Resolved for default bind; keep testing in future smoke runs. |
| WebUI update/runtime surface remains present in classes | Server-only jar excludes `WebUI.zip`, and Task 2 defaults `server.webUIEnabled=false`, but upstream WebUI-related update/check operations still exist. | Task 4: disable WebUI runtime/update surface for source-runner profile. |
| Extension supply-chain controls are not yet hardened | Baseline does not change extension install/upload behavior. | Task 5: harden extension installation and repository trust. |
| MPL source-availability obligations apply when distributing executable fork artifacts | Fork preserves `LICENSE`, but future source changes must be tracked. | Future release evidence must record changed fork commit, source availability path, and artifact checksum. |

## Next task

Proceed to Task 4 from `docs/plans/suwayomi-minimal-fork-2026-05-18-plan.md`: disable WebUI download/update/browser surface for the source-runner profile.

Task 4 should keep GraphQL source/extension/manga/chapter operations intact while ensuring WebUI update/check operations are disabled or absent by source-runner design.
