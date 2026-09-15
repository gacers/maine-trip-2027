import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import styles from "./page.module.css";

// Plain email/password sign-in. There's no public sign-up (see
// supabase/migrations/0001_init.sql's app_admins table + the project's
// disabled-signup setting) — an account only exists because it was
// created directly (see scripts/migrate-maine-2027.mjs's invite step).
//
// LoginForm is split out because it uses useSearchParams() (for the
// post-login ?next= redirect), which Next.js requires to be wrapped in
// a Suspense boundary or the build fails on prerendering this page.
export default function LoginPage() {
  return (
    <main className={styles["root"]}>
      <h1 className={styles["heading"]}>Sign in</h1>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
