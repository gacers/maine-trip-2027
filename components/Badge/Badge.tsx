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

// Assigns each key in `keys` (already deduped, in a stable order — e.g.
// a section's own boolean field_defs, in their defined order) to one of
// the color variants above, one at a time. Two distinct types shown
// together (Restaurant, Breakfast, ...) never collide on the same
// color this way, the way an independent per-key hash could (and did —
// two unrelated types in the same section landing on the same bucket
// purely by hash coincidence). A different section's own field list
// gets its own independent assignment, so the same key can land on a
// different color there — that's fine, only same-section collisions
// actually read as a bug. Wraps back to the start if a section somehow
// defines more boolean fields than there are colors, an inherent limit
// of a small, deliberately non-alarming palette rather than a bug.
export function assignBadgeVariants(keys: string[]): Record<string, BadgeVariant> {
  const map: Record<string, BadgeVariant> = {};
  keys.forEach((key, i) => {
    map[key] = COLOR_VARIANTS[i % COLOR_VARIANTS.length];
  });
  return map;
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
