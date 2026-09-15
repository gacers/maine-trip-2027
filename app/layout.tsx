import type { Metadata } from "next";
import type { ReactNode } from "react";
import QueryProvider from "@/components/QueryProvider";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "Trip Planner",
  description: "Trip planning trackers — houses, food & drink, activities, and more.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={styles.html}>
      <body className={styles.body}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
