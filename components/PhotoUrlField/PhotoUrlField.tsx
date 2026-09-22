"use client";

import { useRef, useState } from "react";
import styles from "./PhotoUrlField.module.css";

export interface PhotoUrlFieldProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  /** Label text — defaults to "Photo URL". */
  label?: string;
  className?: string;
  inputClassName?: string;
  /** When set, sent with the upload so invite-token contributors can auth. */
  tripSlug?: string;
  /** Invite / editor bearer token (same headers AddEntryForm uses). */
  authToken?: string | null;
}

/**
 * Photo URL text input + optional file upload. Upload hits
 * /api/media/upload and fills the same string field the save path
 * already persists (server also mirrors remote URLs into R2 on save).
 */
export default function PhotoUrlField({
  value,
  onChange,
  disabled = false,
  label = "Photo URL",
  className,
  inputClassName,
  tripSlug,
  authToken,
}: PhotoUrlFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File | null) {
    if (!file || disabled) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      if (tripSlug) form.set("tripSlug", tripSlug);
      const headers: Record<string, string> = {};
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch("/api/media/upload", { method: "POST", headers, body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChange(data.url as string);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className={className}>
      <span className={styles["label-text"]}>{label}</span>
      <div className={styles["row"]}>
        <input
          disabled={disabled || uploading}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… or upload"
          className={inputClassName}
        />
        {!disabled ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className={styles["file-input"]}
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              disabled={uploading}
              className={styles["upload-button"]}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </>
        ) : null}
      </div>
      {error ? <p className={styles["error"]}>{error}</p> : null}
    </div>
  );
}
