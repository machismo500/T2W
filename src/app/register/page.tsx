import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterPage } from "@/components/shared/RegisterPage";

export const metadata: Metadata = {
  title: "Join T2W - Rider Registration",
  description:
    "Register with Tales on 2 Wheels to join India's premier motorcycle riding community. Sign up, ride together, earn badges.",
  robots: { index: false, follow: false },
};

export default function Register() {
  return (
    <Suspense>
      <RegisterPage />
    </Suspense>
  );
}
