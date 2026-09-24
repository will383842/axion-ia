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
  FORM_REF_REINSCRIPTION,
  TEXTE_CASE_LETTRE,
  TEXTE_MENTION,
  TEXTE_REINSCRIPTION,
  VERSION_LETTRE,
  VERSION_MENTION,
  VERSION_REINSCRIPTION,
  libellesFormulaireGuide,
} from "@/content/guide-ia-formulaire";

const empreinte = (s: unknown): string =>
  createHash("sha256").update(JSON.stringify(s)).digest("hex").slice(0, 16);

/**
 * Empreintes FIGÉES à la main. Un texte change ⇒ monter sa version ET recopier
 * ici l'empreinte nouvelle, dans le même commit.
 */
const FIGEES: ReadonlyArray<readonly [string, string, string, unknown]> = [
  ["lettre-guide-v3-2026-09-24", "393bf5b38714ae6c", VERSION_LETTRE.guide, TEXTE_CASE_LETTRE.guide],
  [
    "lettre-article-v3-2026-09-24",
    "393bf5b38714ae6c",
    VERSION_LETTRE.article,
    TEXTE_CASE_LETTRE.article,
  ],
  ["guide-mention-pro-v1-2026-09-24", "9ac098c73985c73f", VERSION_MENTION.pro, TEXTE_MENTION.pro],
  [
    "guide-mention-perso-v1-2026-09-24",
    "339cc5e7fbf0aeaa",
    VERSION_MENTION.perso,
    TEXTE_MENTION.perso,
  ],
  [
    "lettre-reinscription-email-v1-2026-09-24",
    "64ee6d85b35aab42",
    VERSION_REINSCRIPTION,
    TEXTE_REINSCRIPTION,
  ],
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
    expect(FORM_REF_REINSCRIPTION).not.toBe(FORM_REF_LETTRE.guide);
  });
});

describe("les textes suivent l'amendement de Will (24/09)", () => {
  it("le champ accepte toute adresse : « Votre e-mail », plus « professionnel »", () => {
    expect(libellesFormulaireGuide("guide", "fr").email).toBe("Votre e-mail");
    expect(libellesFormulaireGuide("article", "en").email).toBe("Your email");
  });

  for (const variante of ["guide", "article"] as const) {
    it(`${variante} : la case dit le texte de l'amendement, et jamais « mensuel »`, () => {
      expect(TEXTE_CASE_LETTRE[variante].fr).toBe(
        "Je souhaite aussi recevoir la lettre d'Axion-IA (quelques lettres par an).",
      );
      expect(TEXTE_CASE_LETTRE[variante].fr).not.toMatch(/mensuel/i);
    });
  }

  it("mention PRO : elle annonce l'inscription et la désinscription en un clic", () => {
    expect(TEXTE_MENTION.pro.fr).toMatch(
      /^En recevant le guide, vous recevrez aussi quelques lettres par an, à chaque nouveauté utile\. Désinscription en un clic, à tout moment\./,
    );
  });

  it("mention PERSO : elle renvoie à la case, et ne promet aucune inscription", () => {
    expect(TEXTE_MENTION.perso.fr).toContain("que si vous cochez la case");
    expect(TEXTE_MENTION.perso.fr).not.toContain("vous recevrez aussi");
  });

  it("la mention est affichée par le formulaire, selon la nature, avec le lien vers la politique", () => {
    const l = libellesFormulaireGuide("guide", "fr");
    expect(l.mention).toEqual({ pro: TEXTE_MENTION.pro.fr, perso: TEXTE_MENTION.perso.fr });
    expect(l.politique.href).toBe("/fr/politique-confidentialite");
    const form = readFileSync(
      join(process.cwd(), "src/components/forms/NewsletterForm.tsx"),
      "utf8",
    );
    expect(form).toContain("libelles.mention.perso : libelles.mention.pro");
    expect(form).toContain("libelles.politique.href");
    // La case n'apparaît que pour une adresse personnelle.
    expect(form).toMatch(/const blocConsentement = perso \? \(\s*<div/);
  });

  it("⛔ aucun numéro de téléphone, jamais « Zoom », dans les textes du formulaire", () => {
    const tout = JSON.stringify([
      libellesFormulaireGuide("guide", "fr"),
      libellesFormulaireGuide("article", "fr"),
      libellesFormulaireGuide("guide", "en"),
      TEXTE_REINSCRIPTION,
    ]);
    expect(tout).not.toMatch(/\b0[1-9](?:[ .]?\d{2}){4}\b|\+33/);
    expect(tout).not.toMatch(/zoom/i);
  });
});
