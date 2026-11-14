"use client";

import { motion, type Transition, type Variants } from "framer-motion";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Motion primitives.
 *
 * The brief fixes the easing curve and durations, so they live here once and
 * every animated surface in the app reuses them. `prefers-reduced-motion` is
 * neutralised globally in globals.css.
 */
export const BRUTAL_EASE: Transition["ease"] = [0.22, 1, 0.36, 1];

export const ENTRANCE_TRANSITION: Transition = {
  duration: 0.35,
  ease: BRUTAL_EASE,
};

/**
 * Explicit element map.
 *
 * `motion[as]` would type-check only via a cast, and under
 * `noUncheckedIndexedAccess` a dynamic lookup is `| undefined`. An explicit
 * map keeps the allowed tags honest and the types exact.
 */
const MOTION_TAGS = {
  div: motion.div,
  section: motion.section,
  header: motion.header,
  main: motion.main,
  li: motion.li,
  tr: motion.tr,
} as const;

type MotionTag = keyof typeof MOTION_TAGS;

/** Page mount reveal: opacity 0→1, y 12→0. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: MotionTag;
}) {
  const Component = MOTION_TAGS[as];

  return (
    <Component
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...ENTRANCE_TRANSITION, delay }}
      className={cn(className)}
    >
      {children}
    </Component>
  );
}

/** Scroll-triggered reveal: fires once when 15% of the block is visible. */
export function RevealOnScroll({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: MotionTag;
}) {
  const Component = MOTION_TAGS[as];

  return (
    <Component
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ ...ENTRANCE_TRANSITION, delay }}
      className={cn(className)}
    >
      {children}
    </Component>
  );
}

/** Staggered container for grid cards and summary rows. */
export const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.04 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: ENTRANCE_TRANSITION },
};

export function StaggerGrid({
  children,
  className,
  scroll = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Trigger on scroll instead of on mount. */
  scroll?: boolean;
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      {...(scroll
        ? { whileInView: "visible", viewport: { once: true, amount: 0.15 } }
        : { animate: "visible" })}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={staggerItem} className={cn(className)}>
      {children}
    </motion.div>
  );
}

/** Tactile press wrapper for elements that cannot be a MotionButton. */
export function Tap({
  children,
  className,
  onClick,
  disabled = false,
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      transition={{ duration: 0.12, ease: BRUTAL_EASE }}
      className={cn("text-left", className)}
    >
      {children}
    </motion.button>
  );
}
