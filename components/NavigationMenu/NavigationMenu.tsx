"use client";

import { type ComponentPropsWithoutRef, forwardRef } from "react";
import * as RadixNavigationMenu from "@radix-ui/react-navigation-menu";
import styles from "./NavigationMenu.module.css";

// A styled wrapper around Radix's NavigationMenu primitive, used as a
// plain (no hover-flyout) horizontal link list: Root > List > Item >
// Link, which is enough on its own to get Radix's roving-tabindex
// keyboard navigation (arrow keys move focus along the row) and
// aria-current semantics via Link's `active` prop — real behavior this
// project's own plain <a> pills didn't have, on top of this project's
// own look via CSS Modules/tokens rather than Radix Themes. Trigger/
// Content/Viewport (Radix's actual hover-flyout mega-menu pieces)
// aren't used here; add them if a future nav item needs a real flyout.

type RootProps = ComponentPropsWithoutRef<typeof RadixNavigationMenu.Root>;

export const NavigationMenu = forwardRef<HTMLElement, RootProps>(function NavigationMenu(
  { className, ...props },
  ref
) {
  return (
    <RadixNavigationMenu.Root
      ref={ref}
      className={[styles.root, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
});

type ListProps = ComponentPropsWithoutRef<typeof RadixNavigationMenu.List>;

export const NavigationMenuList = forwardRef<HTMLUListElement, ListProps>(function NavigationMenuList(
  { className, ...props },
  ref
) {
  return (
    <RadixNavigationMenu.List ref={ref} className={[styles.list, className].filter(Boolean).join(" ")} {...props} />
  );
});

export const NavigationMenuItem = RadixNavigationMenu.Item;

export type NavigationMenuLinkSize = "md" | "sm";

type LinkProps = ComponentPropsWithoutRef<typeof RadixNavigationMenu.Link> & { size?: NavigationMenuLinkSize };

export const NavigationMenuLink = forwardRef<HTMLAnchorElement, LinkProps>(function NavigationMenuLink(
  { className, size = "md", ...props },
  ref
) {
  return (
    <RadixNavigationMenu.Link
      ref={ref}
      className={[styles.link, styles[size], className].filter(Boolean).join(" ")}
      {...props}
    />
  );
});
