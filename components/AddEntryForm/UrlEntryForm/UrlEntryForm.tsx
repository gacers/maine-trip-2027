import type { FormEvent } from "react";
import type { TitleMatch } from "@/lib/types";
import styles from "./UrlEntryForm.module.css";

export interface UrlEntryFormProps {
  url: string;
  onUrlChange: (v: string) => void;
  loading: boolean;
  placeholder?: string | null;
  onSubmit: (e: FormEvent) => void;
  onStartBlank: () => void;
  /** Other trips'/sections' entries whose title matches what's typed so
   * far — see lib/entries.ts's searchEntriesByTitle. Empty hides the
   * dropdown entirely. */
  titleMatches: TitleMatch[];
  onPickTitleMatch: (match: TitleMatch) => void;
}

// The very first step — paste a link (or just type a name) and fetch,
// or skip straight to a blank manual entry.
export default function UrlEntryForm({
  url,
  onUrlChange,
  loading,
  placeholder,
  onSubmit,
  onStartBlank,
  titleMatches,
  onPickTitleMatch,
}: UrlEntryFormProps) {
  return (
    <form onSubmit={onSubmit} className={styles["root"]}>
      <div className={styles["input-wrap"]}>
        <div className={styles["row"]}>
          <input
            type="text"
            required
            placeholder={placeholder ?? undefined}
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            className={styles["input"]}
            autoComplete="off"
          />
          <button type="submit" disabled={loading} className={styles["submit"]}>
            {loading ? "Fetching..." : "Add"}
          </button>
        </div>
        {titleMatches.length > 0 && (
          <ul className={styles["match-list"]}>
            {titleMatches.map((match) => (
              <li key={match.id}>
                <button type="button" onClick={() => onPickTitleMatch(match)} className={styles["match-button"]}>
                  <span className={styles["match-title"]}>{match.title}</span>
                  <span className={styles["match-meta"]}>
                    {match.sectionLabel} · {match.tripName}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className={styles["hint"]}>
        A listing link, a full Google Maps link, or just type a name (e.g. &quot;Eventide Oyster Co.&quot;) all work. A
        share.google link usually can&apos;t be read automatically — type the name instead if it doesn&apos;t work.
      </p>
      {!loading && (
        <button type="button" onClick={onStartBlank} className={styles["start-blank"]}>
          Or start with a blank entry instead
        </button>
      )}
    </form>
  );
}
