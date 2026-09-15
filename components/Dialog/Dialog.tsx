"use client";

import { type ComponentPropsWithoutRef, forwardRef } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import classNames from "classnames";
import styles from "./Dialog.module.css";

// A styled wrapper around Radix's Dialog primitive — Radix owns the
// real behavior (focus trap, Escape/outside-click/overlay-click to
// close, returning focus to the trigger, scroll lock, portaling above
// everything else), this file owns 100% of the look via this project's
// own CSS Modules/tokens rather than Radix Themes. Root/Trigger/Close
// need no styling of their own and are re-exported as-is.
export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

type ContentProps = ComponentPropsWithoutRef<typeof RadixDialog.Content>;

export const DialogContent = forwardRef<HTMLDivElement, ContentProps>(function DialogContent(
  { className, children, ...props },
  ref
) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className={styles["overlay"]} />
      <RadixDialog.Content ref={ref} className={classNames(styles["content"], className)} {...props}>
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
});

type TitleProps = ComponentPropsWithoutRef<typeof RadixDialog.Title>;

export const DialogTitle = forwardRef<HTMLHeadingElement, TitleProps>(function DialogTitle(
  { className, ...props },
  ref
) {
  return <RadixDialog.Title ref={ref} className={classNames(styles["title"], className)} {...props} />;
});

type DescriptionProps = ComponentPropsWithoutRef<typeof RadixDialog.Description>;

export const DialogDescription = forwardRef<HTMLParagraphElement, DescriptionProps>(function DialogDescription(
  { className, ...props },
  ref
) {
  return <RadixDialog.Description ref={ref} className={classNames(styles["description"], className)} {...props} />;
});
