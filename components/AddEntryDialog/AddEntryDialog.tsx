"use client";

import { useState } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@/components/Dialog";
import Button from "@/components/Button";
import AddEntryForm from "@/components/AddEntryForm";
import type { PublicTrip, Section, ClientEntry } from "@/lib/types";
import styles from "./AddEntryDialog.module.css";

export interface AddEntryDialogProps {
  trip: PublicTrip;
  section: Section;
  navGroupSlug: string;
  authToken: string | null;
  onAdded: (entry: ClientEntry) => void;
  /** "This is already on the list, but I actually want to pair it with
   * something new too" — see AddEntryForm's own onRequestPairExisting.
   * Closes this dialog and hands off to SectionPage's own
   * requestPair/PairEntryDialog flow. Optional purely so a caller that
   * doesn't have that flow wired up (there isn't one today, but this
   * keeps the two components decoupled) still works. */
  onRequestPairExisting?: (entry: ClientEntry) => void;
}

// The Add form used to sit inline, always expanded, at the bottom of
// every section page. Now it's behind a button that opens it in a
// modal (same Radix Dialog pattern as RequestAccess) — the page itself
// stays focused on browsing instead of always showing a paste-a-URL
// form whether or not anyone's about to use it right now. Closes
// itself once the whole submission is done (AddEntryForm's own
// onSaveComplete, not onAdded — a paired add fires onAdded twice, and
// closing on the first one unmounts the form mid-save, since Radix
// unmounts Dialog content while closed, silently dropping the second
// entry; confirmed live, not hypothetical) — reopening starts the form
// fresh either way.
export default function AddEntryDialog({
  trip,
  section,
  navGroupSlug,
  authToken,
  onAdded,
  onRequestPairExisting,
}: AddEntryDialogProps) {
  const [open, setOpen] = useState(false);

  function handleRequestPairExisting(entry: ClientEntry) {
    setOpen(false);
    onRequestPairExisting?.(entry);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          + Add to {section.label}
        </Button>
      </DialogTrigger>
      <DialogContent className={styles["content"]}>
        <DialogTitle>Add to {section.label}</DialogTitle>
        <AddEntryForm
          trip={trip}
          section={section}
          navGroupSlug={navGroupSlug}
          onAdded={onAdded}
          onSaveComplete={() => setOpen(false)}
          authToken={authToken}
          onRequestPairExisting={onRequestPairExisting ? handleRequestPairExisting : undefined}
          bare
        />
      </DialogContent>
    </Dialog>
  );
}
