"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/Dialog";
import AddEntryForm from "@/components/AddEntryForm";
import type { PublicTrip, Section, ClientEntry } from "@/lib/types";
import styles from "./PairEntryDialog.module.css";

export interface PairEntryDialogProps {
  trip: PublicTrip;
  section: Section;
  navGroupSlug: string;
  authToken: string | null;
  /** The existing entry's own groupLabel — assigned on the spot from
   * its title if it didn't have one yet (see SectionPage's
   * requestPair). Seeds AddEntryForm's Group label field so whatever
   * gets added here automatically pairs with that entry the same way
   * any two entries sharing a groupLabel do (lib/groupUnits.ts). */
  presetGroupLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (entry: ClientEntry) => void;
  /** Fires once the whole submission is actually done — see
   * AddEntryForm's own doc comment on why this (not onAdded) is what
   * should close the dialog. */
  onSaveComplete?: () => void;
}

// Pairs a brand-new listing with an already-saved solo entry — opened
// from that entry's own "+ Add paired option" button (see EntryCard),
// unlike AddEntryDialog's usual from-scratch flow (which only helps
// when creating both halves of a pair together in one sitting).
export default function PairEntryDialog({
  trip,
  section,
  navGroupSlug,
  authToken,
  presetGroupLabel,
  open,
  onOpenChange,
  onAdded,
  onSaveComplete,
}: PairEntryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.content}>
        <DialogTitle>Add a paired option</DialogTitle>
        <AddEntryForm
          trip={trip}
          section={section}
          navGroupSlug={navGroupSlug}
          onAdded={onAdded}
          onSaveComplete={onSaveComplete}
          authToken={authToken}
          presetGroupLabel={presetGroupLabel}
          bare
        />
      </DialogContent>
    </Dialog>
  );
}
