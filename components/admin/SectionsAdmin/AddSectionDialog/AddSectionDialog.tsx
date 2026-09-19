"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/Dialog";
import Button from "@/components/Button";
import styles from "./AddSectionDialog.module.css";

export interface AddSectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  primaryLabel: string;
  counterpartLabel: string;
  onConfirm: (withCounterpart: boolean) => void;
  creating: boolean;
}

// Real modal (Radix Dialog, same as ArchiveDialog) confirming whether
// to also create a "Visited ..." counterpart alongside a template's
// own primary section — replaces a plain window.confirm, which looked
// like a bare browser prompt with no way to see what would actually
// get created before committing (confirmed live as genuinely
// confusing next to everything else here already using real dialogs).
// A checkbox instead of Yes/No specifically because "add the
// counterpart" is the actual decision being made, not a yes/no
// question about the primary section itself (that's already
// happening either way the moment this opens).
export default function AddSectionDialog({ open, onOpenChange, primaryLabel, counterpartLabel, onConfirm, creating }: AddSectionDialogProps) {
  const [withCounterpart, setWithCounterpart] = useState(false);

  // Resets for the next time this opens (a different template) rather
  // than carrying the previous choice forward — onOpenChange(false)
  // covers Cancel and Radix's own outside-click/Escape dismissal.
  function handleOpenChange(next: boolean) {
    if (!next) setWithCounterpart(false);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogTitle>Add &quot;{primaryLabel}&quot;</DialogTitle>
        <label className={styles["checkbox-label"]}>
          <input
            type="checkbox"
            checked={withCounterpart}
            onChange={(e) => setWithCounterpart(e.target.checked)}
            className={styles["checkbox"]}
          />
          Also create a &quot;{counterpartLabel}&quot; counterpart
        </label>
        <div className={styles["actions"]}>
          <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={() => onConfirm(withCounterpart)} disabled={creating}>
            {creating ? "Creating..." : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
