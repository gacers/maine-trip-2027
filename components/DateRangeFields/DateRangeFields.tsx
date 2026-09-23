"use client";

import type { ReactNode } from "react";
import styles from "./DateRangeFields.module.css";

export interface DateRangeFieldsProps {
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  /** "stacked" (default): each input gets its own label above it, in a
   * row that wraps on narrow screens — Trip Settings' date fields, New
   * Trip's. "inline": two bare inputs with a small arrow between them
   * and no labels of their own — an availability picker sitting right
   * under a listing's title, where the surrounding text already says
   * what these are. */
  layout?: "stacked" | "inline";
  /** stacked only. */
  startLabel?: ReactNode;
  endLabel?: ReactNode;
  /** stacked only — wraps the two <label> fields side by side. */
  rowClassName?: string;
  /** stacked only — applied to each <label>. */
  fieldClassName?: string;
  inputClassName?: string;
  /** inline only. */
  arrowClassName?: string;
}

// The one rule shared by every start/end date pair on the site: picking
// a start date also fills the end field with that same date whenever
// the end field is still empty, or would now fall before the new start
// — so opening the end date's own calendar starts right next to the
// trip's own dates instead of defaulting to today's month, which can be
// a year or more of scrolling away for a trip planned that far out.
// Never overwrites a genuinely later end date already chosen. `min` on
// the end input reinforces the same thing at the browser level.
export default function DateRangeFields({
  start,
  end,
  onStartChange,
  onEndChange,
  layout = "stacked",
  startLabel,
  endLabel,
  rowClassName,
  fieldClassName,
  inputClassName,
  arrowClassName,
}: DateRangeFieldsProps) {
  function handleStartChange(value: string) {
    onStartChange(value);
    if (value && (!end || end < value)) onEndChange(value);
  }

  const startInput = (
    <input type="date" value={start} onChange={(e) => handleStartChange(e.target.value)} className={inputClassName} />
  );
  const endInput = (
    <input
      type="date"
      value={end}
      onChange={(e) => onEndChange(e.target.value)}
      min={start || undefined}
      className={inputClassName}
    />
  );

  if (layout === "inline") {
    return (
      <>
        {startInput}
        <span className={arrowClassName || styles["arrow"]}>→</span>
        {endInput}
      </>
    );
  }

  return (
    <div className={rowClassName || styles["stacked-row"]}>
      <label className={fieldClassName || styles["field"]}>
        {startLabel}
        {startInput}
      </label>
      <label className={fieldClassName || styles["field"]}>
        {endLabel}
        {endInput}
      </label>
    </div>
  );
}
