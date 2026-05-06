import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 renamed `middleware` → `proxy`. The function we export is named
// `proxy` per Next 16 conventions, but next-intl still ships its helper as
// `createMiddleware` (i18n-routing semantics, name unchanged).
export default createMiddleware(routing);

export const config = {
  // Skip API, _next assets, and any path with a file extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
