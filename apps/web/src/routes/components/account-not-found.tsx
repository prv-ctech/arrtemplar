export function AccountNotFound() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-5xl font-black tracking-tight text-muted-foreground">404</p>
      <h2 className="mt-4 text-xl font-semibold text-foreground">Account section not found</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The requested account route is not available for the signed-in account.
      </p>
    </div>
  );
}
