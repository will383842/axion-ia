/**
 * Verrou — l'ARCHIVE des textes de consentement (audit final du plan newsletter,
 * 2026-09-26).
 *
 * Trois choses doivent rester vraies, et chacune a son test :
 *   1. toute version EN VIGUEUR est archivée, avec EXACTEMENT le texte servi
 *      (sinon la prochaine montée de version perdrait le texte d'aujourd'hui) ;
 *   2. aucun texte archivé ne change (empreintes figées à la main) ;
 *   3. aucune version archivée ne disparaît (liste fermée).
 *
 * Les empreintes des versions en vigueur sont les MÊMES que celles de
 * `guide-ia-formulaire.spec.ts` (même calcul sur `{ fr, en }`) : deux verrous
 * indépendants qui se recoupent.
 */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  TEXTE_CASE_LETTRE,
  TEXTE_MENTION,
  TEXTE_REINSCRIPTION,
  VERSION_LETTRE,
  VERSION_MENTION,
  VERSION_REINSCRIPTION,
} from "@/content/guide-ia-formulaire";
import {
  ARCHIVE_TEXTES_CONSENTEMENT,
  texteDeLaVersion,
} from "@/content/guide-ia-formulaire-archive";

const empreinte = (t: { fr: string; en: string }): string =>
  createHash("sha256")
    .update(JSON.stringify({ fr: t.fr, en: t.en }))
    .digest("hex")
    .slice(0, 16);

/** Empreintes FIGÉES. On AJOUTE une ligne par version nouvelle ; on n'en modifie aucune. */
const FIGEES: ReadonlyArray<readonly [string, string]> = [
  ["lettre-guide-v3-2026-09-24", "393bf5b38714ae6c"],
  ["lettre-article-v3-2026-09-24", "393bf5b38714ae6c"],
  ["lettre-guide-v4-2026-09-26", "29a51c1bb199a915"],
  ["lettre-article-v4-2026-09-26", "29a51c1bb199a915"],
  ["guide-mention-pro-v1-2026-09-24", "9ac098c73985c73f"],
  ["guide-mention-pro-v2-2026-09-26", "d687d5c090122de4"],
  ["guide-mention-perso-v1-2026-09-24", "339cc5e7fbf0aeaa"],
  ["lettre-reinscription-email-v1-2026-09-24", "64ee6d85b35aab42"],
  ["lettre-reinscription-email-v2-2026-09-25", "331b82ae25e1207c"],
  ["lettre-reinscription-email-v3-2026-09-26", "1979abb533a3b28b"],
];

/** Ce qui est servi AUJOURD'HUI : version → texte. */
const EN_VIGUEUR: ReadonlyArray<readonly [string, { fr: string; en: string }]> = [
  [VERSION_LETTRE.guide, TEXTE_CASE_LETTRE.guide],
  [VERSION_LETTRE.article, TEXTE_CASE_LETTRE.article],
  [VERSION_MENTION.pro, TEXTE_MENTION.pro],
  [VERSION_MENTION.perso, TEXTE_MENTION.perso],
  [VERSION_REINSCRIPTION, TEXTE_REINSCRIPTION],
];

describe("🔴 toute version en vigueur est archivée, avec le texte servi", () => {
  for (const [version, texte] of EN_VIGUEUR) {
    it(version, () => {
      const archive = texteDeLaVersion(version);
      expect(archive, `${version} n'est pas dans l'archive : l'y ajouter`).not.toBeNull();
      expect(archive!.fr).toBe(texte.fr);
      expect(archive!.en).toBe(texte.en);
    });
  }
});

describe("🔴 un texte archivé ne change jamais", () => {
  for (const [version, figee] of FIGEES) {
    it(version, () => {
      const archive = texteDeLaVersion(version);
      expect(archive, `${version} a disparu de l'archive`).not.toBeNull();
      expect(empreinte(archive!), `le texte archivé de ${version} a changé`).toBe(figee);
    });
  }

  it("liste fermée : aucune version archivée sans empreinte figée, aucune retirée", () => {
    expect(Object.keys(ARCHIVE_TEXTES_CONSENTEMENT).sort()).toEqual(FIGEES.map(([v]) => v).sort());
  });

  it("une version inconnue rend null (témoin : la recherche ne répond pas oui à tout)", () => {
    expect(texteDeLaVersion("lettre-guide-v0-inexistante")).toBeNull();
    expect(texteDeLaVersion("toString")).toBeNull();
  });

  it("les anciennes versions portent bien l'ancienne cadence (l'archive n'a pas été « rajeunie »)", () => {
    expect(texteDeLaVersion("lettre-guide-v3-2026-09-24")!.fr).toContain("quelques lettres par an");
    expect(texteDeLaVersion("lettre-reinscription-email-v1-2026-09-24")!.fr).toMatch(
      /^Vous vous étiez désabonné\(e\)/,
    );
  });
});
