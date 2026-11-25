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
import { AppShell } from "@/components/app-shell/app-shell";
import { SiteHeader } from "./site-header";

export async function SignedInShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser(await headers());
  if (!user) {
    return (
      <>
        <SiteHeader />
        {children}
      </>
    );
  }

  const [profile, tAccount] = await Promise.all([
    getProfileByUserId(getDb(), user.id),
    getTranslations("Account"),
  ]);
  const name = headerDisplayName({
    fullName: (profile?.fullName ?? null) as LocalizedText | null,
    sessionName: user.name,
  });
  const label = name || tAccount("unnamed");
  const initial = headerAvatarInitial(name);
  const hasPhoto = Boolean(profile?.photoKey);

  return (
    <AppShell
      identity={{
        label,
        initial: initial || tAccount("avatarPlaceholder"),
        hasPhoto,
      }}
    >
      {children}
    </AppShell>
  );
}
