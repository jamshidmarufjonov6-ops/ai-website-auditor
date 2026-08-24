import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { ThemeScript } from "@/components/ThemeScript";
import { I18nProvider } from "@/i18n";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "AI Website Auditor — Know What's Wrong With Your Website",
    template: "%s | AI Website Auditor",
  },
  description:
    "AI-powered website auditing for SEO, performance, accessibility, security, mobile readiness and technical health. Get a clear, actionable report for any public website.",
  keywords: [
    "website audit",
    "SEO audit",
    "accessibility checker",
    "website security check",
    "performance audit",
    "AI website auditor",
  ],
  openGraph: {
    title: "AI Website Auditor — Know What's Wrong With Your Website",
    description:
      "AI-powered website auditing for SEO, performance, accessibility, security and technical health.",
    url: "https://aiwebsiteauditor.example.com",
    siteName: "AI Website Auditor",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Website Auditor",
    description:
      "AI-powered website auditing for SEO, performance, accessibility, security and technical health.",
  },
  icons: {
    icon: "/favicon.svg",
  },
  alternates: {
    canonical: "https://aiwebsiteauditor.example.com/",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f17" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var l=localStorage.getItem("auditor_lang");if(l==="uz"||l==="ru"){document.documentElement.lang=l}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen">
        <I18nProvider>
          <Nav />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
