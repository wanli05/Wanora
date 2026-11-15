import type { AiPageContext } from "@/lib/ai/context/types";

/** Derive a weak PageContext hint from the current pathname (locale-agnostic). */
export function pageContextFromPath(pathname: string): AiPageContext {
  const path = pathname || "/";
  const stripped = path.replace(/^\/(ja|zh-CN|en)(?=\/|$)/, "") || "/";

  if (stripped === "/" || stripped === "") {
    return { path, area: "board" };
  }
  if (stripped.startsWith("/profile")) {
    return { path, area: "my_career" };
  }
  if (stripped.startsWith("/my-career") || stripped.startsWith("/career")) {
    return { path, area: "my_career" };
  }
  if (stripped.startsWith("/board") || stripped.startsWith("/progress")) {
    return { path, area: "board" };
  }
  return { path, area: "other" };
}
