"use client";

// A 5-star control with half-star granularity. Read-only mode (no
// onChange) just renders the fill; editable mode overlays two invisible
// half-width buttons per star so clicking the left/right half of a star
// sets it to X.5/X.
const STAR_COUNT = 5;

function StarIcon({ size, filled, className }) {
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

export default function StarRating({ value, onChange, size = 20 }) {
  const stars = Array.from({ length: STAR_COUNT }, (_, i) => i);
  const editable = typeof onChange === "function";

  return (
    <span className="inline-flex items-center gap-0.5">
      {stars.map((i) => {
        const fillPercent = Math.max(0, Math.min(1, (value ?? 0) - i)) * 100;
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <StarIcon size={size} filled={false} className="absolute inset-0 text-zinc-300" />
            <span className="absolute inset-0 overflow-hidden pointer-events-none" style={{ width: `${fillPercent}%` }}>
              <StarIcon size={size} filled className="text-amber-400" />
            </span>
            {editable && (
              <>
                <button
                  type="button"
                  aria-label={`Rate ${i + 0.5} out of 5`}
                  className="absolute inset-y-0 left-0 cursor-pointer"
                  style={{ width: "50%" }}
                  onClick={() => onChange(i + 0.5)}
                />
                <button
                  type="button"
                  aria-label={`Rate ${i + 1} out of 5`}
                  className="absolute inset-y-0 right-0 cursor-pointer"
                  style={{ width: "50%" }}
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
