import { Outlet } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { useTheme } from "@/features/theme/theme-state";

export function RootLayout() {
  const { selectedTheme } = useTheme();

  return (
    <>
      <Outlet />
      <Toaster
        closeButton
        position="top-right"
        richColors
        theme={selectedTheme.dark ? "dark" : "light"}
      />
    </>
  );
}
