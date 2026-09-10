import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { themeInitScript } from "@/components/layout/theme-toggle";

import "./globals.css";

/**
 * Helvetica Neue se nedá legálně přibalit, takže se bere ze systému. Inter je
 * self-hostovaný fallback pro Windows a Linux — latin-ext kvůli české diakritice.
 */
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
