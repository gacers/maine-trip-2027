import Link from "next/link";
import { SITE_CATEGORIES } from "@/lib/siteCategories";

export const dynamic = "force-dynamic";

/** Landing for /categories — pick a category tab (no redirect). */
export default function CategoriesIndexPage() {
  return (
    <main style={{ maxWidth: "40rem", margin: "0 auto", padding: "3rem 1rem" }}>
      <h1 style={{ margin: "0 0 0.75rem", fontSize: "var(--text-xl)", fontWeight: 600 }}>Categories</h1>
      <p style={{ margin: "0 0 1.25rem", color: "var(--color-zinc-500)", fontSize: "var(--text-sm)" }}>
        Browse places across every trip by category.
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {SITE_CATEGORIES.map((c) => (
          <li key={c.slug}>
            <Link href={`/categories/${c.slug}`} style={{ color: "var(--color-blue-600)" }}>
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
