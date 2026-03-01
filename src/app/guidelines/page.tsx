import type { Metadata } from "next";
import { GuidelinesPage } from "@/components/shared/GuidelinesPage";
import { mockGuidelines } from "@/data/mock";

export const metadata: Metadata = {
  title:
    "Motorcycle Group Riding Guidelines & Safety Tips | T2W Rider Handbook",
  description:
    "Essential motorcycle group riding guidelines: formation riding, hand signals, safety gear requirements, T-CLOCS bike check, cornering techniques, emergency protocols, and fuel management. The complete guide for safe riding in India.",
  keywords: [
    "motorcycle group riding guidelines",
    "motorcycle safety tips India",
    "formation riding rules",
    "motorcycle hand signals",
    "bike safety gear India",
    "T-CLOCS motorcycle check",
    "cornering techniques motorcycle",
    "motorcycle emergency protocol",
    "riding tips for beginners",
    "group riding etiquette",
  ],
  openGraph: {
    title: "Motorcycle Group Riding Guidelines | Tales on 2 Wheels",
    description:
      "Essential group riding guidelines, safety tips, and riding techniques from experienced T2W riders.",
  },
  alternates: {
    canonical: "https://taleson2wheels.com/guidelines",
  },
};

function FAQSchema() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: mockGuidelines.map((g) => ({
      "@type": "Question",
      name: g.title,
      acceptedAnswer: {
        "@type": "Answer",
        text: g.content,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
    />
  );
}

export default function Guidelines() {
  return (
    <>
      <FAQSchema />
      <GuidelinesPage />
    </>
  );
}
