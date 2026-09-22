import Link from "next/link";
import { canAccessSiteCatalog } from "@/lib/auth";
import { enabledCategoryTabs, getSurfaceCategorySettings } from "@/lib/siteSurfaceSettings";

export const dynamic = "force-dynamic";

/** Landing for /future-interests — pick a category (no redirect). Nav links go straight to a slug. */
export default async function FutureInterestsIndexPage() {
  const canAccess = await canAccessSiteCatalog();
  if (!canAccess) {
    return (
      <main style={{ maxWidth: "var(--content-max-width)", margin: "0 auto", padding: "3rem 1rem" }}>
        <p style={{ color: "var(--color-zinc-500)", textAlign: "center" }}>
          Sign in as an admin to manage Future Interests.
        </p>
      </main>
    );
  }

  const settings = await getSurfaceCategorySettings("future-interests");
  const tabs = enabledCategoryTabs(settings);

  return (
    <main style={{ maxWidth: "var(--content-max-width)", margin: "0 auto", padding: "3rem 1rem" }}>
      <h1 style={{ margin: "0 0 0.75rem", fontSize: "var(--text-xl)", fontWeight: 600 }}>
        Future Interests
      </h1>
      <p style={{ margin: "0 0 1.25rem", color: "var(--color-zinc-500)", fontSize: "var(--text-sm)" }}>
        Options and ideas for later — pick a category to browse.
      </p>
      {tabs.length === 0 ? (
        <p style={{ margin: 0, color: "var(--color-zinc-500)", fontSize: "var(--text-sm)" }}>
          No categories yet.{" "}
          <Link href="/future-interests/manage" style={{ color: "var(--color-blue-600)" }}>
            Add one in Manage
          </Link>
          .
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {tabs.map((c) => (
            <li key={c.slug}>
              <Link href={`/future-interests/${c.slug}`} style={{ color: "var(--color-blue-600)" }}>
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
