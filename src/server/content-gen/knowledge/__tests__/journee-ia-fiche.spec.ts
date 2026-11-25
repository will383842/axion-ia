import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DELAI_RAPPORT_JOURS_OUVRES,
  MULTIPLE_GARANTIE,
  seuilGarantieEur,
} from "@/content/journee-ia-commun";
import { JOURNEE_IA_TIER, formatTierPrice } from "@/content/pricing";
import {
  INTERDITS_JOURNEE_IA,
  consigneJourneeIA,
  construireFicheJourneeIA,
  sujetTouchelaJourneeIA,
  trouveInterdits,
} from "../journee-ia-fiche";

afterEach(() => {
  vi.doUnmock("@/content/journee-ia-commun");
  vi.doUnmock("@/content/pricing");
  vi.resetModules();
});

describe("fiche Journée IA", () => {
  const fiche = construireFicheJourneeIA();

  it("porte le prix lu dans pricing.ts, sans prix barré", () => {
    expect(fiche).toContain(formatTierPrice(JOURNEE_IA_TIER, "fr"));
    expect(fiche).not.toContain("{{PRIX}}");
  });

  it("porte le délai et le multiple de la garantie, issus du fichier commun", () => {
    expect(fiche).toContain(`${DELAI_RAPPORT_JOURS_OUVRES} jours ouvrés`);
    expect(fiche).toContain(`${MULTIPLE_GARANTIE} fois`);
    expect(fiche).toContain("gains identifiés");
    expect(fiche).toMatch(/dirigeant|décideur/);
    expect(fiche).toContain("partout en France");
  });

  it("ne contient aucun interdit", () => {
    expect(trouveInterdits(fiche)).toEqual([]);
  });

  it("ne cite pas le seuil de la garantie en euros", () => {
    const seuil = seuilGarantieEur().toLocaleString("fr-FR");
    expect(fiche.replace(/[  ]/g, " ")).not.toContain(seuil.replace(/[  ]/g, " "));
  });

  it("détecte chaque interdit dans un texte fautif", () => {
    const fautifs = [
      "Dans nos locaux à Grenoble",
      "frais de déplacement en sus",
      "déplacement inclus",
      "au lieu de 2 000 € prix barré",
      "5 fois le prix",
      "soit 4 470 €",
      "aucun gain garanti",
      "des gains garantis",
      "réservez et payez en ligne",
      "un acompte de 30 %",
      "conditions d'annulation",
      "déplacements inclus",
      "anciennement 1 990 €",
      "x5 le prix",
      "soit 4.470 €",
      "aucun gain n’est garanti",
      "ROI garanti",
      "réservez dès aujourd'hui en ligne",
      "payez directement sur le site",
      "annulez sans frais",
      "nos amis grenoblois",
      "le déplacement est inclus",
      "journée annulée",
    ];
    for (const t of fautifs) expect(trouveInterdits(t).length, t).toBeGreaterThan(0);
    expect(INTERDITS_JOURNEE_IA).toHaveLength(11);
  });

  it("la consigne ne s'active que si le sujet touche la Journée IA", () => {
    for (const sujet of ["journées IA en PME", "Journée de l'IA", "audit IA en une journée"])
      expect(sujetTouchelaJourneeIA(sujet), sujet).toBe(true);
    expect(trouveInterdits("Au lieu de perdre du temps, formez vos équipes")).toEqual([]);
    expect(consigneJourneeIA("Comment démarrer l'IA en PME")).toBe("");
    const c = consigneJourneeIA("Journée IA : à quoi s'attendre");
    expect(c).toContain(fiche);
    expect(c).toContain("Grenoble");
    expect(sujetTouchelaJourneeIA("la journee audit IA")).toBe(true);
    expect(sujetTouchelaJourneeIA(undefined, null, "")).toBe(false);
  });

  it("change quand la constante change", async () => {
    vi.resetModules();
    vi.doMock("@/content/journee-ia-commun", async (orig) => ({
      ...(await orig<typeof import("@/content/journee-ia-commun")>()),
      DELAI_RAPPORT_JOURS_OUVRES: 7,
      MULTIPLE_GARANTIE: 2,
    }));
    const mod = await import("../journee-ia-fiche");
    const autre = mod.construireFicheJourneeIA();
    expect(autre).toContain("7 jours ouvrés");
    expect(autre).toContain("2 fois");
    expect(autre).not.toContain(`${MULTIPLE_GARANTIE} fois`);
    expect(autre).not.toBe(fiche);
  });

  it("change quand le prix change", async () => {
    vi.resetModules();
    vi.doMock("@/content/pricing", async (orig) => {
      const m = await orig<typeof import("@/content/pricing")>();
      return { ...m, JOURNEE_IA_TIER: { ...m.JOURNEE_IA_TIER, priceFlat: 1234 } };
    });
    const mod = await import("../journee-ia-fiche");
    const autre = mod.construireFicheJourneeIA();
    expect(autre).toContain("1");
    expect(autre).not.toBe(fiche);
    expect(autre).toMatch(/1[\s  ]234/);
  });

  it("est câblée dans les générateurs", () => {
    const lire = (f: string) => readFileSync(join(__dirname, "../../generators", f), "utf8");
    expect(lire("blog-article.ts")).toMatch(/consigneJourneeIA\(/);
    expect(lire("v7-phase8-shared.ts")).toMatch(/consigneJourneeIA\(/);
    expect(lire("ville-hub-copy.ts")).toContain("consigneJourneeIAForcee()");
    expect(lire("landing-ville-faq-extended.ts")).toContain("consigneJourneeIAForcee()");
  });
});
