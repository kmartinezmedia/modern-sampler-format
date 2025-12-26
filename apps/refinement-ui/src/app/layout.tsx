import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MSF Refinement UI",
  description: "Structured refinement interface for MSF instruments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

