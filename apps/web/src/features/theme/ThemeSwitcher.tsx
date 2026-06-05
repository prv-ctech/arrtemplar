import { CaretDownIcon, CheckIcon, PaletteIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ThemePreviewStrip } from "./ThemePreviewStrip";
import { CATPPUCCIN_PREVIEW_SWATCHES } from "./theme-options";
import { useTheme } from "./theme-state";

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { selectedTheme, setTheme, theme, themes } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Change Catppuccin color theme"
          className={cn("shrink-0", compact ? "px-0" : "min-w-36 justify-between")}
          size={compact ? "icon" : "default"}
          variant="outline"
        >
          <PaletteIcon aria-hidden="true" className="size-4" weight="duotone" />
          {compact ? null : <span>{selectedTheme.label}</span>}
          {compact ? null : <CaretDownIcon aria-hidden="true" className="size-3.5 opacity-70" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>
          <span className="block text-sm font-semibold">Catppuccin flavor</span>
          <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
            Switch between Latte, Frappé, Macchiato, and Mocha.
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {themes.map((option) => (
          <DropdownMenuItem
            className="items-start gap-3 p-3"
            key={option.value}
            onSelect={() => setTheme(option.value)}
          >
            <ThemePreviewStrip
              className={cn(
                "mt-0.5 h-9 w-24 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--catppuccin-color-base)_70%,transparent)]",
                option.value,
              )}
              swatches={CATPPUCCIN_PREVIEW_SWATCHES}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-3 text-sm font-medium text-foreground">
                {option.label}
                {option.value === theme ? (
                  <CheckIcon aria-hidden="true" className="size-4 text-primary" weight="bold" />
                ) : null}
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {option.description}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
