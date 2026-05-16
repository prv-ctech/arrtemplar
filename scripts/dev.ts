import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "bun";

const DEV_PORTS = [3000, 5173] as const;
const PORT_CLEAR_TIMEOUT_MS = 5_000;
const PORT_CHECK_INTERVAL_MS = 50;
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export type PortOwner = {
  pid: number;
  port: number;
  command: string;
  args: string[];
  cwd?: string;
};

type DevProcess = {
  name: string;
  cmd: string[];
  cwd: string;
};

const devProcesses: DevProcess[] = [
  {
    name: "backend",
    cmd: ["bun", "--hot", "src/main.ts"],
    cwd: join(workspaceRoot, "apps/server"),
  },
  {
    name: "frontend",
    cmd: ["bunx", "--bun", "vite", "--no-open"],
    cwd: join(workspaceRoot, "apps/web"),
  },
  {
    name: "typecheck",
    cmd: ["bunx", "tsc", "-b", "--noEmit", "--watch", "--preserveWatchOutput"],
    cwd: workspaceRoot,
  },
];

export function parseLsofPortOwners(output: string, port: number): PortOwner[] {
  const owners: PortOwner[] = [];
  let currentOwner: PortOwner | undefined;

  for (const line of output.split(/\r?\n/)) {
    const parsedOwner = parseLsofLine(line, port, currentOwner);

    owners.push(...parsedOwner.completedOwners);
    currentOwner = parsedOwner.currentOwner;
  }

  if (currentOwner) {
    owners.push(currentOwner);
  }

  return owners.filter((owner) => owner.command.length > 0);
}

function parseLsofLine(
  line: string,
  port: number,
  currentOwner: PortOwner | undefined,
): { completedOwners: PortOwner[]; currentOwner: PortOwner | undefined } {
  if (!line) {
    return { completedOwners: [], currentOwner };
  }

  if (line.startsWith("p")) {
    return {
      completedOwners: currentOwner ? [currentOwner] : [],
      currentOwner: createPortOwnerFromPid(line.slice(1), port),
    };
  }

  if (line.startsWith("c") && currentOwner) {
    return {
      completedOwners: [],
      currentOwner: { ...currentOwner, command: line.slice(1) },
    };
  }

  return { completedOwners: [], currentOwner };
}

function createPortOwnerFromPid(value: string, port: number): PortOwner | undefined {
  const pid = Number(value);

  if (!Number.isInteger(pid) || pid <= 0) {
    return undefined;
  }

  return { pid, command: "", port, args: [] };
}

export function isWorkspaceOwnedDevProcess(owner: PortOwner, root = workspaceRoot): boolean {
  if (!owner.cwd) {
    return false;
  }

  const normalizedRoot = resolve(root);
  const normalizedCwd = resolve(owner.cwd);

  if (!isPathInside(normalizedRoot, normalizedCwd)) {
    return false;
  }

  return (
    isBackendDevProcess(owner, normalizedRoot, normalizedCwd) ||
    isFrontendDevProcess(owner, normalizedRoot, normalizedCwd)
  );
}

function isBackendDevProcess(
  owner: PortOwner,
  normalizedRoot: string,
  normalizedCwd: string,
): boolean {
  return (
    owner.port === 3000 &&
    isPathInside(join(normalizedRoot, "apps/server"), normalizedCwd) &&
    isBunProcess(owner) &&
    commandMatches(owner, "src/main.ts")
  );
}

function isFrontendDevProcess(
  owner: PortOwner,
  normalizedRoot: string,
  normalizedCwd: string,
): boolean {
  return (
    owner.port === 5173 &&
    isPathInside(join(normalizedRoot, "apps/web"), normalizedCwd) &&
    isFrontendRuntimeProcess(owner) &&
    commandMatches(owner, "vite")
  );
}

function isBunProcess(owner: PortOwner): boolean {
  return owner.command.toLowerCase().includes("bun") || commandLine(owner).includes("bun");
}

function isFrontendRuntimeProcess(owner: PortOwner): boolean {
  return isBunProcess(owner) || owner.command.toLowerCase() === "node";
}

function commandMatches(owner: PortOwner, expectedText: string): boolean {
  return commandLine(owner).includes(expectedText);
}

function commandLine(owner: PortOwner): string {
  return [owner.command, ...owner.args].join(" ").toLowerCase();
}

