// @vitest-environment node

/**
 * Le cookie `axion_utm` ne se dépose qu'APRÈS consentement (décision de Will,
 * 2026-10-26).
 *
 *   1. le proxy ne le pose plus à l'arrivée, et ne le réinjecte plus ;
 *   2. `POST /api/utm-consent` le pose seulement avec des `utm_*` valides ET
 *      une origine du même site, et rejette tout le reste sans rien déposer ;
 *   3. les lecteurs du cookie (`api/funnel`, `provenanceEnBloc`) le relisent
 *      quand il porte le marqueur `v: 2` de la route, et ignorent un reliquat
 *      posé sans accord par l'ancien proxy ;
 *   4. `DELETE /api/utm-consent` l'efface (retrait du consentement).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  autorise: true,
  cookieUtm: undefined as string | undefined,
  cree: vi.fn(async (_: unknown) => ({})),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: h.autorise })),
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: vi.fn(async () => "203.0.113.7") }));
vi.mock("@/lib/prisma", () => ({ prisma: { funnelEvent: { create: h.cree } } }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nom: string) => (nom === "axion_utm" && h.cookieUtm ? { value: h.cookieUtm } : undefined),
  }),
}));

import { DELETE, POST } from "../route";
import { POST as POST_FUNNEL } from "../../funnel/route";
import { provenanceEnBloc } from "@/server/calendly/choix-rendez-vous";
import { readUtmCookie, serializeUtmCookie } from "@/lib/utm";

const HOTE = "axion-ia.com";

function requete(corps: unknown, entetes: Record<string, string> = {}): NextRequest {
  return new NextRequest(`https://${HOTE}/api/utm-consent`, {
    method: "POST",
    headers: {
      host: HOTE,
      origin: `https://${HOTE}`,
      "content-type": "application/json",
      ...entetes,
    },
    body: typeof corps === "string" ? corps : JSON.stringify(corps),
  });
}

function valeurDuCookie(res: Response): string | null {
  const brut = res.headers.get("set-cookie");
  const m = brut?.match(/^axion_utm=([^;]*)/);
  return m?.[1] ?? null;
}

beforeEach(() => {
  h.autorise = true;
  h.cookieUtm = undefined;
  h.cree.mockClear();
});

describe("proxy — plus de dépôt à l'arrivée", () => {
  const source = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
  const code = source.replace(/^\s*\/\/.*$/gm, " ");

  it("n'importe plus rien qui fabrique le cookie", () => {
    expect(code).not.toMatch(/buildUtmSetCookie|parseUtmFromUrl|from "\.\/lib\/utm"/);
  });

  it("ne réinjecte plus `axion_utm` dans les Set-Cookie d'une page", () => {
    expect(code).not.toMatch(/axion_utm/);
  });

  it("TÉMOIN — la redirection /en/* et le reste du proxy sont toujours là", () => {
    expect(code).toMatch(/isEnLocaleDisabled\(\)/);
    expect(code).toMatch(/mapEnToFr\(path\)/);
    expect(code).toMatch(/session-token/);
  });
});

describe("POST /api/utm-consent", () => {
  it("pose le cookie HttpOnly Secure SameSite Lax 30 j avec des utm_* valides et la même origine", async () => {
    const res = await POST(requete({ utm_source: "linkedin", utm_campaign: "tour-2026" }));
    expect(res.status).toBe(204);
    const entete = res.headers.get("set-cookie") ?? "";
    expect(entete).toMatch(/HttpOnly/);
    expect(entete).toMatch(/Secure/);
    expect(entete).toMatch(/SameSite=Lax/);
    expect(entete).toMatch(new RegExp(`Max-Age=${30 * 24 * 60 * 60}`));
    expect(readUtmCookie(valeurDuCookie(res) ?? "")).toEqual({
      utm_source: "linkedin",
      utm_campaign: "tour-2026",
    });
  });

  it("ne garde que les cinq clés de la liste blanche, nettoyées et bornées", async () => {
    const res = await POST(
      requete({
        utm_source: "google<script>",
        utm_medium: "x".repeat(201),
        utm_content: "bouton-hero",
        autre: "ignoree",
        utm_term: 42,
      }),
    );
    expect(res.status).toBe(204);
    expect(readUtmCookie(valeurDuCookie(res) ?? "")).toEqual({
      utm_source: "googlescript",
      utm_content: "bouton-hero",
    });
  });

  it.each([
    ["aucune clé utm", { autre: "x" }],
    ["valeurs vides", { utm_source: "" }],
    ["valeur trop longue seule", { utm_source: "x".repeat(201) }],
    ["tableau", ["utm_source"]],
    ["JSON invalide", "{pas du json"],
  ])("ne dépose RIEN sans utm_* valide (%s)", async (_, corps) => {
    const res = await POST(requete(corps));
    expect(res.status).toBe(400);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it.each([
    ["origine étrangère", { origin: "https://evil.example" }],
    ["sous-domaine", { origin: `https://x.${HOTE}` }],
    ["origine illisible", { origin: "null" }],
  ])("rejette une %s sans rien déposer", async (_, entetes) => {
    const res = await POST(requete({ utm_source: "linkedin" }, entetes));
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("rejette une requête sans en-tête Origin", async () => {
    const req = new NextRequest(`https://${HOTE}/api/utm-consent`, {
      method: "POST",
      headers: { host: HOTE, "content-type": "application/json" },
      body: JSON.stringify({ utm_source: "linkedin" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("limitation de débit → 429, sans cookie", async () => {
    h.autorise = false;
    const res = await POST(requete({ utm_source: "linkedin" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("corps annoncé démesuré → 413, sans cookie", async () => {
    const res = await POST(requete({ utm_source: "linkedin" }, { "content-length": "999999" }));
    expect(res.status).toBe(413);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("corps réel démesuré sous un content-length menteur → 413 avant JSON.parse", async () => {
    const corps = JSON.stringify({ utm_source: "linkedin", bourrage: "a".repeat(5000) });
    const res = await POST(requete(corps, { "content-length": "40" }));
    expect(res.status).toBe(413);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("n'écrit rien en base : la route n'importe pas Prisma", () => {
    const source = readFileSync(join(process.cwd(), "src/app/api/utm-consent/route.ts"), "utf8");
    const code = source.replace(/^\s*\/\/.*$/gm, " ");
    expect(code).not.toMatch(/@\/lib\/prisma|@prisma\/client/);
  });
});

describe("DELETE /api/utm-consent — retrait du consentement", () => {
  function suppression(entetes: Record<string, string> = { origin: `https://${HOTE}` }) {
    return new NextRequest(`https://${HOTE}/api/utm-consent`, {
      method: "DELETE",
      headers: { host: HOTE, ...entetes },
    });
  }

  it("efface le cookie : Max-Age=0, mêmes attributs, sans cache", async () => {
    const res = await DELETE(suppression());
    expect(res.status).toBe(204);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const entete = res.headers.get("set-cookie") ?? "";
    expect(entete).toMatch(/^axion_utm=;/);
    expect(entete).toMatch(/Max-Age=0/);
    expect(entete).toMatch(/Path=\//);
    expect(entete).toMatch(/SameSite=Lax/);
    expect(entete).toMatch(/Secure/);
    expect(entete).toMatch(/HttpOnly/);
  });

  it.each([
    ["origine étrangère", { origin: "https://evil.example" }],
    ["sans en-tête Origin", {}],
  ])("rejette une %s sans rien toucher", async (_, entetes) => {
    const res = await DELETE(suppression(entetes));
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("limitation de débit → 429", async () => {
    h.autorise = false;
    const res = await DELETE(suppression());
    expect(res.status).toBe(429);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

describe("seule une valeur posée par la route est relue", () => {
  const b64url = (json: string) =>
    Buffer.from(json, "utf-8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  it("un ancien cookie du proxy, sans marqueur, donne {}", () => {
    // Exactement ce que posait l'ancien proxy pour `?utm_source=x`.
    expect(b64url('{"utm_source":"x"}')).toBe("eyJ1dG1fc291cmNlIjoieCJ9");
    expect(readUtmCookie("eyJ1dG1fc291cmNlIjoieCJ9")).toEqual({});
    expect(readUtmCookie(b64url('{"utm_source":"x","v":1}'))).toEqual({});
  });

  it("le cookie posé par la route est relu", async () => {
    const res = await POST(requete({ utm_source: "linkedin" }));
    expect(readUtmCookie(valeurDuCookie(res) ?? "")).toEqual({ utm_source: "linkedin" });
  });
});

describe("les lecteurs relisent le cookie quand il existe", () => {
  it("api/funnel enregistre la campagne lue dans le cookie", async () => {
    h.cookieUtm = serializeUtmCookie({
      utm_source: "linkedin",
      utm_medium: "paid",
      utm_campaign: "tour",
    });
    const req = new NextRequest(`https://${HOTE}/api/funnel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        funnel: "simulateur",
        event: "Simulator Started",
        sessionId: "abcdefabcdefabcdefab",
      }),
    });
    const res = await POST_FUNNEL(req);
    expect(res.status).toBe(204);
    expect(h.cree).toHaveBeenCalledTimes(1);
    const data = (h.cree.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({ utmSource: "linkedin", utmMedium: "paid", utmCampaign: "tour" });
  });

  it("provenanceEnBloc prend le bloc du cookie quand l'URL n'a pas d'utm_*", () => {
    const cookie = readUtmCookie(
      serializeUtmCookie({ utm_source: "google", utm_campaign: "ia", utm_content: "hero" }),
    );
    expect(provenanceEnBloc({}, cookie)).toMatchObject({
      utmSource: "google",
      utmCampaign: "ia",
      utmContent: "hero",
    });
  });
});
