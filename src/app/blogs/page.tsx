import type { Metadata } from "next";
import { BlogsPage } from "@/components/blogs/BlogsPage";

export const metadata: Metadata = {
  title:
    "Motorcycle Blog & Vlogs | Riding Tips, Gear Reviews & Travel Stories",
  description:
    "Read T2W blogs on motorcycle riding tips, gear guides for Indian roads, personal ride stories from Bangalore to Ladakh, route guides, bike comparisons (Royal Enfield vs KTM), and watch riding vlogs from experienced Indian riders.",
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
  ],
  openGraph: {
    title: "Motorcycle Blog & Vlogs | Tales on 2 Wheels",
    description:
      "Riding tips, gear reviews, travel stories, and vlogs from India's premier motorcycle community.",
  },
  alternates: {
    canonical: "https://taleson2wheels.com/blogs",
  },
};

export default function Blogs() {
  return <BlogsPage />;
}
