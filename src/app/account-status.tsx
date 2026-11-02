import Link from "next/link";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";

export async function AccountStatus() {
  const user = await getSessionUser(await headers());

  if (!user) {
    return (
      <nav className="flex gap-4">
        <Link href="/sign-in" className="underline">
          ログイン
        </Link>
        <Link href="/sign-up" className="underline">
          新規登録
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
