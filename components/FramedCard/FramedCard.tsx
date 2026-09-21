import classNames from "classnames";
import type { ElementType, HTMLAttributes, ReactNode } from "react";
import styles from "./FramedCard.module.css";

export interface FramedCardProps extends HTMLAttributes<HTMLElement> {
  /** Element to render — article for EntryCard, li for Catalog, div for groups. */
  as?: ElementType;
  children?: ReactNode;
}

/**
 * Shared card chrome (radius, border, shadow) — EntryCard, Catalog cards,
 * and paired ListingSection groups all compose this so framing stays one
 * place instead of drifting per surface.
 */
export default function FramedCard({ as: Comp = "div", className, children, ...props }: FramedCardProps) {
  return (
    <Comp className={classNames(styles["root"], className)} {...props}>
      {children}
    </Comp>
  );
}
