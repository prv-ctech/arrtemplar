const workspaceRoot = new URL("../../../../../../", import.meta.url);

export function readWorkspaceSource(pathFromWorkspaceRoot: string): Promise<string> {
  return Bun.file(new URL(pathFromWorkspaceRoot, workspaceRoot)).text();
}

export async function readWorkspaceSources(
  pathsFromWorkspaceRoot: readonly string[],
): Promise<string> {
  const sources = await Promise.all(pathsFromWorkspaceRoot.map(readWorkspaceSource));

  return sources.join("\n");
}
