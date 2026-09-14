"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "link";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render as the single child element instead of a <button> (via Radix's
   * Slot), e.g. `<Button asChild><a href="...">Download</a></Button>` —
   * gets this component's exact classes/variant styling on whatever real
   * element the situation actually calls for, instead of a nested
   * button-inside-a-link (or vice versa). */
  asChild?: boolean;
}

// The one Button every clickable action on the site should render
// through, instead of a bare <button> restyled inline per call site —
// wraps Radix's Slot primitive (the same composition mechanism Radix's
// own components use for asChild) so callers can hand it a <button>,
// an <a>, or anything else and still get one consistent set of
// variants/sizes/defaults defined here, in one place, on top of this
// project's own design tokens (see app/tokens.css) — not Radix Themes'.
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", type = "button", className, asChild = false, ...props },
  ref
) {
  const Comp = asChild ? Slot : "button";
  const classes = [styles.button, styles[variant], styles[size], className].filter(Boolean).join(" ");
  return <Comp ref={ref} type={asChild ? undefined : type} className={classes} {...props} />;
});

export default Button;
