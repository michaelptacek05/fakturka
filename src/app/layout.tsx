import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { themeInitScript } from "@/components/layout/theme-toggle";

import "./globals.css";

/** Lokálně poskytovaný Inter včetně české diakritiky, bez požadavků na Google při návštěvě. */
const inter = Inter({
  display: "swap",
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Fakturka",
  description: "Self-hosted fakturace pro české OSVČ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="cs"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
