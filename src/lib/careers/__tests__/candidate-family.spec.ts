// Famille CRM d'une candidature — et la garde qui empêche la liste des offres
// vidéo de pourrir en silence.
//
// Le bug corrigé le 2026-09-02 : la règle « catégorie `design` → candidat_video »
// rangeait le candidat UX/UI en « vidéo » et le vidéaste en « autre ». Les deux
// premiers tests fixent le comportement attendu ; les suivants confrontent la
// liste au catalogue réel, pour qu'une offre ajoutée demain ne puisse pas passer
// entre les mailles sans que quelqu'un ait tranché.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { candidateFamilyForOffer } from "../candidate-family";
import {
  NON_VIDEO_DESIGN_OFFER_SLUGS,
  VIDEO_EDITOR_OFFER_SLUG,
  VIDEO_FAMILY_OFFER_SLUGS,
} from "../video-editor-offer";

const ROOT = resolve(__dirname, "../../../..");

interface Poste {
  slug: string;
  categorie: string;
}
const POSTES: Poste[] = (
  JSON.parse(readFileSync(join(ROOT, "careers_seed_input.json"), "utf8")) as {
    postes: Poste[];
  }
).postes;

describe("candidateFamilyForOffer", () => {
  it("range la création audiovisuelle en famille vidéo", () => {
    for (const slug of VIDEO_FAMILY_OFFER_SLUGS) {
      expect(candidateFamilyForOffer(slug, "design"), slug).toBe("candidat_video");
      // La catégorie ne doit rien changer : c'est l'offre qui décide.
      expect(candidateFamilyForOffer(slug, "marketing"), slug).toBe("candidat_video");
    }
  });

  // Le témoin du bug : ces deux-là étaient inversés.
  it("le designer UX/UI n'est PAS un candidat vidéo", () => {
    expect(candidateFamilyForOffer("designer-ux-ui", "design")).not.toBe("candidat_video");
  });
  it("le vidéaste, lui, l'est — même en catégorie marketing", () => {
    expect(candidateFamilyForOffer("videaste-content-creator", "marketing")).toBe("candidat_video");
    expect(candidateFamilyForOffer("createur-ugc-reels", "marketing")).toBe("candidat_video");
  });

  it("garde les autres familles inchangées", () => {
    expect(candidateFamilyForOffer("business-developer-ia", "commercial")).toBe(
      "candidat_commercial",
    );
    expect(candidateFamilyForOffer("developpeur-web", "developpement")).toBe("candidat_tech");
    expect(candidateFamilyForOffer("office-manager", "operations")).toBe("candidat_autre");
    expect(candidateFamilyForOffer(null, null)).toBe("candidat_autre");
  });
});

describe("VIDEO_FAMILY_OFFER_SLUGS — confrontée au catalogue", () => {
  it("ne référence que des offres qui existent", () => {
    const known = new Set(POSTES.map((p) => p.slug));
    for (const slug of [...VIDEO_FAMILY_OFFER_SLUGS, ...NON_VIDEO_DESIGN_OFFER_SLUGS]) {
      expect(known.has(slug), `${slug} n'existe plus dans careers_seed_input.json`).toBe(true);
    }
  });

  it("contient l'offre au salon Telegram dédié", () => {
    expect(VIDEO_FAMILY_OFFER_SLUGS.has(VIDEO_EDITOR_OFFER_SLUG)).toBe(true);
  });

  // C'est CETTE garde qui empêche la rechute : une offre `design` ajoutée sans
  // être classée fait rougir le test au lieu de tomber dans un défaut silencieux.
  it("chaque offre de catégorie design est classée d'un côté ou de l'autre", () => {
    const orphelines = POSTES.filter(
      (p) =>
        p.categorie === "design" &&
        !VIDEO_FAMILY_OFFER_SLUGS.has(p.slug) &&
        !NON_VIDEO_DESIGN_OFFER_SLUGS.has(p.slug),
    ).map((p) => p.slug);
    expect(
      orphelines,
      "offre(s) design non classée(s) : ajoute-les à VIDEO_FAMILY_OFFER_SLUGS ou à NON_VIDEO_DESIGN_OFFER_SLUGS",
    ).toEqual([]);
  });

  it("les deux listes ne se recouvrent pas", () => {
    const chevauchement = [...VIDEO_FAMILY_OFFER_SLUGS].filter((s) =>
      NON_VIDEO_DESIGN_OFFER_SLUGS.has(s),
    );
    expect(chevauchement).toEqual([]);
  });
});
