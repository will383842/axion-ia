/**
 * CLIQUET — la prévention des violences doit vivre dans les DEUX règlements.
 *
 * ## Pourquoi ce fichier existe en plus du cliquet voisin
 *
 * `reglement-interieur-publie-vaut-le-pdf.spec.ts` garde déjà l'équivalence des
 * deux versions — mais il ne compare que les articles du **code du travail**.
 * La clause de prévention introduite le 2026-09-13 se fonde sur le **code
 * pénal** : elle passerait donc entre les mailles, et les deux versions
 * pourraient diverger exactement là où c'est le plus coûteux.
 *
 * 🔑 C'est la forme récurrente de ce dépôt : *une règle écrite et justifiée à un
 * endroit, appliquée à un site, oubliée sur son jumeau.* Elle s'est déjà
 * produite sur ce règlement précis, en août 2026, sur les droits de la défense.
 *
 * ## Le défaut d'origine
 *
 * Décret n° 2026-728 du 1er août 2026, en vigueur au **1er novembre 2026** : le
 * critère 4 du RNQ exige des mesures de prévention des violences sexistes et
 * sexuelles, du harcèlement et des discriminations, ET la trace de la façon dont
 * un signalement est traité.
 *
 * Mesuré le 2026-09-13, avant correctif : « harcèlement », « violence »,
 * « discrimination », « sexiste », « sexuel » — **zéro occurrence**, ni dans la
 * page publique ni dans le document remis au stagiaire.
 *
 * ⚠️ C'est la page PUBLIQUE que le certificateur lira. Un premier audit examine
 * tous les indicateurs applicables, pas un échantillon.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();

const PAGE = readFileSync(join(RACINE, "src/content/legal.ts"), "utf8");
const GABARIT = readFileSync(
  join(RACINE, "src/server/qualiopi/documents/templates/reglement-interieur.tsx"),
  "utf8",
);

const VERSIONS = [
  ["la page publiée", PAGE],
  ["le document remis au stagiaire", GABARIT],
] as const;

/** Les fondements que la clause doit nommer, des deux côtés. */
const CITATIONS = ["222-33", "222-33-2-2", "225-1"] as const;

/** Les notions que la clause doit couvrir — le critère 4 les nomme toutes. */
const NOTIONS = ["harcèlement sexuel", "harcèlement moral", "discrimination", "sexiste"] as const;

describe("la prévention des violences est dans les deux versions du règlement", () => {
  for (const [nom, source] of VERSIONS) {
    it(`${nom} nomme les quatre notions du critère 4`, () => {
      const bas = source.toLowerCase();
      const manquantes = NOTIONS.filter((n) => !bas.includes(n));
      expect(
        manquantes,
        `${nom} ne couvre pas ces notions. Le critère 4 du RNQ, renforcé par le ` +
          `décret 2026-728 (1er novembre 2026), exige des mesures de prévention des ` +
          `violences sexistes et sexuelles, du harcèlement et des discriminations. ` +
          `Avant le 2026-09-13, les deux versions en portaient ZÉRO.`,
      ).toEqual([]);
    });

    it(`${nom} cite les fondements pénaux, et pas seulement l'intention`, () => {
      // Une clause qui interdit sans nommer le texte est une intention. Le
      // certificateur cherche le fondement ; la victime, elle, cherche son droit.
      const manquantes = CITATIONS.filter((c) => !source.includes(c));
      expect(
        manquantes,
        `${nom} ne cite plus ces articles du code pénal : harcèlement sexuel (222-33), ` +
          `harcèlement moral (222-33-2-2), discriminations (225-1). Le cliquet voisin ` +
          `ne les garde PAS — il ne compare que les articles du code du travail.`,
      ).toEqual([]);
    });

    it(`${nom} dit ce qui se passe APRÈS un signalement`, () => {
      // Le décret n'exige pas seulement d'interdire : il exige la trace du
      // TRAITEMENT. Une clause qui prohibe sans dire qui reçoit, sous quel délai
      // et avec quelle suite ne couvre que la moitié de l'indicateur.
      const bas = source.toLowerCase();
      for (const attendu of ["signal", "48 heures", "confidentiel", "conservatoire"]) {
        expect(
          bas.includes(attendu),
          `${nom} ne dit pas « ${attendu} ». Le critère 4 renforcé demande la trace du ` +
            `traitement d'un signalement — qui le reçoit, sous quel délai, avec quelles ` +
            `mesures — pas seulement l'interdiction.`,
        ).toBe(true);
      }
    });
  }

  it("le témoin lit de VRAIES sources, pas des fichiers vides", () => {
    // Sans ceci, un chemin devenu faux rendrait deux chaînes vides et toutes les
    // assertions ci-dessus passeraient en ne mesurant rien.
    expect(PAGE.length).toBeGreaterThan(10000);
    expect(GABARIT.length).toBeGreaterThan(5000);
    expect(PAGE).toContain("reglement-interieur");
    expect(GABARIT).toContain("Article 3");
  });
});
