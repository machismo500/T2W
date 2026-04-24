import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, Courgette } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/components/shared/Toast";
import { BackToTop } from "@/components/shared/BackToTop";
import { ScrollProgress } from "@/components/shared/ScrollProgress";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { MotionConfigWrapper } from "@/components/shared/MotionConfigWrapper";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const courgette = Courgette({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-courgette",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://taleson2wheels.com"),
  title: {
    default:
      "T2W - Tales on 2 Wheels | Bangalore Motorcycle Club & Bike Group",
    template: "%s | T2W - Tales on 2 Wheels",
  },
  description:
    "Tales on 2 Wheels (T2W) is Bangalore’s most active motorcycle club & bike group. 500+ riders, 120+ group rides across India. Join the best motorcycle club in Bengaluru, Karnataka. Register free and ride with us!",
  keywords: [
    // Primary local target keywords
    "motorcycle club in Bangalore",
    "motorcycle club in Bengaluru",
    "motorcycle club Bangalore",
    "motorcycle club Bengaluru",
    "motorcycle groups in Bangalore",
    "motorcycle groups in Bengaluru",
    "bike groups in Bangalore",
    "bike groups in Bengaluru",
    "bike club Bangalore",
    "bike club Bengaluru",
    "Bangalore motorcycle club",
    "Bengaluru motorcycle club",
    "biker club Bangalore",
    "biker club Bengaluru",
    // Secondary & long-tail
    "motorcycle rides Bangalore",
    "group riding Bangalore",
    "motorcycle rides India",
    "bike tours India",
    "motorcycle community Bangalore",
    "Bangalore biking group",
    "Nandi Hills bike ride",
    "Coorg motorcycle ride",
    "Chikmagalur bike tour",
    "weekend bike rides Bangalore",
    "motorcycle touring India",
    "Royal Enfield group rides",
    "KTM adventure rides India",
    "motorcycle club Karnataka",
    "Tales on 2 Wheels",
    "T2W rides",
    "BMW GS travel India",
    "riding community India",
    "bike trips from Bangalore",
    "motorcycle rides near me",
    "group motorcycle tours",
    "Hampi bike ride",
    "Western Ghats motorcycle ride",
    "South India bike tours",
    "Bengaluru Motorcycle Club",
    "Bangalore Motorcycle Club",
    "Ladakh bike trip",
    "Spiti Valley motorcycle ride",
    "best motorcycle rides India",
    "biker community India",
    "moto vlog India",
    "motorcycle adventure India",
    "ride with us India",
    "two wheeler tours Bangalore",
    "moto touring Karnataka",
    "motorcycle expedition India",
    "biker club registration India",
    "bike ride registration online",
    "join motorcycle club Bangalore",
    "how to join motorcycle group Bangalore",
  ],
  authors: [{ name: "Tales on 2 Wheels" }],
  creator: "T2W Team",
  publisher: "Tales on 2 Wheels",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://taleson2wheels.com",
    siteName: "Tales on 2 Wheels",
    title:
      "T2W - Tales on 2 Wheels | Bangalore Motorcycle Club & Bike Group",
    description:
      "Bangalore's premier motorcycle club. 500+ riders, group rides to Ladakh, Goa, Thailand & across India. Join the best bike group in Bengaluru — register free!",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Tales on 2 Wheels - Motorcycle Riding Community India",
      },
      {
        url: "/og-image-square.jpg",
        width: 1080,
        height: 1080,
        alt: "Tales on 2 Wheels - Motorcycle Riding Community India",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "T2W - Tales on 2 Wheels | Motorcycle Rides India",
    description:
      "India's premier motorcycle riding community. Group rides from Bangalore & across India. Every ride tells a story.",
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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  alternates: {
    canonical: "https://taleson2wheels.com",
  },
  category: "Sports & Recreation",
  // Add Google Search Console site verification here once verified:
  // verification: { google: "YOUR_VERIFICATION_CODE" },
  other: {
    "msapplication-TileColor": "#0f0f0f",
    "theme-color": "#e94560",
    "pinterest-rich-pin": "true",
  },
};

