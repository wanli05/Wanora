import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Pages only: API routes, Next internals and files with an extension skip it.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
