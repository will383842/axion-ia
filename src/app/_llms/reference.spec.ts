// @vitest-environment node
/**
 * V1-14 — garde de `llms.txt` et `llms-full.txt` : les deux répondent en `text/plain; charset=utf-8`,
 * aucun mot interdit, aucune URL `/en`, et chaque URL du bloc « référence » correspond à une route
 * existante. Le bloc est lu dans les sources (jamais recopié) et ne dépend d'aucune base.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/seo", () => ({ SITE_URL: "https://axion-ia.com" }));

import { routing } from "@/i18n/routing";

import { ROUTES_CITEES_LLMS, offresLlms, routeExiste, sectionReferenceLlms } from "./reference";

const SITE = "https://axion-ia.com";
const INTERDITS =
  /Qualiopi|OPCO|prise en charge|financement|\bCPF\b|France Travail|Grenoble|Aucun gain garanti|formation obligatoire/i;

const COURT = sectionReferenceLlms(SITE, false);
const COMPLET = sectionReferenceLlms(SITE, true);

describe("bloc référence de llms*.txt", () => {
  it("couvre qui, offres, glossaire, questions, Observatoire, contact", () => {
    for (const titre of [
      "## Qui est Axion-IA",
      "## Nos offres",
      "## Glossaire",
      "## Questions-réponses de référence",
      "## Observatoire",
      "## Contact",
    ]) {
      expect(COURT).toContain(titre);
      expect(COMPLET).toContain(titre);
    }
    expect(COMPLET.length).toBeGreaterThan(COURT.length * 3);
  });

  it("aucun mot interdit, aucun jeton résiduel, aucune URL /en", () => {
    for (const texte of [COURT, COMPLET]) {
      expect(texte).not.toMatch(INTERDITS);
      expect(texte).not.toContain("{{");
      expect(texte).not.toMatch(/axion-ia\.com\/en(\/|\b)/);
    }
  });

  it("seul prix publié : celui de la Journée IA (aucun autre montant)", () => {
    const montants = COMPLET.match(/\d[\d\s  .]*\s?€/g) ?? [];
    expect(new Set(montants.map((m) => m.replace(/\D/g, "")))).toEqual(new Set(["1490"]));
  });

  it("toutes les URL sont absolues, en /fr, et correspondent à une route existante", () => {
    for (const cle of ROUTES_CITEES_LLMS.filter((c) => c !== "/cartographie")) {
      expect(routeExiste(cle), cle).toBe(true);
    }
    const urls = [...COMPLET.matchAll(/\]\((https:\/\/axion-ia\.com[^)\s]*)\)/g)].map(
      (m) => m[1] as string,
    );
    expect(urls.length).toBeGreaterThan(100);
    const pathnames = routing.pathnames as Record<string, unknown>;
    for (const u of urls) {
      const chemin = u.slice(SITE.length);
      expect(chemin.startsWith("/fr"), u).toBe(true);
      const sansLocale = chemin.slice(3);
      const hub = "/" + sansLocale.split("/")[1];
      expect(sansLocale in pathnames || hub in pathnames, u).toBe(true);
    }
  });

  it("n'annonce une offre que si sa route existe (Cartographie apparaît d'elle-même)", () => {
    const noms = offresLlms(SITE).map((o) => o.url);
    expect(noms).toContain(`${SITE}/fr/journee-ia`);
    expect(noms.includes(`${SITE}/fr/cartographie`)).toBe(routeExiste("/cartographie"));
  });
});

describe("routes llms.txt et llms-full.txt", () => {
  it.each(["llms.txt", "llms-full.txt"])(
    "%s répond en text/plain, sans mot interdit ni URL /en",
    async (nom) => {
      vi.resetModules();
      vi.doMock("@/server/videos/lecture", () => ({ videosPubliees: async () => [] }));
      vi.doMock("@/server/reviews/presence", () => ({ avisPublies: async () => false }));
      const { GET } =
        nom === "llms.txt"
          ? await import("../llms.txt/route")
          : await import("../llms-full.txt/route");
      const res: Response = await GET();
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
      expect(res.headers.get("Cache-Control")).toMatch(/max-age=\d+/);
      const corps = await res.text();
      expect(corps.length).toBeGreaterThan(2000);
      expect(corps).toContain("## Nos offres (pages de référence)");
      expect(corps).toContain("https://axion-ia.com/fr/un-a-un");
      expect(corps).not.toMatch(INTERDITS);
      expect(corps).not.toMatch(/https:\/\/axion-ia\.com\/en(\/|\b)/);
    },
  );
});
