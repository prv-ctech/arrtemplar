export type DevProcessSpec = {
  name: "server" | "web";
  cmd: string[];
  cwd: string;
  stdout: "inherit" | "ignore";
  stderr: "inherit" | "ignore";
};

type DevSubprocess = Pick<Bun.Subprocess, "exited" | "exitCode" | "kill" | "killed">;
type SpawnDevProcess = (spec: DevProcessSpec) => DevSubprocess;

export const devProcessSpecs = [
  {
    name: "server",
    cmd: ["bun", "--hot", "src/main.ts"],
    cwd: "apps/server",
    stdout: "inherit",
    stderr: "inherit",
  },
  {
    name: "web",
    cmd: ["bunx", "--bun", "vite", "--no-open"],
    cwd: "apps/web",
    stdout: "inherit",
    stderr: "inherit",
  },
] as const satisfies readonly DevProcessSpec[];

export function spawnDevProcess(spec: DevProcessSpec): Bun.Subprocess {
  return Bun.spawn({
    cmd: spec.cmd,
    cwd: spec.cwd,
    env: Bun.env,
    stdin: "ignore",
    stdout: spec.stdout,
    stderr: spec.stderr,
  });
}

export async function runDevProcesses(spawn: SpawnDevProcess = spawnDevProcess): Promise<never> {
  const children = devProcessSpecs.map((spec) => ({
    spec,
    process: spawn(spec),
  }));
  let stopping = false;

  function stopChildren(signal: NodeJS.Signals): void {
    if (stopping) {
      return;
    }

    stopping = true;

    for (const child of children) {
      if (!child.process.killed && child.process.exitCode === null) {
        child.process.kill(signal);
      }
    }
  }

  process.on("SIGINT", () => stopChildren("SIGINT"));
  process.on("SIGTERM", () => stopChildren("SIGTERM"));

  const firstExit = await Promise.race(
    children.map(async (child) => ({
      child,
      exitCode: await child.process.exited,
    })),
  );

  stopChildren("SIGTERM");
  await Promise.allSettled(children.map((child) => child.process.exited));

  process.exit(firstExit.exitCode ?? 1);
}

if (import.meta.main) {
  await runDevProcesses();
}
