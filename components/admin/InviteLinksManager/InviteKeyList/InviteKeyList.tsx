import type { ApiKey } from "@/lib/types";
import styles from "./InviteKeyList.module.css";

export interface InviteKeyListProps {
  loading: boolean;
  keys: ApiKey[];
  revealed: Record<string, string>;
  onReveal: (id: string) => void;
  onRevoke: (id: string) => void;
}

// Every still-live invite link, each with its own Show/Revoke — the
// caller (InviteLinksManager) already filters out revoked ones before
// they ever reach here, so every card rendered is active by
// definition; no disabled/greyed-out state to render. "Show" only
// appears once (hasStoredToken and not already revealed), re-fetching
// the real token on demand rather than keeping it around client-side
// the whole time.
export default function InviteKeyList({ loading, keys, revealed, onReveal, onRevoke }: InviteKeyListProps) {
  if (loading) return <p className={styles["muted"]}>Loading...</p>;
  if (keys.length === 0) return <p className={styles["muted"]}>No invite links yet.</p>;

  return (
    <div className={styles["list"]}>
      {keys.map((k) => (
        <div key={k.id} className={styles["card"]}>
          <div className={styles["card-top"]}>
            <div>
              <div className={styles["label"]}>{k.label}</div>
              <div className={styles["meta"]}>
                Created {new Date(k.created_at).toLocaleDateString()}
                {k.last_used_at && ` · last used ${new Date(k.last_used_at).toLocaleDateString()}`}
              </div>
            </div>
            <div className={styles["actions"]}>
              {k.hasStoredToken && !revealed[k.id] && (
                <button onClick={() => onReveal(k.id)} className={styles["show-button"]}>
                  Show
                </button>
              )}
              <button onClick={() => onRevoke(k.id)} className={styles["revoke-button"]}>
                Revoke
              </button>
            </div>
          </div>
          {revealed[k.id] && <code className={styles["link-code"]}>{revealed[k.id]}</code>}
        </div>
      ))}
    </div>
  );
}
