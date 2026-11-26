/** Best-effort browser name + major version for diagnostic whitelist. */
export type BrowserInfo = {
  name: string;
  version: string;
};

/**
 * Parse a short browser label from userAgent.
 * Returns null when unreliable — callers must still allow submit without it.
 */
export function detectBrowserInfo(
  userAgent: string | undefined | null = typeof navigator !== "undefined"
    ? navigator.userAgent
    : null,
): BrowserInfo | null {
  const ua = userAgent?.trim();
  if (!ua) return null;

  // Order matters: Edge/Opera/Chrome share Chromium tokens.
  const patterns: Array<{ name: string; re: RegExp }> = [
    { name: "Edge", re: /Edg(?:e|A|iOS)?\/(\d+(?:\.\d+)*)/ },
    { name: "Opera", re: /(?:OPR|Opera)\/(\d+(?:\.\d+)*)/ },
    { name: "Chrome", re: /Chrome\/(\d+(?:\.\d+)*)/ },
    { name: "Firefox", re: /Firefox\/(\d+(?:\.\d+)*)/ },
    { name: "Safari", re: /Version\/(\d+(?:\.\d+)*).*Safari\// },
    { name: "Safari", re: /Safari\/(\d+(?:\.\d+)*)/ },
  ];

  for (const { name, re } of patterns) {
    const m = re.exec(ua);
    if (m?.[1]) {
      return { name, version: m[1] };
    }
  }
  return null;
}
