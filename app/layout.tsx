import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Outfit } from "next/font/google";
import { CommandSearch } from "@/components/command-search";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import {
  jsonLdScriptProps,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo/jsonld";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  ogImageUrl,
} from "@/lib/seo/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const defaultOgImage = ogImageUrl({
  title: "An open API for medications",
  subtitle: "pharmacopeia.dev",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} · an open API for medications`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "drug api",
    "medication api",
    "pharmacopeia",
    "rxnorm",
    "drug interactions",
    "drug classes",
    "atc",
    "open medical data",
    "open drug database",
  ],
  authors: [{ name: "pharmacopeia contributors", url: SITE_URL }],
  creator: "pharmacopeia contributors",
  publisher: SITE_NAME,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} · an open API for medications`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
    images: [
      {
        url: defaultOgImage,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — an open API for medications`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} · an open API for medications`,
    description: SITE_DESCRIPTION,
    images: [defaultOgImage],
  },
  category: "technology",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "oklch(0.985 0.008 78)" },
    { media: "(prefers-color-scheme: dark)", color: "oklch(0.165 0.018 235)" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background font-sans">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <script {...jsonLdScriptProps(websiteJsonLd())} />
          <script {...jsonLdScriptProps(organizationJsonLd())} />
          <SiteHeader />
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
          <SiteFooter />
          <CommandSearch />
        </ThemeProvider>
      </body>
    </html>
  );
}
