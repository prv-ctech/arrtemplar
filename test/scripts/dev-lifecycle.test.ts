import { describe, expect, it } from "bun:test";
import {
  buildUnrelatedPortOwnerMessage,
  isWorkspaceOwnedDevProcess,
  parseLsofPortOwners,
} from "../../scripts/dev";

const workspaceRoot = "/workspaces/arrweeb-anime";

describe("dev lifecycle supervisor", () => {
  it("parses lsof field output into port owners", () => {
    expect(
      parseLsofPortOwners(
        ["p101", "cbun", "p202", "cnode", "p303", "cBun Helper", ""].join("\n"),
        5173,
      ),
    ).toEqual([
      { pid: 101, command: "bun", port: 5173, args: [] },
      { pid: 202, command: "node", port: 5173, args: [] },
      { pid: 303, command: "Bun Helper", port: 5173, args: [] },
    ]);
  });

  it("recognizes repo-owned backend and frontend dev listeners", () => {
    expect(
      isWorkspaceOwnedDevProcess(
        {
          pid: 101,
          port: 3000,
          command: "bun",
          cwd: `${workspaceRoot}/apps/server`,
          args: ["bun", "--hot", "src/main.ts"],
        },
        workspaceRoot,
      ),
    ).toBe(true);

    expect(
      isWorkspaceOwnedDevProcess(
        {
          pid: 202,
          port: 5173,
          command: "bun",
          cwd: `${workspaceRoot}/apps/web`,
          args: ["bun", "x", "--bun", "vite", "--host", "0.0.0.0"],
        },
        workspaceRoot,
      ),
    ).toBe(true);
  });

  it("rejects unrelated or unverifiable commands even when they use dev ports", () => {
    expect(
      isWorkspaceOwnedDevProcess(
        {
          pid: 303,
          port: 5173,
          command: "python3",
          cwd: workspaceRoot,
          args: ["python3", "-m", "http.server", "5173"],
        },
        workspaceRoot,
      ),
    ).toBe(false);

    expect(
      isWorkspaceOwnedDevProcess(
        {
          pid: 404,
          port: 3000,
          command: "bun",
          cwd: "/tmp/other-project",
          args: ["bun", "--hot", "src/main.ts"],
        },
        workspaceRoot,
      ),
    ).toBe(false);

    expect(
      isWorkspaceOwnedDevProcess(
        {
          pid: 505,
          port: 3000,
          command: "bun",
          cwd: `${workspaceRoot}/apps/server`,
          args: [],
        },
        workspaceRoot,
      ),
    ).toBe(false);
  });

  it("builds a clear refusal diagnostic for unrelated port owners", () => {
    expect(
      buildUnrelatedPortOwnerMessage({
        pid: 303,
        port: 5173,
        command: "python3",
        cwd: workspaceRoot,
        args: ["python3", "-m", "http.server", "5173"],
      }),
    ).toContain("Refusing to kill unrelated process on port 5173");
  });
});
