import type { Metadata } from "next";
import Script from "next/script";
import { BlogsPage } from "@/components/blogs/BlogsPage";

export const metadata: Metadata = {
  title: "Motorcycle Blog & Vlogs | Riding Tips, Gear Reviews & Travel Stories",
  description:
    "Read T2W blogs on motorcycle riding tips, gear guides for Indian roads, ride stories from Bangalore to Ladakh, route guides, bike comparisons (Royal Enfield vs KTM), and watch vlogs from experienced Indian riders.",
  keywords: [
    "motorcycle blog India",
    "riding tips India",
    "motorcycle gear guide India",
    "bike comparison India",
    "Royal Enfield Himalayan review",
    "motorcycle travel blog",
    "Bangalore motorcycle routes",
    "riding techniques",
    "motorcycle vlog India",
    "best bike routes Karnataka",
    "Nandi Hills ride guide",
    "Coorg motorcycle route",
    "Western Ghats bike ride",
    "group riding safety tips",
    "motorcycle packing guide India",
    "best helmet India 2024",
    "Ladakh bike trip preparation",
    "Spiti Valley route guide",
    "motorcycle maintenance tips",
    "T2W ride stories",
  ],
  openGraph: {
    title: "Motorcycle Blog & Vlogs | Tales on 2 Wheels",
    description:
      "Riding tips, gear reviews, travel stories, and vlogs from India's premier motorcycle community in Bangalore.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Tales on 2 Wheels — Motorcycle Blog India",
      },
    ],
  },
  alternates: {
    canonical: "https://taleson2wheels.com/blogs",
  },
};

const blogsPageSchema = {
  "@context": "https://schema.org",
  "@type": ["CollectionPage", "Blog"],
  "@id": "https://taleson2wheels.com/blogs#webpage",
  name: "Motorcycle Blog & Vlogs — Tales on 2 Wheels",
  description:
    "Motorcycle riding tips, gear reviews, travel stories, route guides, and vlogs by riders from India's premier motorcycle club in Bangalore.",
  url: "https://taleson2wheels.com/blogs",
  isPartOf: { "@id": "https://taleson2wheels.com/#website" },
  publisher: { "@id": "https://taleson2wheels.com/#organization" },
  inLanguage: "en-IN",
  about: [
    { "@type": "Thing", name: "Motorcycle Riding" },
    { "@type": "Thing", name: "Motorcycle Travel India" },
    { "@type": "Thing", name: "Bangalore Motorcycle Club" },
  ],
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://taleson2wheels.com" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://taleson2wheels.com/blogs" },
    ],
  },
};

export default function Blogs() {
  return (
    <>
      <Script
        id="blogs-page-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogsPageSchema) }}
      />
      <BlogsPage />
    </>
  );
}
