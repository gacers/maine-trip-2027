import "./globals.css";

export const metadata = {
  title: "Trip Planner",
  description: "Trip planning trackers — houses, food & drink, activities, and more.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">{children}</body>
    </html>
  );
}
