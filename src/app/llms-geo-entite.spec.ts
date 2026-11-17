/**
 * Tests — audit GEO indépendant du 2026-11-11 sur `llms.txt` et `llms-full.txt`.
 *
 *  1. La ligne « Avis clients » n'existe que si au moins un avis est publié (même règle
 *     que les pages /avis, qui répondent 404 sinon).
 *  2. La Journée IA : description du nœud Service, garantie et condition MOT POUR MOT,
 *     rapport complet.
 *  3. Aucun mot proscrit (hors ligne du Tour France IA, décision en attente).
 *  4. Voix « nous » : aucune promesse d'intervention personnelle du fondateur.
 *  7. Les faits partagés (langues, hébergement, faits pratiques) sont IDENTIQUES dans les
 *     deux fichiers, et le bruit interne a disparu.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/seo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/seo")>();
  return { ...actual, SITE_URL: "https://axion-ia.com" };
});

const avis = vi.hoisted(() => ({ publies: false }));
vi.mock("@/server/reviews/presence", () => ({
  avisPublies: vi.fn(async () => avis.publies),
}));

import { GET as getLlms } from "./llms.txt/route";
import { GET as getLlmsFull } from "./llms-full.txt/route";
import {
  CONDITION_GARANTIE,
  DESCRIPTION_SERVICE_JOURNEE_IA,
  GARANTIE_PHRASE,
  RAPPORT_COMPLET,
  remplacerJetons,
} from "@/content/journee-ia-commun";
import {
  LIBELLE_SITES_WEB_FR,
  MOTS_INTERDITS_LLMS,
  enteteFaitsLlms,
  sectionFaitsPratiquesLlms,
} from "@/app/_llms/faits-communs";

const SITE = "https://axion-ia.com";
const lireLlms = async () => (await getLlms()).text();
const lireFull = async () => (await getLlmsFull()).text();

/** La section Tour France IA est exclue : décision du fondateur en attente. */
const sansTour = (t: string) =>
  t
    .split("\n")
    .filter((l) => !l.startsWith("- [Tour France IA]"))
    .join("\n");

describe("1. Avis clients : seulement s'il existe un avis publié", () => {
  beforeEach(() => {
    avis.publies = false;
  });

  it("aucun avis publié : ni ligne, ni lien vers /fr/avis ou son flux", async () => {
    const corps = await lireLlms();
    expect(corps).not.toContain("[Avis clients]");
    expect(corps).not.toContain(`${SITE}/fr/avis`);
    expect(corps).not.toMatch(/Omnibus/);
  });

  it("au moins un avis publié : la ligne revient, sans « conforme »", async () => {
    avis.publies = true;
    const corps = await lireLlms();
    const ligne = corps.split("\n").find((l) => l.startsWith("- [Avis clients]")) ?? "";
    expect(ligne).toContain(`${SITE}/fr/avis/feed.xml`);
    expect(ligne).not.toMatch(MOTS_INTERDITS_LLMS);
  });
});

describe("2. La Journée IA : description, garantie et rapport, mot pour mot", () => {
  it.each([
    ["llms.txt", lireLlms],
    ["llms-full.txt", lireFull],
  ] as const)("%s", async (_n, lire) => {
    const corps = await lire();
    expect(corps).toContain(remplacerJetons(DESCRIPTION_SERVICE_JOURNEE_IA));
    expect(corps).toContain(GARANTIE_PHRASE);
    expect(corps).toContain(CONDITION_GARANTIE);
    expect(corps).toContain(RAPPORT_COMPLET);
    expect(corps).toContain("2 à 4 h selon la structuration de l’entreprise");
    expect(corps).not.toContain("{{");
  });
});

describe("3. Mots proscrits", () => {
  it("llms.txt : aucun, hors ligne du Tour France IA", async () => {
    const corps = sansTour(await lireLlms());
    expect(corps).not.toMatch(MOTS_INTERDITS_LLMS);
    for (const exact of [
      "Conformité RGPD intégrale",
      "Sites web & SaaS IA",
      "cabinets, agences, SaaS",
      "conformité partielle",
    ]) {
      expect(corps).not.toContain(exact);
    }
    expect(corps).toContain(`[${LIBELLE_SITES_WEB_FR}](${SITE}/fr/sites-web-augmentes)`);
  });

  it("llms-full.txt : aucun, FAQ partagée comprise", async () => {
    const corps = await lireFull();
    expect(corps).not.toMatch(MOTS_INTERDITS_LLMS);
    // Garde anti-test-vide : la FAQ est toujours là.
    expect((corps.split("## FAQ")[1] ?? "").length).toBeGreaterThan(5000);
  });

  it("le motif attrape bien ce qu'il doit attraper", () => {
    for (const mot of ["SaaS", "no-code", "conforme", "conformité", "ETI", "financé"]) {
      expect(mot, mot).toMatch(MOTS_INTERDITS_LLMS);
    }
    expect("gain financier").not.toMatch(MOTS_INTERDITS_LLMS);
  });
});

describe("4. Voix « nous »", () => {
  it.each([
    ["llms.txt", lireLlms],
    ["llms-full.txt", lireFull],
  ] as const)("%s : aucune intervention personnelle promise", async (_n, lire) => {
    const corps = await lire();
    expect(corps).not.toMatch(/intervient personnellement|dirige les interventions/i);
  });
});

describe("7. Faits communs, identiques dans les deux fichiers", () => {
  const avant = process.env["EN_LOCALE_ENABLED"];
  afterEach(() => {
    if (avant === undefined) delete process.env["EN_LOCALE_ENABLED"];
    else process.env["EN_LOCALE_ENABLED"] = avant;
  });

  it.each([false, true])("même en-tête et mêmes faits pratiques (EN servi : %s)", async (en) => {
    process.env["EN_LOCALE_ENABLED"] = en ? "true" : "false";
    const [llms, full] = await Promise.all([lireLlms(), lireFull()]);
    for (const ligne of enteteFaitsLlms()) {
      expect(llms).toContain(`> ${ligne}`);
      expect(full).toContain(`> ${ligne}`);
    }
    const faits = sectionFaitsPratiquesLlms(SITE);
    expect(llms).toContain(faits);
    expect(full).toContain(faits);
    expect(llms.includes("/sitemaps/images-en.xml")).toBe(en);
  });

  it("aucun fait divergent ni invérifiable", async () => {
    for (const corps of [await lireLlms(), await lireFull()]) {
      expect(corps).not.toMatch(/Nuremberg|Frankfurt|CPX32|implanté en Europe/);
      expect(corps).not.toMatch(/EN miroir|\bmiroir EN\b/);
      expect(corps).not.toMatch(/Audit (?:IA )?(?:en )?5 j/);
      expect(corps).not.toMatch(/4 tailles d'entreprise × 2 modalités/);
    }
  });

  it("llms.txt : plus de bruit interne", async () => {
    const corps = await lireLlms();
    for (const bruit of [
      "Stripe",
      "Resend",
      "Vercel",
      "Telegram",
      "AGENTS.md",
      "Mobile-first",
      "17 500",
      "2 150 communes",
    ]) {
      expect(corps, bruit).not.toContain(bruit);
    }
  });

  it("llms.txt : les pages d'entrée sont en tête", async () => {
    const corps = await lireLlms();
    const tete = corps.split("## Offre phare")[0] ?? "";
    expect(tete).toContain(`(${SITE}/fr)`);
    expect(tete).toContain(`(${SITE}/fr/a-propos)`);
    expect(tete).toContain(`(${SITE}/fr/faq/ai-act-2026)`);
  });
});
