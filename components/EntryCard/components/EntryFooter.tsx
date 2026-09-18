import { useState } from "react";
import Button from "@/components/Button";
import ArchiveDialog from "@/components/ArchiveDialog";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/Dialog";
import type { ClientEntry } from "@/lib/types";
import styles from "./EntryFooter.module.css";

export interface EntryFooterProps {
  entry: Pick<ClientEntry, "id" | "status">;
  supportsPairing: boolean;
  isEditing: boolean;
  hideMedia: boolean;
  /** A contributor (invite-link) gets everything else this footer can
   * do — edit, archive-with-a-reason (the pairing section's own
   * "Delete", which is really an archive), restore — but never a real
   * permanent delete, which stays owner-only. Only gates the two real
   * "Delete for good" spots below (the non-pairing flat-delete case,
   * and an already-archived entry's own delete); everything else here
   * renders whenever the footer itself does. */
  canDelete: boolean;
  onArchive: (reason: string) => void;
  onDelete: (id: string) => void;
  onRestore: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onAddPaired?: () => void;
  /** Admin-only wipe of every rater's score for this option (and its
   * pair partner when applicable). Only offered while editing. */
  onResetRankings?: () => void | Promise<void>;
}

// Delete/Edit/Archive/Restore/Pair — every action a card's own footer
// can take. Owns its own confirm-delete and archive-dialog-open state
// (purely local UI state, nothing the parent needs to know about).
export default function EntryFooter({
  entry,
  supportsPairing,
  isEditing,
  hideMedia,
  canDelete,
  onArchive,
  onDelete,
  onRestore,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onAddPaired,
  onResetRankings,
}: EntryFooterProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);
  const isArchived = entry.status === "archived";

  async function confirmResetRankings() {
    if (!onResetRankings) return;
    setResetting(true);
    try {
      await onResetRankings();
      setShowResetDialog(false);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className={styles["root"]}>
      {/* Archive-with-a-reason is worth it for a still-deciding Stay
          Option (the reason is the whole point — "why did we rule this
          out"). Everywhere else, ruling something out isn't really a
          decision worth remembering — a flat delete instead, same
          confirm pattern as an already-archived entry's own "Delete
          for good" below. */}
      {!isArchived &&
        (supportsPairing ? (
          // No wrapping div needed here — ArchiveDialog is a real modal
          // (portals to <body>), not an anchored popup, so there's
          // nothing left needing a positioning context. A wrapping div
          // would just be one more item for the footer's flex/align-
          // items:center to size, throwing off vertical centering
          // against the plain <Button> siblings around it.
          <>
            <Button variant="danger" size="sm" onClick={() => setShowArchiveDialog(true)}>
              Delete
            </Button>
            <ArchiveDialog
              open={showArchiveDialog}
              onOpenChange={setShowArchiveDialog}
              onConfirm={(reason) => {
                onArchive(reason);
                setShowArchiveDialog(false);
              }}
            />
          </>
        ) : (
          canDelete &&
          (confirmingDelete ? (
            <span className={styles["confirm-row"]}>
              Delete for good?
              <Button variant="danger" size="sm" onClick={() => onDelete(entry.id)}>
                Yes
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                No
              </Button>
            </span>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          ))))}

      {!isEditing ? (
        <Button variant="ghost" size="sm" onClick={onStartEdit}>
          Edit details
        </Button>
      ) : (
        <>
          <Button variant="primary" size="sm" onClick={onSaveEdit}>
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancelEdit}>
            Cancel
          </Button>
          {onResetRankings && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setShowResetDialog(true)}>
                Reset rankings
              </Button>
              <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <DialogContent>
                  <DialogTitle>Reset rankings for this option?</DialogTitle>
                  <DialogDescription>
                    Clears every rater&apos;s score for this stay option. This cannot be undone — people will need to
                    rate it again from scratch.
                  </DialogDescription>
                  <div className={styles["dialog-actions"]}>
                    <Button variant="ghost" size="sm" onClick={() => setShowResetDialog(false)} disabled={resetting}>
                      Cancel
                    </Button>
                    <Button variant="danger" size="sm" onClick={confirmResetRankings} disabled={resetting}>
                      {resetting ? "Resetting…" : "Reset rankings"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </>
      )}

      {!hideMedia && !isArchived && !isEditing && supportsPairing && onAddPaired && (
        <Button variant="ghost" size="sm" onClick={onAddPaired}>
          + Add paired option
        </Button>
      )}

      {isArchived && (
        <div className={styles["archived-actions"]}>
          {/* The reason itself is a full-width banner at the top of the
              card now (EntryCard.module.css's .archive-banner) — this
              tiny italic line next to Restore/Delete was easy to miss
              entirely, confirmed live. */}
          <Button variant="link" size="sm" onClick={onRestore}>
            Restore
          </Button>
          {canDelete &&
            (confirmingDelete ? (
              <span className={styles["confirm-row"]}>
                Delete for good?
                <Button variant="danger" size="sm" onClick={() => onDelete(entry.id)}>
                  Yes
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                  No
                </Button>
              </span>
            ) : (
              <Button variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>
                Delete
              </Button>
            ))}
        </div>
      )}
    </div>
  );
}
