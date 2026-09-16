import type { ItineraryStopKind, ItineraryStopStatus, TravelMode } from "@/lib/types";
import styles from "./StopScheduleFields.module.css";

export interface StopScheduleValues {
  kind: ItineraryStopKind;
  status: ItineraryStopStatus;
  date: string;
  time: string;
  durationMinutes: string;
  travelMode: TravelMode;
  notes: string;
}

export interface StopScheduleFieldsProps {
  values: StopScheduleValues;
  onChange: (values: StopScheduleValues) => void;
  /** Hide the travel-mode picker — irrelevant for a stop with no
   * lat/lng of its own (a flight, a ferry) since there's no leg for
   * the Directions API to compute here at all. */
  showTravelMode: boolean;
}

const KIND_LABELS: Record<ItineraryStopKind, string> = {
  lodging: "Lodging",
  activity: "Activity",
  meal: "Meal",
  transport: "Transport",
  other: "Other",
};

const STATUS_LABELS: Record<ItineraryStopStatus, string> = {
  tentative: "Tentative — still deciding",
  confirmed: "Confirmed / booked",
  archived: "Archived — considered, not doing",
};

const TRAVEL_MODE_LABELS: Record<TravelMode, string> = {
  driving: "Driving",
  walking: "Walking",
  transit: "Transit",
  bicycling: "Bicycling",
};

// The fields every stop shares regardless of whether it links to an
// existing entry or stands alone — shared between AddStopDialog and
// EditStopDialog rather than duplicated in both.
export default function StopScheduleFields({ values, onChange, showTravelMode }: StopScheduleFieldsProps) {
  function set<K extends keyof StopScheduleValues>(key: K, value: StopScheduleValues[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className={styles["grid"]}>
      <label className={styles["field"]}>
        Kind
        <select value={values.kind} onChange={(e) => set("kind", e.target.value as ItineraryStopKind)} className={styles["input"]}>
          {Object.entries(KIND_LABELS).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles["field"]}>
        Status
        <select value={values.status} onChange={(e) => set("status", e.target.value as ItineraryStopStatus)} className={styles["input"]}>
          {Object.entries(STATUS_LABELS).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles["field"]}>
        Date
        <input type="date" value={values.date} onChange={(e) => set("date", e.target.value)} className={styles["input"]} />
      </label>
      <label className={styles["field"]}>
        Time
        <input type="time" value={values.time} onChange={(e) => set("time", e.target.value)} className={styles["input"]} />
      </label>
      <label className={styles["field"]}>
        Duration (minutes)
        <input
          type="number"
          min={0}
          value={values.durationMinutes}
          onChange={(e) => set("durationMinutes", e.target.value)}
          className={styles["input"]}
        />
      </label>
      {showTravelMode && (
        <label className={styles["field"]}>
          Travel mode (arriving here)
          <select value={values.travelMode} onChange={(e) => set("travelMode", e.target.value as TravelMode)} className={styles["input"]}>
            {Object.entries(TRAVEL_MODE_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={styles["field-full"]}>
        Notes
        <textarea
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          placeholder="Address, phone, booking confirmation, caveats..."
          className={styles["textarea"]}
        />
      </label>
    </div>
  );
}