// Separated per Next.js 14+ recommendation (avoids "viewport in metadata" warning)
export const viewport: Viewport = {
  themeColor: "#e94560",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": ["Organization", "SportsOrganization"],
  "@id": "https://taleson2wheels.com/#organization",
  name: "Tales on 2 Wheels",
  alternateName: ["T2W", "Tales on Two Wheels", "T2W Rides", "T2W Motorcycle Club"],
  url: "https://taleson2wheels.com",
  sport: "Motorcycling",
  logo: {
    "@type": "ImageObject",
    url: "https://taleson2wheels.com/logo.png",
    width: 512,
    height: 512,
  },
  image: "https://taleson2wheels.com/og-image.jpg",
  description:
    "Tales on 2 Wheels (T2W) is Bangalore's most active motorcycle club and bike group. Founded in 2023, we organise group rides across India — from weekend rides in Karnataka to expeditions to Ladakh, Nepal, Thailand and beyond. Join 500+ riders in the best motorcycle club in Bengaluru.",
  foundingDate: "2023",
  foundingLocation: {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Bangalore",
      addressRegion: "Karnataka",
      addressCountry: "IN",
    },
  },
  areaServed: [
    { "@type": "Country", name: "India" },
    { "@type": "State", name: "Karnataka" },
    { "@type": "City", name: "Bangalore" },
    { "@type": "City", name: "Mysore" },
    { "@type": "City", name: "Mangalore" },
  ],
  contactPoint: {
    "@type": "ContactPoint",
    email: "taleson2wheels.official@gmail.com",
    contactType: "customer service",
    availableLanguage: ["English", "Hindi", "Kannada"],
  },
  sameAs: [
    "https://instagram.com/taleson2wheels",
    "https://youtube.com/@taleson2wheels",
    "https://facebook.com/taleson2wheels",
  ],
  knowsAbout: [
    "Motorcycle touring",
    "Group motorcycle rides",
    "Motorcycle club Bangalore",
    "Bike group Bengaluru",
    "Motorcycle safety",
    "Adventure motorcycling",
    "Motorcycle travel India",
    "Bike tours Karnataka",
    "Long distance motorcycle rides",
    "Ladakh bike trip",
    "Royal Enfield touring",
    "KTM adventure riding",
  ],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Motorcycle Rides & Tours",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Group Motorcycle Rides",
          description: "Organised group motorcycle rides across India from Bangalore",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Motorcycle Club Membership",
          description: "Join Bangalore's premier motorcycle club — Tales on 2 Wheels",
        },
      },
    ],
  },
  speakable: {
    "@type": "SpeakableSpecification",
    cssSelector: ["h1", "h2", ".hero-description"],
  },
  numberOfEmployees: {
    "@type": "QuantitativeValue",
    value: 5,
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://taleson2wheels.com/#website",
  url: "https://taleson2wheels.com",
  name: "Tales on 2 Wheels",
  alternateName: "T2W",
  description:
    "Motorcycle riding community platform for group rides across India",
  publisher: { "@id": "https://taleson2wheels.com/#organization" },
  inLanguage: "en-IN",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://taleson2wheels.com/rides?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": ["SportsActivityLocation", "SportsClub"],
  "@id": "https://taleson2wheels.com/#localbusiness",
  name: "Tales on 2 Wheels",
  alternateName: "T2W Motorcycle Club Bangalore",
  description:
    "Bangalore's best motorcycle club and bike group. Tales on 2 Wheels (T2W) organises weekly rides, weekend getaways, and multi-day expeditions across India. Join our bike group in Bengaluru and ride with 500+ passionate motorcyclists.",
  url: "https://taleson2wheels.com",
  email: "taleson2wheels.official@gmail.com",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Bangalore",
    addressRegion: "Karnataka",
    addressCountry: "IN",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 12.9716,
    longitude: 77.5946,
  },
  openingHours: "Sa 06:00-18:00",
  priceRange: "₹300 - ₹25,000",
  sport: "Motorcycling",
  keywords:
    "motorcycle club Bangalore, bike club Bengaluru, motorcycle group Bangalore, bike group Bengaluru, motorcycle riding club Karnataka",
  sameAs: [
    "https://instagram.com/taleson2wheels",
    "https://facebook.com/taleson2wheels",
  ],
};

const localFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is the best motorcycle club in Bangalore?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Tales on 2 Wheels (T2W) is widely regarded as Bangalore's best motorcycle club. Founded in 2023, T2W has over 500 active riders and organises regular group rides across India — from day rides to Nandi Hills and Coorg, to epic expeditions to Ladakh, Nepal, and Thailand. You can register and join at taleson2wheels.com.",
      },
    },
    {
      "@type": "Question",
      name: "Are there motorcycle clubs in Bengaluru?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes! Tales on 2 Wheels (T2W) is one of the most active motorcycle clubs in Bengaluru, Karnataka. T2W organises group bike rides every weekend — short day rides as well as multi-day tours and international expeditions. Visit taleson2wheels.com to see upcoming rides and register.",
      },
    },
    {
      "@type": "Question",
      name: "How do I join a motorcycle group in Bangalore?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "To join a motorcycle group in Bangalore, visit taleson2wheels.com, create a free account, and register for any upcoming ride. Tales on 2 Wheels (T2W) is open to all motorcycle enthusiasts — beginners and experienced riders alike. No annual membership fee; you simply pay a per-ride fee that covers logistics and accommodation for overnight rides.",
      },
    },
    {
      "@type": "Question",
      name: "What bike groups are active in Bangalore?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Tales on 2 Wheels (T2W) is one of the most active bike groups in Bangalore. The group rides every weekend and organises special rides to destinations like Nandi Hills, Coorg, Hampi, Ladakh, Goa, and international routes in Nepal and Thailand. Join at taleson2wheels.com.",
      },
    },
    {
      "@type": "Question",
      name: "Which motorcycle club in Bengaluru is best for beginners?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Tales on 2 Wheels (T2W) is beginner-friendly. The club has experienced lead riders and sweep riders on every group ride, detailed safety guidelines, and a welcoming community. New riders in Bengaluru can start with day rides to nearby destinations and gradually progress to longer tours.",
      },
    },
    {
      "@type": "Question",
      name: "How to find bike clubs near me in Bangalore?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Tales on 2 Wheels is one of the top bike clubs based in Bangalore, Karnataka. You can register for free at taleson2wheels.com and join upcoming group rides. The club is active on Instagram (@TalesOn2Wheels) and Facebook where they announce ride dates and routes.",
      },
    },
  ],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://taleson2wheels.com",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Rides",
      item: "https://taleson2wheels.com/rides",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "Blogs",
      item: "https://taleson2wheels.com/blogs",
    },
    {
      "@type": "ListItem",
      position: 4,
      name: "Guidelines",
      item: "https://taleson2wheels.com/guidelines",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${courgette.variable}`}>
      <head>
        <meta name="theme-color" content="#e94560" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(localBusinessSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(breadcrumbSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(localFaqSchema),
          }}
        />
      </head>
      <body className={`min-h-screen bg-t2w-dark font-sans antialiased ${inter.className}`}>
        {/* Skip-to-content link for keyboard/screen-reader users */}
        <a
          href="#main-content"
          className="sr-only z-[100] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-xl focus:bg-t2w-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
        >
          Skip to main content
        </a>

        <MotionConfigWrapper>
          <AuthProvider>
            <ToastProvider>
              <ServiceWorkerRegistrar />
              <ScrollProgress />
              <Navbar />
              <main id="main-content" className="min-h-screen">
                {children}
              </main>
              <Footer />
              <BackToTop />
            </ToastProvider>
          </AuthProvider>
        </MotionConfigWrapper>

        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-H5032Z7TL4"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-H5032Z7TL4');
          `}
        </Script>

        {/* Vercel Speed Insights */}
        <SpeedInsights />
      </body>
    </html>
  );
}
