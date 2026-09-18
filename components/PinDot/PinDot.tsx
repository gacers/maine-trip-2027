import styles from "./PinDot.module.css";

export interface PinDotProps {
  /** Same color OverviewMap gave this listing's own marker (see
   * lib/pinColors) — lets someone visually pair a list item back to
   * its pin without clicking it first. */
  color: string;
  className?: string;
}

// A small colored disc, nothing else — nudge title text over instead
// of centering it, so it reads as "this item's own marker" rather than
// a bullet.
export default function PinDot({ color, className }: PinDotProps) {
  return <span className={className ? `${styles["dot"]} ${className}` : styles["dot"]} style={{ backgroundColor: color }} aria-hidden />;
}
