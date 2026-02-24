import type { Metadata } from "next";
import { BlogsPage } from "@/components/blogs/BlogsPage";

export const metadata: Metadata = {
  title: "Blogs & Vlogs",
  description:
    "Read official T2W blogs, personal rider stories, gear reviews, riding tips, and watch vlogs from motorcycle adventures across India.",
  openGraph: {
    title: "Blogs & Vlogs | Tales on 2 Wheels",
    description:
      "Stories, tips, and tales from the T2W motorcycle riding community.",
  },
};

export default function Blogs() {
  return <BlogsPage />;
}
