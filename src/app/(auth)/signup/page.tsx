import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/components/AuthForm";

export const metadata: Metadata = {
  title: "회원가입 · AI 면접",
};

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
