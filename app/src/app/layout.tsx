import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "BugHunter AI — Detect. Analyze. Secure.",
  description:
    "AI-powered cybersecurity platform that automatically scans websites for vulnerabilities, explains security risks, and provides actionable remediation steps.",
  keywords: [
    "cybersecurity",
    "vulnerability scanner",
    "security audit",
    "AI security",
    "web security",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased`}>
        <div className="bg-grid-pattern bg-gradient-radial min-h-screen">
          {children}
        </div>
        <SpeedInsights />
      </body>
    </html>
  );
}
