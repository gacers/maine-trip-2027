"use client";

import { type ComponentPropsWithoutRef, forwardRef } from "react";
import * as RadixNavigationMenu from "@radix-ui/react-navigation-menu";
import classNames from "classnames";
import styles from "./NavigationMenu.module.css";

// A styled wrapper around Radix's NavigationMenu primitive — Radix owns
// the real behavior (hover/click to open, roving-tabindex keyboard nav,
// outside-click/Escape to close, positioning the open panel under its
// trigger), this file owns 100% of the look via this project's own CSS
// Modules/tokens rather than Radix Themes. A plain top-level item is
// just Item > Link (e.g. a group with only one section); a top-level
// item with a real dropdown is Item > Trigger + Content, with Viewport
// (once, in Root) as where Radix actually portals whichever Content is
// currently open.

type RootProps = ComponentPropsWithoutRef<typeof RadixNavigationMenu.Root>;

export const NavigationMenu = forwardRef<HTMLElement, RootProps>(function NavigationMenu(
  { className, ...props },
  ref
) {
  return (
    <RadixNavigationMenu.Root ref={ref} className={classNames(styles["root"], className)} {...props} />
  );
});

type ListProps = ComponentPropsWithoutRef<typeof RadixNavigationMenu.List>;

export const NavigationMenuList = forwardRef<HTMLUListElement, ListProps>(function NavigationMenuList(
  { className, ...props },
  ref
) {
  return (
    <RadixNavigationMenu.List ref={ref} className={classNames(styles["list"], className)} {...props} />
  );
});

export const NavigationMenuItem = RadixNavigationMenu.Item;

export type NavigationMenuLinkSize = "md" | "sm" | "menu-item";

type LinkProps = ComponentPropsWithoutRef<typeof RadixNavigationMenu.Link> & { size?: NavigationMenuLinkSize };

export const NavigationMenuLink = forwardRef<HTMLAnchorElement, LinkProps>(function NavigationMenuLink(
  { className, size = "md", active, ...props },
  ref
) {
  return (
    <RadixNavigationMenu.Link
      ref={ref}
      active={active}
      data-active={active ? "" : undefined}
      className={classNames(styles["link"], styles[size], className)}
      {...props}
    />
  );
});

function ChevronIcon() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={styles["chevron"]}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

type TriggerProps = ComponentPropsWithoutRef<typeof RadixNavigationMenu.Trigger> & { active?: boolean };

export const NavigationMenuTrigger = forwardRef<HTMLButtonElement, TriggerProps>(function NavigationMenuTrigger(
  { className, children, active, ...props },
  ref
) {
  return (
    <RadixNavigationMenu.Trigger
      ref={ref}
      data-active={active ? "" : undefined}
      className={classNames(styles["trigger"], className)}
      {...props}
    >
      {children}
      <ChevronIcon />
    </RadixNavigationMenu.Trigger>
  );
});

type ContentProps = ComponentPropsWithoutRef<typeof RadixNavigationMenu.Content>;

export const NavigationMenuContent = forwardRef<HTMLDivElement, ContentProps>(function NavigationMenuContent(
  { className, ...props },
  ref
) {
  return <RadixNavigationMenu.Content ref={ref} className={classNames(styles["content"], className)} {...props} />;
});

export function NavigationMenuViewportWrapper() {
  return (
    <div className={styles["viewport-wrapper"]}>
      <RadixNavigationMenu.Viewport className={styles["viewport"]} />
    </div>
  );
}
