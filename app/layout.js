import "./globals.css";

export const metadata = {
  title: "Maine Coast Trip 2027",
  description: "House options for the July 2027 Maine coast group trip.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">{children}</body>
    </html>
  );
}
