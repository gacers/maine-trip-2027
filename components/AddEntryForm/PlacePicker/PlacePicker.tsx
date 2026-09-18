import type { PlaceResult } from "@/lib/types";
import styles from "./PlacePicker.module.css";

export interface PlacePickerProps {
  places: PlaceResult[];
  onChoose: (place: PlaceResult) => void;
  onCancel: () => void;
}

// A Google Maps/search link or a typed name resolves to a list of
// candidate Places (see AddEntryForm's own handlePreview) — pick the
// right one, or bail out entirely.
export default function PlacePicker({ places, onChoose, onCancel }: PlacePickerProps) {
  return (
    <div className={styles["root"]}>
      <p className={styles["hint"]}>Select the right place:</p>
      {places.map((place) => (
        <button key={place.id} type="button" onClick={() => onChoose(place)} className={styles["place"]}>
          {place.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={place.photoUrl} alt="" className={styles["photo"]} />
          ) : (
            <div className={styles["photo-fallback"]} />
          )}
          <div className={styles["info"]}>
            <div className={styles["title"]}>{place.title}</div>
            <div className={styles["address"]}>{place.address}</div>
          </div>
        </button>
      ))}
      <button type="button" onClick={onCancel} className={styles["cancel"]}>
        None of these — cancel
      </button>
    </div>
  );
}
