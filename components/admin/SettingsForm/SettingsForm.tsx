"use client";

import { useState, type FormEvent } from "react";
import type { AppSettings } from "@/lib/types";
import styles from "./SettingsForm.module.css";

// Accepts either a bare folder ID or a full Drive folder URL (pasting
// the URL is much more natural than hunting out the ID yourself).
function extractFolderId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : trimmed;
}

export interface SettingsFormProps {
  settings: AppSettings | null;
}

export default function SettingsForm({ settings }: SettingsFormProps) {
  const [folderInput, setFolderInput] = useState(settings?.google_drive_folder_id || "");
  const [siteUrl, setSiteUrl] = useState(settings?.site_url || "");
  const [contactEmail, setContactEmail] = useState(settings?.contact_email || "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleDriveFolderId: extractFolderId(folderInput),
          siteUrl: siteUrl.replace(/\/$/, ""),
          contactEmail: contactEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setFolderInput(data.settings.google_drive_folder_id || "");
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <h2 className={styles.fieldTitle}>Trip export folder</h2>
        <p className={styles.fieldHint}>
          Every trip&apos;s auto-generated Google Sheet gets created inside this Google Drive folder.
          Change it anytime — future exports use the new folder; existing trips keep the Sheet they
          already have.
        </p>
        <input
          value={folderInput}
          onChange={(e) => setFolderInput(e.target.value)}
          placeholder="Paste a Drive folder URL or ID"
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <h2 className={styles.fieldTitle}>Site URL</h2>
        <p className={styles.fieldHint}>
          Used to build the links back to the live site from each trip&apos;s exported Sheet.
        </p>
        <input
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          placeholder="https://www.example.com"
          className={styles.input}
        />
      </div>

      <div className={styles.field}>
        <h2 className={styles.fieldTitle}>Access request email</h2>
        <p className={styles.fieldHint}>
          Shown to visitors without an invite link as who to email for access — see the &quot;Request
          access&quot; button on a trip page.
        </p>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="you@example.com"
          className={styles.input}
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {saved && <p className={styles.success}>Saved.</p>}

      <button type="submit" disabled={saving} className={styles.submitButton}>
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
