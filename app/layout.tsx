import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "הוצאות הבית",
  description: "ניהול פשוט וברור של הוצאות משק הבית",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
