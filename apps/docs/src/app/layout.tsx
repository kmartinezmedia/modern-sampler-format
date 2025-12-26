import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "MSF Documentation",
  description: "Modern Sampler Format Documentation",
};

const navItems = [
  { href: "/", label: "Introduction" },
  { href: "/architecture", label: "Architecture" },
  { href: "/format-specification", label: "Format Specification" },
  { href: "/instrument-intent-spec", label: "Instrument Intent Spec" },
  { href: "/compiler-guide", label: "Compiler Guide" },
  { href: "/runtime-guide", label: "Runtime Guide" },
  { href: "/api-reference", label: "API Reference" },
  { href: "/examples", label: "Examples" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="layout">
          <aside className="sidebar">
            <h1 className="logo">
              <Link href="/">MSF</Link>
            </h1>
            <nav className="nav">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="nav-link">
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
