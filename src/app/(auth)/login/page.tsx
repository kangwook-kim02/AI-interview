import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/components/AuthForm";

export const metadata: Metadata = {
  title: "로그인 · AI 면접",
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
