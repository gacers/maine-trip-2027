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
}

// The Add form used to sit inline, always expanded, at the bottom of
// every section page. Now it's behind a button that opens it in a
// modal (same Radix Dialog pattern as RequestAccess) — the page itself
// stays focused on browsing instead of always showing a paste-a-URL
// form whether or not anyone's about to use it right now. Closes
// itself on a successful add (AddEntryForm's own onAdded still fires
// first, so SectionPage's entry list updates before the modal goes
// away) — reopening starts the form fresh since Radix unmounts Dialog
// content while closed.
export default function AddEntryDialog({ trip, section, navGroupSlug, authToken, onAdded }: AddEntryDialogProps) {
  const [open, setOpen] = useState(false);

  function handleAdded(entry: ClientEntry) {
    onAdded(entry);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          + Add to {section.label}
        </Button>
      </DialogTrigger>
      <DialogContent className={styles.content}>
        <DialogTitle>Add to {section.label}</DialogTitle>
        <AddEntryForm trip={trip} section={section} navGroupSlug={navGroupSlug} onAdded={handleAdded} authToken={authToken} bare />
      </DialogContent>
    </Dialog>
  );
}
