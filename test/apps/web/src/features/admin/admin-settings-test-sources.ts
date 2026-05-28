const workspaceRoot = new URL("../../../../../../", import.meta.url);

export function readWorkspaceSource(pathFromWorkspaceRoot: string): Promise<string> {
  return Bun.file(new URL(pathFromWorkspaceRoot, workspaceRoot)).text();
}
