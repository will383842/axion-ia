// @vitest-environment node

/**
 * Le cookie `axion_utm` ne se dépose qu'APRÈS consentement (décision de Will,
 * 2026-10-26).
 *
 *   1. le proxy ne le pose plus à l'arrivée, et ne le réinjecte plus ;
 *   2. `POST /api/utm-consent` le pose seulement avec des `utm_*` valides ET
 *      une origine du même site, et rejette tout le reste sans rien déposer ;
 *   3. les lecteurs du cookie (`api/funnel`, `provenanceEnBloc`) le relisent
 *      toujours quand il existe.
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

import { POST } from "../route";
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

  it("n'écrit rien en base", async () => {
    await POST(requete({ utm_source: "linkedin" }));
    expect(h.cree).not.toHaveBeenCalled();
  });
});

describe("les lecteurs relisent toujours le cookie quand il existe", () => {
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
