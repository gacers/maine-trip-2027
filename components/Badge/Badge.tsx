"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import styles from "./Badge.module.css";

export type BadgeVariant = "amber" | "blue" | "purple" | "teal" | "pink" | "indigo" | "neutral" | "closed";

// Deliberately excludes red/green — colors with their own strong "bad"/
// "good" connotation, which is exactly what went wrong when Closed (a
// real status) happened to land on green and read as "open" by
// accident. Those two are reserved for actual status meaning instead
// (see the dedicated "closed" variant); an arbitrary type tag only ever
// cycles through these purely-decorative colors.
const COLOR_VARIANTS: BadgeVariant[] = ["amber", "blue", "purple", "teal", "pink", "indigo"];

// Deterministically maps an arbitrary string (a boolean field's own
// `key`, e.g. "winery") to one of the color variants above — same input
// always gets the same color, so a given type reads consistently as
// "the same tag" everywhere it shows up (this card, that card, the
// filter dropdown, ...) without hardcoding a color per label, which
// wouldn't generalize to whatever boolean field an admin adds next.
export function pickBadgeVariant(seed: string): BadgeVariant {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return COLOR_VARIANTS[Math.abs(hash) % COLOR_VARIANTS.length];
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Render as the single child element instead of a <span> (via Radix's
   * Slot) — e.g. a badge that's also a link/button. */
  asChild?: boolean;
}

// A small pill — an entry's true boolean fields (Bar, Market, Winery,
// Closed, ...) render as one of these each, instead of plain uppercase
// eyebrow text. Same Slot-based wrapping as Button, for the same reason:
// one place owning this look/variant set on top of this project's own
// design tokens, not Radix Themes.
const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = "neutral", className, asChild = false, ...props },
  ref
) {
  const Comp = asChild ? Slot : "span";
  const classes = [styles.badge, styles[variant], className].filter(Boolean).join(" ");
  return <Comp ref={ref} className={classes} {...props} />;
});

export default Badge;
