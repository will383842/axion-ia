/**
 * SEO du catalogue V2 — garde-fous par formation (issus de l'audit SEO).
 * Pour CHAQUE formation :
 *  - metaTitleFr ≤ 65 caractères (SERP),
 *  - metaDescriptionFr ≤ 160 caractères (SERP),
 *  - h1Fr ≠ accrocheFr (le H1 porte un bénéfice distinct de l'accroche),
 *  - faqs.length ≥ 3 (longue traîne / FAQPage).
 */

import { describe, it, expect } from "vitest";
import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";

// Fourchette SERP anti-troncature — miroir des seuils canoniques de
// `src/server/content-gen/shared/meta-length.ts`. Valeurs recopiées, PAS
// importées : le check d'isolation de Gate A interdit toute dépendance de
// src/content vers la zone content-gen.
const META_DESCRIPTION_LENGTH = { min: 140, max: 160 } as const;

/**
 * Mots vides francophones : une description qui se termine par l'un d'eux suivi
 * d'un point a été coupée en plein milieu d'une phrase. Le plafond seul (160) ne
 * l'attrape pas — 7 descriptions tronquées sont ainsi passées au vert et ont été
 * servies en SERP (« …et production de. », « …Présentiel ou. »).
 */
const MOT_SUSPENDU =
  /\b(la|le|les|l'|de|du|des|d'|et|ou|avec|sur|en|un|une|à|au|aux|pour|votre|vos|dans|par|sans|leur|ses|son|ce|cette)\.\s*$/i;

describe("catalogue V2 — SEO par formation", () => {
  it("metaTitleFr ≤ 65 caractères pour chaque formation", () => {
    for (const f of FORMATIONS_V2) {
      expect(f.metaTitleFr.length, `${f.id}: "${f.metaTitleFr}"`).toBeLessThanOrEqual(65);
    }
  });

  it("metaDescriptionFr ≤ 160 caractères pour chaque formation", () => {
    for (const f of FORMATIONS_V2) {
      expect(f.metaDescriptionFr.length, `${f.id}: "${f.metaDescriptionFr}"`).toBeLessThanOrEqual(
        META_DESCRIPTION_LENGTH.max,
      );
    }
  });

  // Plancher : sans lui, rien n'empêche une description de 40 caractères (et le
  // plafond seul encourage à couper au lieu de rédiger). Cf. meta-length.ts.
  it("metaDescriptionFr ≥ 140 caractères pour chaque formation", () => {
    for (const f of FORMATIONS_V2) {
      expect(
        f.metaDescriptionFr.length,
        `${f.id}: "${f.metaDescriptionFr}"`,
      ).toBeGreaterThanOrEqual(META_DESCRIPTION_LENGTH.min);
    }
  });

  it("metaDescriptionFr ne se termine jamais sur un mot suspendu (troncature)", () => {
    for (const f of FORMATIONS_V2) {
      expect(
        MOT_SUSPENDU.test(f.metaDescriptionFr),
        `${f.id}: description coupée en plein mot → "${f.metaDescriptionFr}"`,
      ).toBe(false);
    }
  });

  it("h1Fr ≠ accrocheFr pour chaque formation", () => {
    for (const f of FORMATIONS_V2) {
      expect(f.h1Fr, f.id).not.toBe(f.accrocheFr);
    }
  });

  it("au moins 3 FAQ par formation (longue traîne / FAQPage)", () => {
    for (const f of FORMATIONS_V2) {
      expect(f.faqs.length, f.id).toBeGreaterThanOrEqual(3);
    }
  });
});
