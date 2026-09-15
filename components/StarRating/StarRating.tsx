"use client";

import styles from "./StarRating.module.css";

// A 5-star control with half-star granularity. Read-only mode (no
// onChange) just renders the fill; editable mode overlays two invisible
// half-width buttons per star so clicking the left/right half of a star
// sets it to X.5/X.
const STAR_COUNT = 5;

interface StarIconProps {
  size: number;
  filled: boolean;
  className?: string;
}

function StarIcon({ size, filled, className }: StarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
    >
      <path d="M12 2l2.9 6.26L21.5 9.27l-4.75 4.63L17.9 21 12 17.77 6.1 21l1.15-7.1L2.5 9.27l6.6-1.01z" />
    </svg>
  );
}

export interface StarRatingProps {
  value: number | null | undefined;
  onChange?: (value: number) => void;
  size?: number;
}

export default function StarRating({ value, onChange, size = 20 }: StarRatingProps) {
  const stars = Array.from({ length: STAR_COUNT }, (_, i) => i);
  const editable = typeof onChange === "function";

  return (
    <span className={styles["root"]}>
      {stars.map((i) => {
        const fillPercent = Math.max(0, Math.min(1, (value ?? 0) - i)) * 100;
        return (
          <span key={i} className={styles["star-box"]} style={{ width: size, height: size }}>
            <StarIcon size={size} filled={false} className={styles["outline"]} />
            <span className={styles["fill-clip"]} style={{ width: `${fillPercent}%` }}>
              <StarIcon size={size} filled className={styles["fill"]} />
            </span>
            {editable && (
              <>
                <button
                  type="button"
                  aria-label={`Rate ${i + 0.5} out of 5`}
                  className={styles["half-button"]}
                  onClick={() => onChange(i + 0.5)}
                />
                <button
                  type="button"
                  aria-label={`Rate ${i + 1} out of 5`}
                  className={styles["whole-button"]}
                  onClick={() => onChange(i + 1)}
                />
              </>
            )}
          </span>
        );
      })}
    </span>
  );
}
