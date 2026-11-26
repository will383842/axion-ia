/** Faits de référence de l'offre : dérivés de la source unique, jamais écrits en dur. */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CONDITION_GARANTIE,
  GARANTIE_PHRASE,
  MULTIPLE_GARANTIE,
} from "@/content/journee-ia-commun";
import { JOURNEE_IA_TIER, formatTierPrice } from "@/content/pricing";
import { MAX_CARACTERES_FICHE } from "../fidelite-llm";
import { faitsReferenceOffre, ID_FAITS_OFFRE } from "../faits-offre";

afterEach(() => {
  vi.doUnmock("@/content/pricing");
  vi.resetModules();
});

describe("faitsReferenceOffre", () => {
  it("porte prix, garantie, condition, format, zone et déplacement, tirés des constantes", () => {
    const f = faitsReferenceOffre();
    expect(f.id).toBe(ID_FAITS_OFFRE);
    expect(f.texte).toContain(formatTierPrice(JOURNEE_IA_TIER, "fr"));
    expect(f.texte).toContain(`${MULTIPLE_GARANTIE} fois`);
    expect(f.texte).toContain(GARANTIE_PHRASE);
    expect(f.texte).toContain(CONDITION_GARANTIE);
    expect(f.texte).toMatch(/présentiel/);
    expect(f.texte).toMatch(/partout en France/);
    expect(f.texte).toMatch(/déplacement/);
    expect(f.texte).toMatch(/acompte/);
    expect(f.texte).not.toContain("{{");
    expect(f.texte.length).toBeLessThanOrEqual(MAX_CARACTERES_FICHE);
  });

  it("lève si le prix est illisible", async () => {
    vi.resetModules();
    vi.doMock("@/content/pricing", async (orig) => {
      const m = await orig<typeof import("@/content/pricing")>();
      return { ...m, JOURNEE_IA_TIER: { ...m.JOURNEE_IA_TIER, priceFlat: null } };
    });
    // Illisible : soit l'import de la fiche lève déjà (seuil incalculable), soit l'appel.
    await expect(
      import("../faits-offre").then((mod) => mod.faitsReferenceOffre()),
    ).rejects.toThrow();
  });
});
