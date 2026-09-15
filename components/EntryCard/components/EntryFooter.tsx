import { useState } from "react";
import Button from "@/components/Button";
import ArchiveDialog from "@/components/ArchiveDialog";
import type { ClientEntry } from "@/lib/types";
import styles from "./EntryFooter.module.css";

export interface EntryFooterProps {
  entry: Pick<ClientEntry, "id" | "status" | "archiveReason">;
  supportsPairing: boolean;
  isEditing: boolean;
  hideMedia: boolean;
  onArchive: (reason: string) => void;
  onDelete: (id: string) => void;
  onRestore: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onAddPaired?: () => void;
}

// Delete/Edit/Archive/Restore/Pair — every action a card's own footer
// can take. Owns its own confirm-delete and archive-dialog-open state
// (purely local UI state, nothing the parent needs to know about).
export default function EntryFooter({
  entry,
  supportsPairing,
  isEditing,
  hideMedia,
  onArchive,
  onDelete,
  onRestore,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onAddPaired,
}: EntryFooterProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const isArchived = entry.status === "archived";

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
        ) : confirmingDelete ? (
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
        </>
      )}

      {!hideMedia && !isArchived && !isEditing && supportsPairing && onAddPaired && (
        <Button variant="ghost" size="sm" onClick={onAddPaired}>
          + Add paired option
        </Button>
      )}

      {isArchived && (
        <div className={styles["archived-actions"]}>
          {entry.archiveReason && <span className={styles["archive-reason"]}>{entry.archiveReason}</span>}
          <Button variant="link" size="sm" onClick={onRestore}>
            Restore
          </Button>
          {confirmingDelete ? (
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
          )}
        </div>
      )}
    </div>
  );
}
