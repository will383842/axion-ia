// @vitest-environment node
/**
 * V1-14 — garde de `llms.txt` et `llms-full.txt` : les deux répondent en `text/plain; charset=utf-8`,
 * aucun mot interdit, aucune URL `/en`, et chaque URL du bloc « référence » (offres, questions de
 * dirigeants, glossaire) correspond à une route existante. Le bloc est lu dans les sources (jamais
 * recopié) et ne dépend d'aucune base. L'ordre des sections et le format sont gardés par
 * `llms-cible.spec.ts`.
 */
import { seuilGarantieEur } from "@/content/journee-ia-commun";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/seo", () => ({ SITE_URL: "https://axion-ia.com" }));

import { routing } from "@/i18n/routing";

import {
  ROUTES_CITEES_LLMS,
  offresLlms,
  questionsCourtesLlms,
  routeExiste,
  sectionGlossaireLlms,
  sectionPrestationsCompleteLlms,
  sectionPrestationsLlms,
  sectionQuestionsCompletesLlms,
  sectionQuestionsCourtesLlms,
} from "./reference";

const SITE = "https://axion-ia.com";
const INTERDITS =
  /Qualiopi|OPCO|prise en charge|financement|\bCPF\b|France Travail|Grenoble|Aucun gain garanti|formation obligatoire/i;

const COURT = [sectionPrestationsLlms(SITE), sectionQuestionsCourtesLlms(SITE)].join("\n\n");
const COMPLET = [
  sectionPrestationsCompleteLlms(SITE),
  sectionQuestionsCompletesLlms(SITE),
  sectionGlossaireLlms(SITE),
].join("\n\n");

describe("bloc référence de llms*.txt", () => {
  it("couvre les offres sur devis, les questions de dirigeants et le glossaire", () => {
    expect(COURT).toContain("## Formation, mise en place, intégration (sur devis)");
    expect(COURT).toContain("## Questions de dirigeants : réponses courtes");
    for (const titre of [
      "## Formation, mise en place, intégration (sur devis)",
      "## Questions de dirigeants : réponses complètes",
      "## Glossaire de l’IA en entreprise",
    ]) {
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
    const montants = COMPLET.match(/\d[\d\s  .]*\s?€/g) ?? [];
    expect(new Set(montants.map((m) => m.replace(/\D/g, "")))).toEqual(
      new Set(["1490", String(seuilGarantieEur())]),
    );
  });

  it("toutes les URL sont absolues, en /fr, et correspondent à une route existante", () => {
    for (const cle of ROUTES_CITEES_LLMS.filter((c) => c !== "/cartographie")) {
      expect(routeExiste(cle), cle).toBe(true);
    }
    const urls = [...`${COURT}\n${COMPLET}`.matchAll(/(https:\/\/axion-ia\.com[^)\s]*)/g)].map(
      (m) => (m[1] as string).replace(/[.,;:]+$/, ""),
    );
    expect(urls.length).toBeGreaterThan(100);
    const pathnames = routing.pathnames as Record<string, unknown>;
    for (const u of urls) {
      const chemin = u.slice(SITE.length);
      expect(chemin === "/fr" || chemin.startsWith("/fr/"), u).toBe(true);
      const sansLocale = chemin.slice(3) || "/";
      const hub = "/" + (sansLocale.split("/")[1] ?? "");
      expect(sansLocale in pathnames || hub in pathnames, u).toBe(true);
    }
  });

  it("n'annonce une offre que si sa route existe (Cartographie apparaît d'elle-même)", () => {
    const noms = offresLlms(SITE).map((o) => o.url);
    expect(noms).toContain(`${SITE}/fr/journee-ia`);
    expect(noms.includes(`${SITE}/fr/cartographie`)).toBe(routeExiste("/cartographie"));
  });

  it("chaque question courte a une page, et sa réponse commence comme la réponse de référence", () => {
    const questions = questionsCourtesLlms(SITE);
    expect(questions.length).toBeGreaterThanOrEqual(10);
    for (const q of questions) {
      expect(q.url.startsWith(`${SITE}/fr`), q.id).toBe(true);
      expect(q.reponse.length, q.id).toBeGreaterThan(80);
      expect(q.reponse, q.id).not.toMatch(/se paie|paiement/i);
    }
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
      expect(corps).toContain("## Formation, mise en place, intégration (sur devis)");
      expect(corps).toContain("https://axion-ia.com/fr/un-a-un");
      expect(corps).not.toMatch(INTERDITS);
      expect(corps).not.toMatch(/https:\/\/axion-ia\.com\/en(\/|\b)/);
    },
  );
});
