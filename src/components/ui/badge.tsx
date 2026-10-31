import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-emerald-600 text-white shadow hover:bg-emerald-700",
        secondary:
          "border-transparent bg-slate-800 text-slate-200 hover:bg-slate-700",
        destructive:
          "border-transparent bg-red-600/20 text-red-400 border-red-500/30",
        outline:
          "border-slate-700 text-slate-300",
        gold:
          "border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-sm shadow-amber-500/10",
        live:
          "border-red-500/50 bg-red-500/20 text-red-300 animate-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
