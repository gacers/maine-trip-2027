import FieldInput from "@/components/FieldInput";
import type { FieldDef } from "@/lib/types";
import type { CoreFields } from "../CoreFieldsGrid";
import styles from "./PairFieldsBox.module.css";

export type PairPhase = "none" | "input" | "loading" | "ready";

export interface PairFieldsBoxProps {
  supportsPairing: boolean;
  pairPhase: PairPhase;
  onOpen: () => void;
  onCancel: () => void;
  pairUrl: string;
  onPairUrlChange: (v: string) => void;
  onFetch: () => void;
  pairError: string;
  pairCookieWarning: string | null;
  pairWarnings: string[];
  pairFields: CoreFields;
  onPairFieldsChange: (fields: CoreFields) => void;
  pairData: Record<string, unknown>;
  onPairDataChange: (data: Record<string, unknown>) => void;
  fieldDefs: FieldDef[];
  tripNights: number | null;
  groupLabel: string;
  onGroupLabelChange: (v: string) => void;
  presetGroupLabel: string;
}

// "Pair with a second link" — the manual-input equivalent of the AI
// agent's paired-URL add (both entries end up sharing one groupLabel;
// lib/groupUnits.ts renders any two entries sharing one as a single
// card/map/rank). A grid item alongside CoreFieldsGrid's own fields
// (spans both columns at 640px), not nested inside it. Self-gates on
// `supportsPairing` — pairing (2-item options) is a Houses/Stays-only
// concept, so a section that doesn't support it shows nothing here at
// all rather than a confusing field with no visible effect.
export default function PairFieldsBox({
  supportsPairing,
  pairPhase,
  onOpen,
  onCancel,
  pairUrl,
  onPairUrlChange,
  onFetch,
  pairError,
  pairCookieWarning,
  pairWarnings,
  pairFields,
  onPairFieldsChange,
  pairData,
  onPairDataChange,
  fieldDefs,
  tripNights,
  groupLabel,
  onGroupLabelChange,
  presetGroupLabel,
}: PairFieldsBoxProps) {
  if (!supportsPairing) return null;

  return (
    <div className={styles["root"]}>
      <div className={styles["header"]}>
        <h3 className={styles["title"]}>Pair with a second link (2-item option)</h3>
        {pairPhase === "none" ? (
          <button type="button" onClick={onOpen} className={styles["toggle-add"]}>
            + Add another
          </button>
        ) : (
          <button type="button" onClick={onCancel} className={styles["toggle-remove"]}>
            Remove
          </button>
        )}
      </div>

      {(pairPhase === "input" || pairPhase === "loading") && (
        <div className={styles["url-row"]}>
          <input
            type="text"
            placeholder="Paste the second link..."
            value={pairUrl}
            onChange={(e) => onPairUrlChange(e.target.value)}
            className={styles["url-input"]}
          />
          <button type="button" onClick={onFetch} disabled={pairPhase === "loading" || !pairUrl.trim()} className={styles["fetch-button"]}>
            {pairPhase === "loading" ? "Fetching..." : "Fetch"}
          </button>
        </div>
      )}
      {pairError && <p className={styles["error"]}>{pairError}</p>}

      {pairPhase === "ready" && (
        <div className={styles["ready-box"]}>
          {pairCookieWarning && <p className={styles["cookie-warning"]}>{pairCookieWarning}</p>}
          {pairWarnings.length > 0 && (
            <ul className={styles["warnings-list"]}>
              {pairWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <div className={styles["grid"]}>
            <label className={styles["field"]}>
              Title
              <input
                required
                value={pairFields.title}
                onChange={(e) => onPairFieldsChange({ ...pairFields, title: e.target.value })}
                className={styles["input"]}
              />
            </label>
            <label className={styles["field"]}>
              Photo URL
              <input
                value={pairFields.posterImage}
                onChange={(e) => onPairFieldsChange({ ...pairFields, posterImage: e.target.value })}
                className={styles["input"]}
              />
            </label>
            <label className={styles["field"]}>
              Latitude
              <input
                value={pairFields.lat}
                onChange={(e) => onPairFieldsChange({ ...pairFields, lat: e.target.value })}
                className={styles["input"]}
              />
            </label>
            <label className={styles["field"]}>
              Longitude
              <input
                value={pairFields.lng}
                onChange={(e) => onPairFieldsChange({ ...pairFields, lng: e.target.value })}
                className={styles["input"]}
              />
            </label>
            {fieldDefs.length > 0 && (
              <div className={styles["pair-field-defs-grid"]}>
                {fieldDefs.map((f) => (
                  <FieldInput
                    key={f.key}
                    fieldDef={f}
                    value={pairData[f.key]}
                    onChange={(v) => onPairDataChange({ ...pairData, [f.key]: v })}
                    tripNights={tripNights}
                  />
                ))}
              </div>
            )}
          </div>
          <p className={styles["edit-hint"]}>
            Notes, concerns, and description can be added to this one afterward via its own &quot;Edit details.&quot;
          </p>
        </div>
      )}

      <label className={styles["field"]}>
        Group label
        {pairPhase === "ready" || presetGroupLabel ? "" : " (optional — only if this is a 2-item option)"}
        <input
          value={groupLabel}
          onChange={(e) => onGroupLabelChange(e.target.value)}
          placeholder='e.g. "Jonesport - 2 House Option" (use the exact same text on both)'
          className={styles["input"]}
        />
      </label>
    </div>
  );
}
