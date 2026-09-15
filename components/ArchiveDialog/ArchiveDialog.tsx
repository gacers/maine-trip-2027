"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/Dialog";
import Button from "@/components/Button";
import styles from "./ArchiveDialog.module.css";

const PRESET_REASONS = ["Too expensive", "Bad location"];

export interface ArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}

// A real modal (Radix Dialog) — this used to be an absolutely-
// positioned inline popup anchored to the Delete button, which got
// clipped by EntryCard's own overflow:hidden (needed for the header
// photo's rounded corners) whenever Delete sat near the bottom of a
// tall card: rendered, but invisible, with no way to scroll it into
// view. A Dialog portals to the end of <body>, so it can't be clipped
// by any ancestor regardless of where its trigger sits on the page.
export default function ArchiveDialog({ open, onOpenChange, onConfirm }: ArchiveDialogProps) {
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
    setSelected(new Set());
    setOther("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Why archive this?</DialogTitle>
        <div className={styles["preset-list"]}>
          {PRESET_REASONS.map((reason) => (
            <label key={reason} className={styles["preset-label"]}>
              <input
                type="checkbox"
                checked={selected.has(reason)}
                onChange={() => toggle(reason)}
                className={styles["checkbox"]}
              />
              {reason}
            </label>
          ))}
        </div>
        <label className={styles["other-label"]}>
          Other (optional)
          <textarea
            value={other}
            onChange={(e) => setOther(e.target.value)}
            rows={2}
            placeholder="Any other reason..."
            className={styles["other-textarea"]}
          />
        </label>
        <div className={styles["actions"]}>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={confirm}>
            Archive
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
