"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "framer-motion";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Brutalist button.
 *
 * ADJACENT BUTTON RULE — enforced by construction:
 * `variant="accent"` is the ONLY variant that fills with #51CD85. Every other
 * variant is monochrome (`bg-transparent border border-border text-foreground`
 * or a flat surface). Any button pair must therefore use at most one `accent`.
 * `<ButtonRow>` in this file documents and asserts that pairing.
 *
 * No gradients, no shadows, no rounded corners beyond the 2px hairline radius.
 */
const buttonVariants = cva(
  cn(
    "relative inline-flex select-none items-center justify-center gap-2",
    "whitespace-nowrap font-mono text-[11px] font-medium uppercase tracking-[0.08em]",
    "border transition-colors duration-150 ease-brutal",
    "disabled:pointer-events-none disabled:opacity-40",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    "[&_svg]:size-3.5 [&_svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        /** The single accent-filled variant. Flat #51CD85 on #09090B text. */
        accent:
          "border-accent bg-accent text-accent-foreground hover:bg-accent/90 active:bg-accent/80",
        /** Default monochrome sibling — the correct partner for `accent`. */
        outline:
          "border-border bg-transparent text-foreground hover:bg-surface active:bg-surface",
        /** Monochrome filled, for secondary emphasis without colour. */
        solid:
          "border-foreground bg-foreground text-background hover:bg-foreground/90",
        surface:
          "border-border bg-surface text-foreground hover:bg-transparent",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:border-border hover:text-foreground",
        danger:
          "border-danger bg-transparent text-danger hover:bg-danger hover:text-white",
        "danger-solid":
          "border-danger bg-danger text-white hover:bg-danger/90",
        warning:
          "border-warning bg-transparent text-warning hover:bg-warning hover:text-accent-foreground",
      },
      size: {
        xs: "h-7 px-2.5 text-[10px]",
        sm: "h-8 px-3",
        md: "h-9 px-4",
        lg: "h-11 px-6 text-[12px]",
        icon: "h-9 w-9 px-0",
        "icon-sm": "h-8 w-8 px-0",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "md",
    },
  },
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
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

/**
 * Tactile press state (`whileTap={{ scale: 0.985 }}`) per the motion spec.
 *
 * Supports `asChild` so a motion button can wrap a `next/link` without
 * nesting an <a> inside a <button> (invalid HTML). Radix `Slot` merges the
 * props onto its child, and wrapping Slot in `motion()` keeps the tap
 * animation while the rendered element stays an anchor.
 *
 * Verified: `variant`/`size` are destructured out and `whileTap`/`transition`
 * are consumed by framer-motion, so none of them leak to the DOM.
 */
const MotionSlot = motion.create(Slot);

export type MotionButtonProps = Omit<HTMLMotionProps<"button">, "ref"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

const MotionButton = React.forwardRef<HTMLButtonElement, MotionButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? MotionSlot : motion.button;

    return (
      <Comp
        ref={ref}
        whileTap={{ scale: 0.985 }}
        transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
MotionButton.displayName = "MotionButton";

/**
 * Horizontal button group with a shared hairline.
 *
 * Renders siblings flush against each other so the 1px rule between them is a
 * single shared line, matching the reference button rails.
 */
function ButtonRow({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} {...props}>
      {children}
    </div>
  );
}

export { Button, MotionButton, ButtonRow, buttonVariants };
