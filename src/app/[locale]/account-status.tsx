import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { getProfileByUserId } from "@/lib/data/profiles";
import type { LocalizedText } from "@/lib/domain/localized-text";
import {
  headerAvatarInitial,
  headerDisplayName,
} from "@/lib/domain/header-identity";
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

  const profile = await getProfileByUserId(getDb(), user.id);
  const name = headerDisplayName({
    fullName: (profile?.fullName ?? null) as LocalizedText | null,
    sessionName: user.name,
  });
  const label = name || tAccount("unnamed");
  const initial = headerAvatarInitial(name);
  const hasPhoto = Boolean(profile?.photoKey);

  return (
    <div className="site-account">
      <div className="site-identity" data-testid="signed-in-as">
        <span className="site-avatar" {...(!hasPhoto ? { "aria-hidden": true } : {})}>
          {hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated photo API
            <img
              src="/api/profile/photo"
              alt={tAccount("photoAlt")}
              className="site-avatar-img"
            />
          ) : (
            <span className="site-avatar-fallback">
              {initial || tAccount("avatarPlaceholder")}
            </span>
          )}
        </span>
        <span className="site-user-name">{label}</span>
      </div>
      <SignOutButton />
    </div>
  );
}
