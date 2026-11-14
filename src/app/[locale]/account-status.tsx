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
      <nav className="site-account">
        <Link href="/sign-in" className="site-nav-link">
          {tAccount("signIn")}
        </Link>
        <Link href="/sign-up" className="site-nav-link">
          {tAccount("signUp")}
        </Link>
      </nav>
    );
  }

  return (
    <div className="site-account">
      <p className="site-user" data-testid="signed-in-as" title={user.email}>
        {user.email}
      </p>
      <SignOutButton />
    </div>
  );
}
