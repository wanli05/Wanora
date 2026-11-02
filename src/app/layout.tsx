import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wanora",
  description: "Job application tracker for job seekers in Japan",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
