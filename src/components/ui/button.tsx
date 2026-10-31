import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-emerald-600 text-white shadow-lg shadow-emerald-950/40 hover:bg-emerald-500 hover:shadow-emerald-900/50",
        gold:
          "bg-gradient-to-r from-amber-500 to-amber-600 text-charcoal-950 font-bold shadow-lg shadow-amber-950/50 hover:from-amber-400 hover:to-amber-500 text-black",
        destructive:
          "bg-red-600 text-white shadow-sm hover:bg-red-500",
        outline:
          "border border-slate-700 bg-charcoal-900/50 hover:bg-slate-800 hover:text-white text-slate-200",
        secondary:
          "bg-slate-800 text-slate-100 hover:bg-slate-700",
        ghost:
          "hover:bg-slate-800 hover:text-white text-slate-300",
        link:
          "text-emerald-400 underline-offset-4 hover:underline",
        stage:
          "bg-gradient-to-b from-charcoal-800 to-charcoal-900 border border-slate-700/80 text-white hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg font-bold tracking-wide",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
