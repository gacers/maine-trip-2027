"use client";

import { type ComponentPropsWithoutRef, forwardRef } from "react";
import * as RadixDropdownMenu from "@radix-ui/react-dropdown-menu";
import styles from "./DropdownMenu.module.css";

// A styled wrapper around Radix's DropdownMenu primitive — Radix owns
// the actual behavior (focus trap, outside-click/Escape to close,
// keyboard navigation, positioning), this file owns 100% of the look
// via this project's own CSS Modules/design tokens rather than Radix
// Themes. Re-export the pieces that need no styling of their own
// (Root/Trigger/Group/Sub, ...) straight from Radix; everything with
// real chrome (Content, the item types, Label, Separator) gets a
// styled wrapper below. Add pieces here as new call sites need them.
export const DropdownMenu = RadixDropdownMenu.Root;
export const DropdownMenuTrigger = RadixDropdownMenu.Trigger;

function CheckIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

type ContentProps = ComponentPropsWithoutRef<typeof RadixDropdownMenu.Content>;

export const DropdownMenuContent = forwardRef<HTMLDivElement, ContentProps>(function DropdownMenuContent(
  { className, align = "start", sideOffset = 6, ...props },
  ref
) {
  return (
    <RadixDropdownMenu.Portal>
      <RadixDropdownMenu.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={[styles.content, className].filter(Boolean).join(" ")}
        {...props}
      />
    </RadixDropdownMenu.Portal>
  );
});

type CheckboxItemProps = ComponentPropsWithoutRef<typeof RadixDropdownMenu.CheckboxItem>;

export const DropdownMenuCheckboxItem = forwardRef<HTMLDivElement, CheckboxItemProps>(function DropdownMenuCheckboxItem(
  { className, children, ...props },
  ref
) {
  return (
    <RadixDropdownMenu.CheckboxItem
      ref={ref}
      className={[styles.checkboxItem, className].filter(Boolean).join(" ")}
      {...props}
    >
      <span className={styles.indicator}>
        <RadixDropdownMenu.ItemIndicator>
          <CheckIcon />
        </RadixDropdownMenu.ItemIndicator>
      </span>
      {children}
    </RadixDropdownMenu.CheckboxItem>
  );
});

type ItemProps = ComponentPropsWithoutRef<typeof RadixDropdownMenu.Item>;

export const DropdownMenuItem = forwardRef<HTMLDivElement, ItemProps>(function DropdownMenuItem(
  { className, ...props },
  ref
) {
  return <RadixDropdownMenu.Item ref={ref} className={[styles.item, className].filter(Boolean).join(" ")} {...props} />;
});

type LabelProps = ComponentPropsWithoutRef<typeof RadixDropdownMenu.Label>;

export const DropdownMenuLabel = forwardRef<HTMLDivElement, LabelProps>(function DropdownMenuLabel(
  { className, ...props },
  ref
) {
  return <RadixDropdownMenu.Label ref={ref} className={[styles.label, className].filter(Boolean).join(" ")} {...props} />;
});

type SeparatorProps = ComponentPropsWithoutRef<typeof RadixDropdownMenu.Separator>;

export const DropdownMenuSeparator = forwardRef<HTMLDivElement, SeparatorProps>(function DropdownMenuSeparator(
  { className, ...props },
  ref
) {
  return (
    <RadixDropdownMenu.Separator ref={ref} className={[styles.separator, className].filter(Boolean).join(" ")} {...props} />
  );
});