export function buildUnrelatedPortOwnerMessage(owner: PortOwner): string {
  const commandLine = [owner.command, ...owner.args].filter(Boolean).join(" ");

  return [
    `Refusing to kill unrelated process on port ${owner.port}.`,
    `PID: ${owner.pid}`,
    `Command: ${commandLine || owner.command}`,
    `cwd: ${owner.cwd ?? "unknown"}`,
    "Stop that process manually or choose a different port before running bun run dev.",
  ].join("\n");
}

async function getPortOwners(port: number): Promise<PortOwner[]> {
  const result = await $`lsof -nP -iTCP:${port} -sTCP:LISTEN -F pc`.nothrow().quiet();

  if (result.exitCode === 1) {
    return [];
  }

  if (result.exitCode !== 0) {
    throw new Error(`Failed to inspect port ${port}: ${result.stderr.toString().trim()}`);
  }

  const owners = parseLsofPortOwners(result.stdout.toString(), port);

  return Promise.all(owners.map(enrichPortOwner));
}

async function enrichPortOwner(owner: PortOwner): Promise<PortOwner> {
  const [cwd, args] = await Promise.all([readProcessCwd(owner.pid), readProcessArgs(owner.pid)]);

  return cwd ? { ...owner, cwd, args } : { ...owner, args };
}

async function readProcessArgs(pid: number): Promise<string[]> {
  const result = await $`cat ${`/proc/${pid}/cmdline`}`.nothrow().quiet();

  if (result.exitCode !== 0) {
    return [];
  }

  const text = result.stdout.toString();

  return text.split("\0").filter(Boolean);
}

async function readProcessCwd(pid: number): Promise<string | undefined> {
  const result = await $`readlink ${`/proc/${pid}/cwd`}`.nothrow().quiet();

  if (result.exitCode !== 0) {
    return undefined;
  }

  return result.stdout.toString().trim();
}

async function clearRepoOwnedPortOwners(): Promise<void> {
  for (const port of DEV_PORTS) {
    const owners = await getPortOwners(port);

    for (const owner of owners) {
      if (!isWorkspaceOwnedDevProcess(owner)) {
        throw new Error(buildUnrelatedPortOwnerMessage(owner));
      }
    }

    for (const owner of owners) {
      console.info(`Stopping stale ${owner.command} process ${owner.pid} on port ${port}.`);
      process.kill(owner.pid, "SIGTERM");
    }

    if (owners.length > 0) {
      await waitForPortToClear(port);
    }
  }
}

async function waitForPortToClear(port: number): Promise<void> {
  const deadline = Date.now() + PORT_CLEAR_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if ((await getPortOwners(port)).length === 0) {
      return;
    }

    await Bun.sleep(PORT_CHECK_INTERVAL_MS);
  }

  throw new Error(`Port ${port} is still occupied after stale process cleanup.`);
}

async function runDevSupervisor(): Promise<void> {
  await clearRepoOwnedPortOwners();

  const children = devProcesses.map((devProcess) => {
    console.info(`Starting ${devProcess.name}: ${devProcess.cmd.join(" ")}`);

    return Bun.spawn({
      cmd: devProcess.cmd,
      cwd: devProcess.cwd,
      env: Bun.env,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
  });

  let shuttingDown = false;

  const stopChildren = async (signal: NodeJS.Signals = "SIGTERM") => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    for (const child of children) {
      if (!child.killed && child.exitCode === null) {
        child.kill(signal);
      }
    }

    await Promise.allSettled(children.map((child) => child.exited));
  };

  process.on("SIGINT", () => {
    stopChildren("SIGINT").finally(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    stopChildren("SIGTERM").finally(() => process.exit(0));
  });

  const firstExit = await Promise.race(
    children.map(async (child, index) => {
      const devProcess = devProcesses[index];

      if (!devProcess) {
        throw new Error(`Missing dev process metadata for child index ${index}.`);
      }

      return {
        exitCode: await child.exited,
        process: devProcess,
      };
    }),
  );

  if (!shuttingDown) {
    console.error(`${firstExit.process.name} exited with code ${firstExit.exitCode}.`);
    await stopChildren();
    process.exit(firstExit.exitCode || 1);
  }
}

function isPathInside(parentPath: string, childPath: string): boolean {
  const relativePath = relative(parentPath, childPath);

  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

if (import.meta.main) {
  runDevSupervisor().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
