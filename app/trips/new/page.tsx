import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import NewTripForm from "@/components/admin/NewTripForm";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function NewTripPage() {
  const user = await getAdminUser();
  if (!user) redirect("/login?next=/trips/new");

  return (
    <main className={styles.main}>
      <h1 className={styles.heading}>New trip</h1>
      <NewTripForm />
    </main>
  );
}
