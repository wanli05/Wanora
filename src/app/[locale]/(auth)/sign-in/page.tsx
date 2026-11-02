import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "../auth-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.signIn");
  return { title: t("title") };
}

export default function SignInPage() {
  return <AuthForm mode="sign-in" />;
}
