"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteNavLinks({
  progressLabel,
  myCareerLabel,
  ariaLabel,
}: {
  progressLabel: string;
  myCareerLabel: string;
  ariaLabel: string;
}) {
  const pathname = usePathname() || "/";
  const onProgress = pathname === "/";
  const onCareer =
    pathname === "/profile" || pathname.startsWith("/profile/");

  return (
    <nav className="site-nav" aria-label={ariaLabel}>
      <Link
        href="/"
        className="site-nav-link"
        data-active={onProgress ? "true" : "false"}
        aria-current={onProgress ? "page" : undefined}
      >
        {progressLabel}
      </Link>
      <Link
        href="/profile"
        className="site-nav-link"
        data-active={onCareer ? "true" : "false"}
        aria-current={onCareer ? "page" : undefined}
      >
        {myCareerLabel}
      </Link>
    </nav>
  );
}
