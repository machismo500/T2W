import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/AdminPage";

export const metadata: Metadata = {
  title: "Admin Panel",
  description: "T2W Admin Panel - Manage users, rides, content, and more.",
  robots: { index: false, follow: false },
};

export default function Admin() {
  return <AdminPage />;
}
