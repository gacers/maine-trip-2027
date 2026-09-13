import ResetPasswordForm from "@/components/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <main className="max-w-sm mx-auto px-4 py-16 flex flex-col gap-6 w-full">
      <h1 className="text-2xl font-bold text-zinc-900 text-center">Set your password</h1>
      <ResetPasswordForm />
    </main>
  );
}
