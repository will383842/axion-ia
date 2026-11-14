// @vitest-environment node
//
// PR-S2b — /api/guide-ia/telecharger pour un guide du catalogue (scénarios 17 à 20).
// Le guide-ia garde son comportement (références : `guide-ia-octet-pour-octet.spec.ts`).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import path from "node:path";

type Ligne = Record<string, unknown>;
const bd = vi.hoisted(() => ({
  demande: null as Ligne | null,
  cible: null as Ligne | null,
  ecritures: [] as unknown[],
  stats: [] as string[],
  fichier: { isFile: () => true, size: 1234 } as { isFile: () => boolean; size: number } | null,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    guideRequest: {
      findUnique: async () => bd.demande,
      updateMany: async (a: unknown) => {
        bd.ecritures.push(a);
        return { count: 1 };
      },
    },
    cibleReseau: { findUnique: async () => bd.cible },
  },
}));
vi.mock("node:fs/promises", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  stat: async (p: string) => {
    bd.stats.push(p);
    if (bd.fichier === null) throw Object.assign(new Error("absent"), { code: "ENOENT" });
    return bd.fichier;
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/analytics/plausible-serveur", () => ({
  emettreEvenementPlausible: async () => true,
}));
vi.mock("@/server/guides-reseau/preuve-page-guide", () => ({
  confirmerPreuvesAuClic: async () => undefined,
}));
vi.mock("@/server/crm-sync/lettre-guide", () => ({ transmettreClicGuide: async () => undefined }));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string | null | undefined) => (e ? `h:${e.trim().toLowerCase()}` : null),
}));

import { GET, POST } from "../route";
import { SITE_URL } from "@/lib/site-url";
import { urlGuideIa } from "@/content/guide-ia";

const BASE = "https://axion-ia.com";
const JETON = "a1".repeat(32);
const CIBLE = {
  code: "gde-essai-01",
  type: "guide",
  titre: "Le plan en 90 jours",
  cheminPdf: "guides-reseau/plan-90-jours.pdf",
  actif: true,
  test: false,
};
const post = () =>
  POST(
    new NextRequest(`${BASE}/api/guide-ia/telecharger`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `t=${JETON}`,
    }),
  );
const get = () => GET(new NextRequest(`${BASE}/api/guide-ia/telecharger?t=${JETON}`));
const racine = path.resolve(process.cwd(), "public", "guides-reseau") + path.sep;

beforeEach(() => {
  bd.demande = {
    id: "demande-1",
    locale: "fr",
    source: "mot-guide:instagram",
    email: "personne@example.test",
    aimant: "gde-essai-01",
  };
  bd.cible = { ...CIBLE };
  bd.ecritures.length = 0;
  bd.stats.length = 0;
  bd.fichier = { isFile: () => true, size: 1234 };
  // L'interrupteur de LIVRAISON ne conditionne pas le téléchargement : éteint partout dans ce fichier.
  vi.stubEnv("GUIDES_RESEAU_LIVRAISON_ENABLED", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("POST — guide du catalogue", () => {
  it("17. 303 vers le fichier public du catalogue, après les écritures habituelles ; guide-ia reste sur urlGuideIa()", async () => {
    const res = await post();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${SITE_URL}/guides-reseau/plan-90-jours.pdf`);
    expect(bd.ecritures.length).toBeGreaterThan(0);
    expect(bd.stats).toHaveLength(1);
    expect(bd.stats[0]!.startsWith(racine)).toBe(true);
    // L'aimant décide : le même jeton, sur une demande guide-ia, va au PDF historique.
    bd.demande = { ...bd.demande, aimant: "guide-ia" };
    bd.stats.length = 0;
    const ia = await post();
    expect(ia.headers.get("location")).toBe(urlGuideIa());
    expect(bd.stats).toHaveLength(0);
  });

  it("18. fichier absent, vide ou répertoire : page neutre « indisponible » (200), jamais 500, écritures déjà faites", async () => {
    for (const f of [null, { isFile: () => true, size: 0 }, { isFile: () => false, size: 4096 }]) {
      bd.fichier = f;
      bd.ecritures.length = 0;
      const res = await post();
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
      const html = await res.text();
      expect(html).toContain("Ce guide n&#39;est plus proposé pour le moment.");
      expect(html).not.toMatch(/<script/i);
      expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
      expect(bd.ecritures.length).toBeGreaterThan(0);
    }
  });

  it("19. chemin piégé en base, cible inactive ou inconnue : indisponible, le disque n'est même pas touché", async () => {
    for (const cible of [
      { ...CIBLE, cheminPdf: "imprimes/dossier-intervenant-williams-jullin-axion-ia.pdf" },
      { ...CIBLE, cheminPdf: "guides-reseau/../imprimes/a.pdf" },
      { ...CIBLE, actif: false },
      null,
    ]) {
      bd.cible = cible;
      const res = await post();
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("Ce guide n&#39;est plus proposé pour le moment.");
    }
    expect(bd.stats).toHaveLength(0);
  });
});

describe("GET — guide du catalogue", () => {
  it("20. la page porte le titre du guide, un bouton qui POSTE, jamais « 40 pages » ; indisponible : page neutre sans bouton", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Le plan en 90 jours");
    expect(html).toContain('method="post"');
    expect(html).toContain(`value="${JETON}"`);
    expect(html).not.toContain("40 pages");
    expect(html).not.toContain("page 5");
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain("guides-reseau/plan-90-jours.pdf");

    bd.cible = { ...CIBLE, actif: false };
    const ind = await (await get()).text();
    expect(ind).toContain("Ce guide n&#39;est plus proposé pour le moment.");
    expect(ind).not.toContain('method="post"');
  });
});
