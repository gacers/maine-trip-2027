import styles from "./Spinner.module.css";

export interface SpinnerProps {
  /** Diameter in pixels. */
  size?: number;
  className?: string;
}

// A small rotating-ring loading indicator. Radix Primitives (unlike
// Themes, which this project deliberately doesn't use) has no spinner
// of its own to wrap — nothing here needs Radix's actual behavior
// (focus management, ARIA state machine, ...), just a visual, so this
// is a plain component styled off this project's own tokens like
// everything else.
export default function Spinner({ size = 32, className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={[styles.spinner, className].filter(Boolean).join(" ")}
      style={{ width: size, height: size }}
    />
  );
}
