"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import styles from "./ShowMore.module.css";

export interface ShowMoreProps {
  children: ReactNode;
  /** Collapsed height in pixels before a "Show more" button appears at
   * all — content shorter than this renders plain, no button, no fade,
   * no wrapper overhead. Defaults to 320 (a card's own Description). */
  maxHeight?: number;
  /** The color the bottom fade blends into — must match whatever's
   * actually behind this content (a card section's own background).
   * Defaults to white. */
  fadeColor?: string;
  className?: string;
}

// Generic "clip tall content behind a fade + Show more/Show less
// toggle" — built for EntryCard's own Description, but deliberately
// content-agnostic (children-based, like BulletList) so anything else
// that can run long reuses this instead of growing its own version.
// Measures the real content height (ResizeObserver, not just on
// mount — a card's own reflow, a window resize, or content changing
// after the fact all need to be tracked) and only engages the
// clip/fade/button at all once content actually exceeds maxHeight.
// Expand/collapse animates via max-height transitioning between
// maxHeight and the real measured height — CSS can't animate to/from
// `auto`, so this tracks the actual pixel height instead.
export default function ShowMore({ children, maxHeight = 320, fadeColor = "var(--color-white)", className }: ShowMoreProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setContentHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const overflowing = contentHeight != null && contentHeight > maxHeight;
  // Transitioning max-height *to or from* `none` (its default, i.e.
  // "not yet measured"/"doesn't overflow") isn't animatable in any
  // browser — only expand/collapse, both real pixel values on both
  // ends, actually plays the transition. Nothing extra needed to
  // suppress an unwanted animation on first mount/measurement.
  const style: CSSProperties | undefined = overflowing ? { maxHeight: expanded ? contentHeight! : maxHeight } : undefined;

  return (
    <div className={[styles.wrapper, className].filter(Boolean).join(" ")}>
      <div ref={contentRef} className={styles.content} style={style}>
        {children}
        {/* Lives inside .content (not as a sibling) so it always sits
            flush against the real bottom edge of the clipped box,
            whatever the toggle button's own height happens to be —
            .content's own overflow:hidden only clips what's outside
            that box, not this. */}
        {overflowing && !expanded && <div className={styles.fade} style={{ ["--show-more-fade-color" as string]: fadeColor }} />}
      </div>
      {overflowing && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className={styles.toggleButton}>
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
