import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VILLES_PUBLIABLES_CAP } from "@/generated/villes-publiables";
import { isNoindexStubRoute } from "@/lib/seo-noindex-routes";
import { villeIndexableParPorte } from "@/lib/villes-porte-qualite";
import { contenuListeGeneree } from "../liste-generee";
import { rapportVilles } from "../verdicts-villes";

describe("liste générée des villes publiables", () => {
  it("est à jour (sinon : pnpm tsx scripts/content-gen/gen-villes-publiables.ts)", () => {
    const publiables = rapportVilles()
      .filter((l) => l.publiable)
      .map((l) => l.slug);
    const attendu = contenuListeGeneree(publiables);
    const reel = readFileSync(join(process.cwd(), "src/generated/villes-publiables.ts"), "utf8");
    expect(reel).toBe(attendu);
  }, 60_000);
});

describe("drapeau éteint : aucun changement visible", () => {
  const ALLUME = { VILLES_PORTE_QUALITE_ACTIVE: "true" };

  it("aucune ville n'est indexable par la porte, même si elle figure dans la liste", () => {
    for (const slug of [...VILLES_PUBLIABLES_CAP, "lyon", "grenoble"]) {
      expect(villeIndexableParPorte(slug, {})).toBe(false);
      expect(villeIndexableParPorte(slug, { VILLES_PORTE_QUALITE_ACTIVE: "false" })).toBe(false);
    }
  });

  it("l'en-tête Edge reste noindex sur toutes les pages par-ville (défaut et éteint)", () => {
    for (const slug of ["lyon", "grenoble", "paris", "petite-commune"]) {
      expect(isNoindexStubRoute(`/fr/audit/par-ville/${slug}`)).toBe(true);
      expect(isNoindexStubRoute(`/fr/formations/par-ville/${slug}`, {})).toBe(true);
    }
  });

  it("allumé, une ville hors liste reste noindex", () => {
    expect(isNoindexStubRoute("/fr/audit/par-ville/ville-hors-liste", ALLUME)).toBe(true);
  });

  it("allumé, une ville de la liste n'a plus l'en-tête noindex", () => {
    if (VILLES_PUBLIABLES_CAP.length === 0) return; // liste vide aujourd'hui : rien à vérifier
    const slug = VILLES_PUBLIABLES_CAP[0]!;
    expect(isNoindexStubRoute(`/fr/audit/par-ville/${slug}`, ALLUME)).toBe(false);
  });
});

describe("Grenoble : même règle que les autres villes", () => {
  it("aucun fichier de la porte ne traite un slug à part", () => {
    for (const f of [
      "src/server/content-gen/villes/porte-qualite-ville.ts",
      "src/server/content-gen/villes/contenu-ville.ts",
      "src/server/content-gen/villes/verdicts-villes.ts",
      "src/lib/villes-porte-qualite.ts",
      "scripts/content-gen/villes-rapport.ts",
    ]) {
      expect(readFileSync(join(process.cwd(), f), "utf8").toLowerCase(), f).not.toContain(
        "grenoble",
      );
    }
  });
});
