"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@/components/Dialog";
import Button from "@/components/Button";
import { SITE_CATEGORIES, type SiteCategorySlug } from "@/lib/siteCategories";
import type { FutureInterestItem } from "@/lib/futureInterest";
import styles from "./FutureInterestAddDialog.module.css";

export interface FutureInterestAddDialogProps {
  defaultCategory: SiteCategorySlug;
  onAdded: (item: FutureInterestItem) => void;
}

// Sticky-nav +Add for Future Interest — URL scrape or blank form, with
// a required category pick (the five site section types).
export default function FutureInterestAddDialog({ defaultCategory, onAdded }: FutureInterestAddDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"url" | "blank">("url");
  const [categorySlug, setCategorySlug] = useState<SiteCategorySlug>(defaultCategory);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [posterImage, setPosterImage] = useState("");
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) setCategorySlug(defaultCategory);
  }, [open, defaultCategory]);

  function reset() {
    setMode("url");
    setUrl("");
    setTitle("");
    setPosterImage("");
    setDescription("");
    setLat("");
    setLng("");
    setError("");
  }

  async function handlePreview(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/future-interest/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      const s = data.scraped || {};
      setUrl(s.normalizedUrl || s.url || url);
      setTitle(s.title || "");
      setPosterImage(s.posterImage || "");
      setDescription(s.description || "");
      if (s.lat != null) setLat(String(s.lat));
      if (s.lng != null) setLng(String(s.lng));
      setMode("blank");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/future-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categorySlug,
          title: title.trim() || null,
          url: url.trim() || null,
          posterImage: posterImage.trim() || null,
          description: description.trim() || null,
          lat: lat === "" ? null : Number(lat),
          lng: lng === "" ? null : Number(lng),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onAdded(data.item);
      setOpen(false);
      reset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          + Add
        </Button>
      </DialogTrigger>
      <DialogContent className={styles["content"]}>
        <DialogTitle>Add to Future Interest</DialogTitle>
        <label className={styles["field"]}>
          Category
          <select
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value as SiteCategorySlug)}
            className={styles["input"]}
            required
          >
            {SITE_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        {mode === "url" ? (
          <form onSubmit={handlePreview} className={styles["form"]}>
            <label className={styles["field"]}>
              URL
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className={styles["input"]}
                required
              />
            </label>
            <div className={styles["actions"]}>
              <Button type="submit" variant="primary" size="sm" disabled={busy || !url.trim()}>
                {busy ? "Looking up…" : "Look up URL"}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setMode("blank")}>
                Blank entry
              </Button>
            </div>
            {error && <p className={styles["error"]}>{error}</p>}
          </form>
        ) : (
          <form onSubmit={handleSave} className={styles["form"]}>
            <label className={styles["field"]}>
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={styles["input"]} required />
            </label>
            <label className={styles["field"]}>
              URL
              <input value={url} onChange={(e) => setUrl(e.target.value)} className={styles["input"]} />
            </label>
            <label className={styles["field"]}>
              Photo URL
              <input value={posterImage} onChange={(e) => setPosterImage(e.target.value)} className={styles["input"]} />
            </label>
            <label className={styles["field"]}>
              Description
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={styles["input"]} />
            </label>
            <div className={styles["row"]}>
              <label className={styles["field"]}>
                Lat
                <input value={lat} onChange={(e) => setLat(e.target.value)} className={styles["input"]} />
              </label>
              <label className={styles["field"]}>
                Lng
                <input value={lng} onChange={(e) => setLng(e.target.value)} className={styles["input"]} />
              </label>
            </div>
            <div className={styles["actions"]}>
              <Button type="submit" variant="primary" size="sm" disabled={busy || !title.trim()}>
                {busy ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setMode("url")}>
                Back to URL
              </Button>
            </div>
            {error && <p className={styles["error"]}>{error}</p>}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
