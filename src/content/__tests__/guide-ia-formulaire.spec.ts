/**
 * Verrou — les textes du formulaire du guide sont l'ARCHIVE de preuve (lot L2).
 *
 * Le registre de preuve consigne une VERSION ; ce fichier dit quel texte elle
 * désigne. Si une phrase change sans que sa version monte, le registre
 * attribuerait à des personnes un texte qu'elles n'ont jamais lu. Ce test fige
 * l'empreinte de chaque texte versionné : il rougit à tout changement de texte,
 * et on le fait reverdir en montant la version (et l'empreinte) ensemble.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  FORM_REF_LETTRE,
  TEXTE_CASE_LETTRE,
  TEXTE_MENTION_GUIDE,
  VERSION_LETTRE,
  VERSION_MENTION_GUIDE,
  libellesFormulaireGuide,
} from "@/content/guide-ia-formulaire";

const empreinte = (s: unknown): string =>
  createHash("sha256").update(JSON.stringify(s)).digest("hex").slice(0, 16);

/**
 * Empreintes FIGÉES à la main. Un texte change ⇒ monter sa version ET recopier
 * ici l'empreinte nouvelle, dans le même commit.
 */
const FIGEES: ReadonlyArray<readonly [string, string, string, unknown]> = [
  ["lettre-guide-v2-2026-09-24", "71ff0ec985d837b1", VERSION_LETTRE.guide, TEXTE_CASE_LETTRE.guide],
  [
    "lettre-article-v2-2026-09-24",
    "eb223708369a0e0c",
    VERSION_LETTRE.article,
    TEXTE_CASE_LETTRE.article,
  ],
  ["guide-mention-v1-2026-09-24", "953e3fa46d2dbb13", VERSION_MENTION_GUIDE, TEXTE_MENTION_GUIDE],
];

describe("🔴 changer un texte = changer sa version", () => {
  for (const [versionFigee, empreinteFigee, version, texte] of FIGEES) {
    it(`${versionFigee} : version en vigueur, et texte inchangé`, () => {
      expect(version).toBe(versionFigee);
      expect(
        empreinte(texte),
        `Le texte de ${versionFigee} a changé : monter la version, puis recopier l'empreinte ici`,
      ).toBe(empreinteFigee);
    });
  }

  it("deux points de collecte, deux références, deux versions distinctes", () => {
    expect(FORM_REF_LETTRE.guide).not.toBe(FORM_REF_LETTRE.article);
    expect(VERSION_LETTRE.guide).not.toBe(VERSION_LETTRE.article);
  });
});

describe("la case « lettre » est honnête", () => {
  for (const variante of ["guide", "article"] as const) {
    it(`${variante} : elle ne conditionne pas le guide, et dit la cadence réelle`, () => {
      const fr = TEXTE_CASE_LETTRE[variante].fr;
      expect(fr).toMatch(/^Je souhaite aussi recevoir/);
      expect(fr).toContain("Quelques lettres par an, à chaque nouveauté utile.");
      expect(fr).toContain("Désinscription en un clic");
      expect(fr).not.toMatch(/mensuel/i);
    });
  }

  it("la mention d'information est affichée par le formulaire, avec le lien vers la politique", () => {
    const l = libellesFormulaireGuide("guide", "fr");
    expect(l.mention).toBe(TEXTE_MENTION_GUIDE.fr);
    expect(l.politique.href).toBe("/fr/politique-confidentialite");
    const form = readFileSync(
      join(process.cwd(), "src/components/forms/NewsletterForm.tsx"),
      "utf8",
    );
    expect(form).toContain("{libelles.mention}");
    expect(form).toContain("libelles.politique.href");
  });

  it("⛔ aucun numéro de téléphone, jamais « Zoom », dans les textes du formulaire", () => {
    const tout = JSON.stringify([
      libellesFormulaireGuide("guide", "fr"),
      libellesFormulaireGuide("article", "fr"),
      libellesFormulaireGuide("guide", "en"),
    ]);
    expect(tout).not.toMatch(/\b0[1-9](?:[ .]?\d{2}){4}\b|\+33/);
    expect(tout).not.toMatch(/zoom/i);
  });
});
