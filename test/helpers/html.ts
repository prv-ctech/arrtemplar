export function readFormAction(html: string): string {
  const match = /<form[^>]* action="([^"]+)"/u.exec(html);

  if (!match?.[1]) {
    throw new Error("Expected form action attribute.");
  }

  return match[1];
}
