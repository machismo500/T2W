import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://talesontwowheels.com"),
  title: {
    default: "T2W - Tales on 2 Wheels | Motorcycle Riding Community",
    template: "%s | T2W - Tales on 2 Wheels",
  },
  description:
    "Join India's premier motorcycle riding community. Discover epic group rides, share your tales, earn badges, and connect with passionate riders. Tales on 2 Wheels - where every ride tells a story.",
  keywords: [
    "motorcycle rides India",
    "group riding",
    "motorcycle community",
    "bike tours India",
    "riding club",
    "Tales on 2 Wheels",
    "T2W",
    "motorcycle adventure",
    "bike riding group",
    "Royal Enfield rides",
    "motorcycle travel",
    "riding tips",
    "motorcycle blog",
    "two wheeler community",
  ],
  authors: [{ name: "Tales on 2 Wheels" }],
  creator: "T2W Team",
  publisher: "Tales on 2 Wheels",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://talesontwowheels.com",
    siteName: "Tales on 2 Wheels",
    title: "T2W - Tales on 2 Wheels | Motorcycle Riding Community",
    description:
      "Join India's premier motorcycle riding community. Discover epic group rides, share your tales, and connect with passionate riders.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Tales on 2 Wheels - Motorcycle Riding Community",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "T2W - Tales on 2 Wheels",
    description:
      "India's premier motorcycle riding community. Every ride tells a story.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "google-site-verification-code",
  },
  alternates: {
    canonical: "https://talesontwowheels.com",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Tales on 2 Wheels",
  alternateName: "T2W",
  url: "https://talesontwowheels.com",
  description:
    "India's premier motorcycle riding community. Discover epic group rides, share your tales, and connect with passionate riders.",
  foundingDate: "2023",
  sameAs: [
    "https://instagram.com/talesontwowheels",
    "https://youtube.com/@talesontwowheels",
    "https://facebook.com/talesontwowheels",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-t2w-dark font-sans antialiased">
        <Navbar />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
