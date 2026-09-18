import { useState, type FormEvent, type ReactNode } from "react";
import Button from "@/components/Button";
import BulletList from "@/components/BulletList";
import styles from "./EditableNoteList.module.css";

// Renders plain text with any http(s) URL inside it turned into a real
// clickable link — used for Notes/Concerns, where someone jotting down
// "check availability: https://..." expects that to be clickable rather
// than sitting there as dead text. Trailing punctuation (a period
// ending the sentence, a closing paren, ...) is kept out of the link
// itself so "see https://example.com." doesn't swallow the period.
function Linkified({ text }: { text: string }) {
  const re = /https?:\/\/[^\s]+/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    let url = match[0];
    let end = match.index + url.length;
    const trailingPunct = url.match(/[.,;:!?)\]}'"]+$/);
    if (trailingPunct) {
      url = url.slice(0, -trailingPunct[0].length);
      end -= trailingPunct[0].length;
    }
    if (!url) continue;
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <a key={match.index} href={url} target="_blank" rel="noopener noreferrer" className={styles["link"]}>
        {url}
      </a>
    );
    lastIndex = end;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

export interface EditableNoteListProps {
  items: string[];
  onAdd: ((text: string) => void) | null;
  onRemove: ((i: number) => void) | null;
  addLabel: string;
  placeholder: string;
}

// A BulletList whose items are removable on hover, plus a "+ Add ..."
// affordance that appends a new one via onAdd — used for Notes/
// Concerns. Appending goes through the entries PATCH route's
// appendNote/appendConcern (see that route), the same operation
// whether it's triggered by this button or by asking Claude Desktop to
// add one to an existing entry. `onAdd`/`onRemove` are omitted
// (undefined/null) to drop that capability entirely — used to gate
// add-only invite-link contributors (can add, can't remove) and
// read-only visitors (can't do either) down to the same shared markup.
export default function EditableNoteList({ items, onAdd, onRemove, addLabel, placeholder }: EditableNoteListProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    onAdd?.(draft.trim());
    setDraft("");
  }

  return (
    <div className={styles["root"]}>
      {items.length > 0 && (
        <BulletList>
          {items.map((item, i) => (
            <li key={i}>
              {onRemove ? (
                <span className={styles["removable-row"]}>
                  <span>
                    <Linkified text={item} />
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => onRemove(i)} className={styles["remove-button"]}>
                    Remove
                  </Button>
                </span>
              ) : (
                <Linkified text={item} />
              )}
            </li>
          ))}
        </BulletList>
      )}
      {onAdd &&
        (adding ? (
          <form onSubmit={submit} className={styles["add-form"]}>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              className={styles["add-input"]}
            />
            <Button type="submit" variant="link" size="sm">
              Add
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false);
                setDraft("");
              }}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <Button variant="link" size="sm" className={styles["add-trigger"]} onClick={() => setAdding(true)}>
            + {addLabel}
          </Button>
        ))}
    </div>
  );
}
