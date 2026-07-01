import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-medium transition-[background,color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-(--shadow-button) hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/84",
        infoOutline:
          "border border-[color:var(--action-info-border)] bg-[color:var(--action-info-bg)] text-[color:var(--action-info-foreground)] shadow-(--shadow-soft) hover:border-[color:var(--action-info-border-hover)] hover:bg-[color:var(--action-info-bg-hover)]",
        outline:
          "border border-border bg-card/62 text-foreground shadow-(--shadow-soft) hover:border-primary/50 hover:bg-accent",
        ghost: "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        destructiveOutline:
          "border border-[color:var(--action-danger-border)] bg-[color:var(--action-danger-bg)] text-[color:var(--action-danger-foreground)] shadow-(--shadow-soft) hover:border-[color:var(--action-danger-border-hover)] hover:bg-[color:var(--action-danger-bg-hover)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-12 px-7",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
