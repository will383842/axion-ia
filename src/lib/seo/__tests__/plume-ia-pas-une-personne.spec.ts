/**
 * V1-18 — garde : l'auteur IA n'est jamais un `Person` ni « Expert(e) IA ».
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPersonManonJsonLd } from "../../seo-content-gen-factories";
import { LIBELLE_PLUME_IA } from "../plume-ia";

const LIGNE_ANCIENNE = {
  slug: "manon",
  displayName: "Manon",
  jobTitle: "Experte IA chez Axion-IA", // ancienne valeur en base : ne doit plus sortir
  photoUrl1024: "/auteurs/manon.png",
  photoAlt: null,
  knowsAbout: ["Intelligence artificielle opérationnelle"],
  personaDisclaimer: null,
};

describe("V1-18 — la plume IA n'est pas une personne experte", () => {
  it("le JSON-LD est une Organization, sans jobTitle, même si la base dit « Experte IA »", () => {
    const ld = buildPersonManonJsonLd(LIGNE_ANCIENNE);
    expect(ld["@type"]).toBe("Organization");
    expect(ld["name"]).toBe(LIBELLE_PLUME_IA);
    expect(ld["jobTitle"]).toBeUndefined();
    expect(ld["givenName"]).toBeUndefined();
    expect(JSON.stringify(ld)).not.toMatch(/expert(e)?\s+(en\s+)?ia/i);
  });

  it.each([
    "src/components/knowledge/public/AuthorByline.tsx",
    "src/lib/seo-content-gen-factories.ts",
    "src/lib/seo/manon-person.ts",
  ])("%s n'affiche jamais « Expert(e) IA » comme titre d'auteur", (f) => {
    const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(src).not.toMatch(/Expert(e)?\s+(en\s+)?IA/);
  });

  it("l'AuthorByline type la plume IA en Organization", () => {
    const src = readFileSync("src/components/knowledge/public/AuthorByline.tsx", "utf8");
    expect(src).toMatch(/estPlumeIa \? "Organization" : "Person"/);
  });
});
