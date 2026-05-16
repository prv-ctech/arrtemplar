# Rule: rt-cron

## Rationale

`Bun.cron` provides both in-process and OS-level cron scheduling. In this repo, prefer `@elysiajs/cron` for API lifecycle jobs. Use `Bun.cron()` only for standalone machine-level jobs outside the API runtime.

## Architecture Boundary

```
API lifecycle jobs → @elysiajs/cron (starts/stops with the API process)
Standalone/machine jobs → Bun.cron() (in-process callback or OS-level)
```

## In-Process: `Bun.cron(schedule, handler)`

```typescript
using job = Bun.cron("*/5 * * * *", async () => {
  await syncToDatabase();
});
```

- Returns `CronJob` synchronously
- **No-overlap guarantee**: Next fire computed only after handler settles
- **Error handling**: Sync `throw` → `uncaughtException`; rejected Promise → `unhandledRejection`
- **`--hot` safe**: All cron jobs stopped before re-evaluation
- **Disposable**: `using job = Bun.cron(...)` auto-stops at scope exit
- **UTC scheduling**: `0 9 * * *` means 09:00 UTC regardless of system timezone

### CronJob Handle

```typescript
job.cron;    // "*/5 * * * *"
job.stop();  // cancel
job.unref(); // allow process exit
job.ref();   // keep process alive (default)
```

## OS-Level: `Bun.cron(path, schedule, title)`

```typescript
await Bun.cron("./worker.ts", "30 2 * * MON", "weekly-report");
```

- Registers via crontab (Linux), launchd (macOS), Task Scheduler (Windows)
- Re-registering same title overwrites in-place
- Worker script must export `scheduled()`:

```typescript
export default {
  scheduled(controller: Bun.CronController) {
    console.log(controller.cron, controller.scheduledTime);
  },
};
```

### Remove: `Bun.cron.remove(title)`

```typescript
await Bun.cron.remove("weekly-report");
```

## Parse: `Bun.cron.parse(expression, relativeDate?)`

```typescript
const next = Bun.cron.parse("*/15 * * * *"); // Date | null
const weekday = Bun.cron.parse("0 9 * * MON-FRI");
const yearly = Bun.cron.parse("@yearly");
```

Returns `Date` or `null` if no match within ~4 years.

## Cron Expression Syntax

- Standard 5-field: `minute hour day-of-month month day-of-week`
- Special chars: `*`, `,`, `-`, `/`
- Named values: `MON-SUN`, `JAN-DEC`
- Nicknames: `@yearly`, `@monthly`, `@weekly`, `@daily`/`@midnight`, `@hourly`
- **POSIX OR logic**: When both day-of-month and day-of-week are restricted (neither `*`), either matching fires the job

## Guidelines

- **PREFER @elysiajs/cron** for jobs that should start/stop with the API process
- **USE Bun.cron()** only for standalone machine-level jobs or long-running containers
- **IN-PROCESS for shared state**: Use the in-process variant when the handler needs database pools, caches, or module-level state
- **OS-LEVEL for persistence**: Use the OS-level variant for jobs that must survive process restarts
- **HANDLE ERRORS**: Add `unhandledRejection` listener; cron jobs keep running after errors
