// @vitest-environment node

/**
 * Le proxy, EXÉCUTÉ, ne pose pas `axion_utm` sur une arrivée `?utm_source=…`.
 *
 * Le test voisin lit la source de `src/proxy.ts` ; celui-ci appelle `proxy()`.
 * Seuls next-auth et le routage next-intl sont remplacés (le second ne se
 * résout pas sous Vitest) : tout le reste du proxy tourne pour de vrai.
 * Témoin : avec le `src/proxy.ts` d'avant la PR 1705, ce test rend
 * `axion_utm=eyJ1dG1fc291cmNlIjoieCJ9; Max-Age=2592000; …` et rougit.
 */
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({
  default: () => ({
    auth: (handler: (r: unknown) => unknown) => async (r: NextRequest) =>
      handler(Object.assign(r, { auth: null })),
  }),
}));
vi.mock("next-intl/middleware", async () => {
  const { NextResponse } = await import("next/server");
  return {
    default: () => () => {
      const res = NextResponse.next();
      res.headers.append("set-cookie", "NEXT_LOCALE=fr; Path=/");
      return res;
    },
  };
});

describe("proxy() exécuté sur une arrivée de campagne", () => {
  it.each(["/fr/blog?utm_source=x", "/fr/appel?utm_source=linkedin&utm_campaign=tour"])(
    "%s → aucun Set-Cookie axion_utm",
    async (chemin) => {
      const { default: proxy } = await import("@/proxy");
      const res = await proxy(new NextRequest(`https://axion-ia.com${chemin}`), {} as never);
      expect(res).toBeTruthy();
      const poses = res?.headers.getSetCookie() ?? [];
      expect(poses.some((c) => /^axion_utm=/.test(c))).toBe(false);
    },
  );
});
