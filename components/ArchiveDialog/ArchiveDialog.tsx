"use client";

import { useState } from "react";
import styles from "./ArchiveDialog.module.css";

const PRESET_REASONS = ["Too expensive", "Bad location"];

export interface ArchiveDialogProps {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

// Small inline popup (not a full modal) used by the Delete button on an
// active card: pick preset reasons and/or write a custom one, then
// archive. The item moves to the Archived list with that reason stored,
// and can still be restored from there.
export default function ArchiveDialog({ onConfirm, onCancel }: ArchiveDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [other, setOther] = useState("");

  function toggle(reason: string) {
    const next = new Set(selected);
    if (next.has(reason)) next.delete(reason);
    else next.add(reason);
    setSelected(next);
  }

  function confirm() {
    const reasons = [...selected];
    if (other.trim()) reasons.push(other.trim());
    onConfirm(reasons.join(", "));
  }

  return (
    <div className={styles.popup}>
      <div>
        <p className={styles.prompt}>Why archive this?</p>
        <div className={styles.presetList}>
          {PRESET_REASONS.map((reason) => (
            <label key={reason} className={styles.presetLabel}>
              <input
                type="checkbox"
                checked={selected.has(reason)}
                onChange={() => toggle(reason)}
                className={styles.checkbox}
              />
              {reason}
            </label>
          ))}
        </div>
      </div>
      <label className={styles.otherLabel}>
        Other (optional)
        <textarea
          value={other}
          onChange={(e) => setOther(e.target.value)}
          rows={2}
          placeholder="Any other reason..."
          className={styles.otherTextarea}
        />
      </label>
      <div className={styles.actions}>
        <button onClick={onCancel} className={styles.cancelButton}>
          Cancel
        </button>
        <button onClick={confirm} className={styles.archiveButton}>
          Archive
        </button>
      </div>
    </div>
  );
}
