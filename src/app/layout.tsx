import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinFast UA — Monobank Фінанси",
  description: "Персональний додаток для управління фінансами з інтеграцією Monobank API",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <body className="bg-gray-50 antialiased" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
