// "140 min" was accurate but harder to picture at a glance than
// "2h 20m" — used anywhere a stop's own duration is displayed
// (StopCard); DurationInput.tsx handles the editing side of the same
// change.
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
