"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const links = [
  { href: "/profile", key: "basic" as const, match: (path: string) => path === "/profile" },
  {
    href: "/profile/education",
    key: "education" as const,
    match: (path: string) => path.startsWith("/profile/education"),
  },
  {
    href: "/profile/work-history",
    key: "workHistory" as const,
    match: (path: string) => path.startsWith("/profile/work-history"),
  },
  {
    href: "/profile/licenses",
    key: "licenses" as const,
    match: (path: string) => path.startsWith("/profile/licenses"),
  },
];

export function ProfileNav() {
  const t = useTranslations("Profile.nav");
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
      {links.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-md px-3 py-1.5 text-sm ${
              active
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {t(link.key)}
          </Link>
        );
      })}
    </nav>
  );
}
