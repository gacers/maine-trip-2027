import "./globals.css";
import NavHeader from "@/components/NavHeader";

export const metadata = {
  title: "Maine Coast Trip 2027",
  description: "House options, past stays, food & drink, and activities for the July 2027 Maine coast group trip.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <NavHeader />
        {children}
      </body>
    </html>
  );
}
