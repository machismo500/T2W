import type { Metadata } from "next";
import { MigrateImagesPage } from "@/components/admin/MigrateImagesPage";

export const metadata: Metadata = {
  title: "Migrate Images to Blob",
  description: "Superadmin-only one-shot migration: base64 images in Postgres → Vercel Blob.",
  robots: { index: false, follow: false },
};

export default function MigrateImages() {
  return <MigrateImagesPage />;
}
