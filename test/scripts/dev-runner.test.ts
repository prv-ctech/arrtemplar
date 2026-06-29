import { describe, expect, it } from "bun:test";

type DevModule = {
  devProcessSpecs: readonly DevProcessSpec[];
};

type DevProcessSpec = {
  name: string;
  cmd: string[];
  cwd: string;
  stdout: string;
  stderr: string;
};

describe("root dev runner", () => {
  it("does not use Bun workspace parallel output prefixes", async () => {
    const packageJson = await Bun.file("package.json").json();
    const bunfig = Bun.TOML.parse(await Bun.file("bunfig.toml").text()) as {
      run?: { silent?: boolean };
    };

    expect(packageJson.scripts.dev).toBe("bun scripts/dev.ts");
    expect(packageJson.scripts.dev).not.toContain("--filter");
    expect(packageJson.scripts.dev).not.toContain("--parallel");
    expect(bunfig.run?.silent).toBe(true);
  });

  it("passes backend LogTape output and clean Vite local URL output through the terminal", async () => {
    const { devProcessSpecs } = await importDevModule();

    expect(devProcessSpecs).toEqual([
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
    ]);
  });

  it("keeps standalone web dev output visible without Bun workspace prefixes", async () => {
    const webPackageJson = await Bun.file("apps/web/package.json").json();

    expect(webPackageJson.scripts.dev).toBe("bunx --bun vite --no-open");
  });

  it("keeps fatal Vite startup diagnostics visible", async () => {
    const { devProcessSpecs } = await importDevModule();
    const webSpec = devProcessSpecs.find((spec) => spec.name === "web");

    if (!webSpec) {
      throw new Error("Expected web dev process spec to exist.");
    }

    expect(webSpec.stderr).toBe("inherit");

    const result = Bun.spawnSync({
      cmd: [...webSpec.cmd, "--config", "./definitely-missing-vite-config.ts"],
      cwd: webSpec.cwd,
      env: Bun.env,
      stdout: "ignore",
      stderr: "pipe",
    });
    const stderr = result.stderr.toString();

    expect(result.exitCode).not.toBe(0);
    expect(stderr).toContain("failed to load config");
  });
});

async function importDevModule(): Promise<DevModule> {
  return (await import(new URL("../../scripts/dev.ts", import.meta.url).href)) as DevModule;
}
