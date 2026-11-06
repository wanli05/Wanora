import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";

export async function AccountStatus() {
  const [user, tAccount] = await Promise.all([
    getSessionUser(await headers()),
    getTranslations("Account"),
  ]);

  if (!user) {
    return (
      <nav className="flex gap-4">
        <Link href="/sign-in" className="underline">
          {tAccount("signIn")}
        </Link>
        <Link href="/sign-up" className="underline">
          {tAccount("signUp")}
        </Link>
      </nav>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <p data-testid="signed-in-as">{user.email}</p>
      <SignOutButton />
    </div>
  );
}
