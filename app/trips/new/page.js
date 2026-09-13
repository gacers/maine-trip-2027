import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import NewTripForm from "@/components/admin/NewTripForm";

export const dynamic = "force-dynamic";

export default async function NewTripPage() {
  const user = await getAdminUser();
  if (!user) redirect("/login?next=/trips/new");

  return (
    <main className="max-w-sm mx-auto px-4 py-12 flex flex-col gap-6 w-full">
      <h1 className="text-2xl font-bold text-zinc-900 text-center">New trip</h1>
      <NewTripForm />
    </main>
  );
}
