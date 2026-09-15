import ResetPasswordForm from "@/components/ResetPasswordForm";
import styles from "./page.module.css";

export default function ResetPasswordPage() {
  return (
    <main className={styles["root"]}>
      <h1 className={styles["heading"]}>Set your password</h1>
      <ResetPasswordForm />
    </main>
  );
}
