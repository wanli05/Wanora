import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "新規登録 | Wanora" };

export default function SignUpPage() {
  return <AuthForm mode="sign-up" />;
}
