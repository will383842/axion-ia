// @vitest-environment node

/**
 * Verrou — tout code d'alerte que la sonde de santé e-mail LÈVE doit être
 * déclaré au catalogue.
 *
 * ## Ce qui manquait, mesuré le 2026-08-31
 *
 * `server/email/health.ts` lève **cinq** codes ; `ALERTE_CATALOGUE` en
 * connaissait **deux**. Les trois autres — `emails_sante_non_mesurable`,
 * `emails_rebonds`, `emails_rebonds_non_detectes` — arrivaient donc en console
 * sans niveau de référence, sans titre catalogué et surtout **sans guichet**,
 * c'est-à-dire sans personne à qui les adresser. Le champ `guichet` est
 * obligatoire précisément pour qu'un code ne parte pas « au canal par défaut » ;
 * un code jamais déclaré échappe à cette obligation par la porte de derrière.
 *
 * ## Pourquoi DÉRIVER plutôt que compléter la liste
 *
 * `catalogue.spec.ts` porte déjà une liste `CODES_ATTENDUS` tenue à la main. Y
 * ajouter trois lignes referme le trou d'aujourd'hui et laisse le mécanisme
 * intact : une liste écrite à la main ne peut pas signaler ce que personne n'a
 * pensé à y écrire. Elle est restée fausse pendant quinze jours sans que rien
 * ne rougisse.
 *
 * Ce test-ci ne porte donc AUCUNE liste. Il lit la sonde, en extrait les codes
 * qu'elle passe à `leverAlerte`, et exige que le catalogue les connaisse. Un
 * sixième code ajouté demain rougira le jour où il sera écrit.
 *
 * ## Ce qu'il ne couvre pas
 *
 * Il ne lit qu'un émetteur — la sonde e-mail — parce que c'est celui dont
 * l'écart a été mesuré. D'autres modules lèvent peut-être des codes hors
 * catalogue ; ce test ne le dit pas, et ne prétend pas le dire.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ALERTE_CATALOGUE } from "./catalogue";

const SONDE = "src/server/email/health.ts";

/**
 * Retire commentaires de bloc et de ligne.
 *
 * Sans ce filtre, la garde lirait les codes cités dans la prose explicative et
 * en exigerait la déclaration — une garde doit mesurer ce qui s'EXÉCUTE.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

/**
 * Extrait les codes réellement passés à `leverAlerte`.
 *
 * Deux formes coexistent dans la sonde : l'appel sur une ligne
 * (`leverAlerte("code", …)`) et l'appel réparti sur plusieurs lignes, où le
 * code est seul sur la sienne. Les deux sont couvertes — n'en couvrir qu'une
 * laisserait passer exactement la moitié des codes.
 */
function codesLeves(code: string): string[] {
  const trouves = new Set<string>();
  for (const m of code.matchAll(/leverAlerte\(\s*(?:\n\s*)?"([a-z_]+)"/g)) {
    trouves.add(m[1] as string);
  }
  return [...trouves].sort();
}

const source = readFileSync(join(process.cwd(), SONDE), "utf8");
const codes = codesLeves(sansCommentaires(source));

describe("la sonde de santé e-mail et le catalogue d'alertes", () => {
  it("🔑 la lecture de la sonde trouve bien des codes", () => {
    // Contre-témoin indispensable : si le motif cessait de mordre — appel
    // renommé, code passé par une variable — la boucle ci-dessous tournerait à
    // vide et ce fichier serait vert en ne mesurant rien. C'est exactement le
    // motif « un contrôle vert parce qu'il ne regarde rien ».
    expect(
      codes.length,
      `aucun appel à leverAlerte trouvé dans ${SONDE} : le motif de lecture ne mord plus`,
    ).toBeGreaterThanOrEqual(5);
  });

  it("🔴 chaque code levé est déclaré au catalogue", () => {
    const absents = codes.filter((c) => !(c in ALERTE_CATALOGUE));
    expect(
      absents,
      `la sonde lève ${absents.length} code(s) qu'aucune entrée du catalogue ne décrit : ` +
        `ils arriveront en console sans niveau, sans titre et sans guichet — donc sans ` +
        `personne à qui les adresser. Codes : ${absents.join(", ")}`,
    ).toEqual([]);
  });

  it("🔴 aucun ne se résout tout seul", () => {
    // Ces alertes naissent d'un cron distinct du balayage `evaluerAlertes`.
    // Les passer en `resolutionAuto: true` les ferait refermer au premier
    // `synchroniserAlertes` venu — avant que quiconque les ait lues, et alors
    // que le relais est peut-être toujours injoignable.
    for (const c of codes) {
      const entree = ALERTE_CATALOGUE[c];
      if (!entree) continue; // couvert par le test précédent
      expect(
        entree.resolutionAuto,
        `« ${c} » se résoudrait automatiquement : une panne d'envoi se referme ` +
          `après un envoi de contrôle, pas au passage suivant du balayage.`,
      ).toBe(false);
    }
  });

  it("🔑 CONTRE-TÉMOIN : le filtre de commentaires n'avale pas la sonde", () => {
    const filtre = sansCommentaires(source);
    expect(filtre.length).toBeGreaterThan(source.length / 3);
    expect(filtre).toContain("leverAlerte");
  });
});
