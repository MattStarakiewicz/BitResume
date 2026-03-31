import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "BitResume",
  description: "BitResume — profesjonalne CV i eksport do PDF",
  /* ./ — działa w dev (/) i w eksporcie statycznym pod file:// (Electron) */
  icons: {
    icon: "./bitresume-certificate.svg",
    shortcut: "./bitresume-certificate.svg",
    apple: "./bitresume-certificate.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <body
        suppressHydrationWarning
        className="min-h-full bg-slate-50 font-sans text-slate-900 antialiased dark:bg-zinc-950 dark:text-zinc-100"
      >
        <AppThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </AppThemeProvider>
      </body>
    </html>
  );
}
