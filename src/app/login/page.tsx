import type { Metadata } from "next";
import { LoginPage } from "@/components/shared/LoginPage";

export const metadata: Metadata = {
  title: "Login - Rider Access",
  description:
    "Log in to your Tales on 2 Wheels account. Access your rider dashboard, registered rides, and community features.",
};

export default function Login() {
  return <LoginPage />;
}
