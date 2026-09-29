// @vitest-environment node

/**
 * Verrou — le jour où la parole des rendez-vous part chez OpenAI, aucune page
 * publique ne doit encore promettre « aucune donnée personnelle n'est
 * transmise aux modèles d'IA » (chantier visio, PR 8 ; inventaire 05, G2).
 *
 * ## Ce qu'il ferme
 *
 * Trois fichiers portaient cette promesse, sous sept formes :
 * `src/content/legal.ts` (hébergement, IA générative), la page
 * `/sous-processeurs` (FAQ, « En bref ») et la page `/transparence` (carte
 * « Sous-processeurs IA », carte « Vos droits », FAQ « Mes données vont-elles
 * dans un LLM ? »). Vraie pour l'éditorial, elle devient FAUSSE pour les
 * comptes rendus de rendez-vous.
 *
 * ## Comment
 *
 * 1. **Les trois fichiers ne portent plus AUCUNE de ces phrases en dur** : elles
 *    vivent toutes dans `src/content/visio-annonce.ts`, avant et après, et
 *    basculent sur un seul interrupteur. Une promesse réécrite en dur dans une
 *    page échapperait à la bascule : c'est ce que le premier test refuse.
 * 2. **Le texte « après » ne contient aucune promesse nue** : une phrase qui
 *    dit « aucune donnée personnelle » doit dire aussi de QUOI elle parle
 *    (« éditoriaux » / « editorial »).
 *
 * Contre-témoin : le texte « avant » (celui d'aujourd'hui) contient bien des
 * promesses nues — sans quoi la garde ne mesurerait rien. Angle mort : une
 * promesse formulée autrement que par les motifs ci-dessous passe ; la liste
 * vient des formules RÉELLEMENT publiées le 2026-09-29.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LEGAL_PAGES } from "../legal";
import { ANNONCE_VISIO_ACTIVE, complementsNotice, textesPagesIa } from "../visio-annonce";

const FICHIERS = [
  "src/content/legal.ts",
  "src/app/[locale]/sous-processeurs/page.tsx",
  "src/app/[locale]/transparence/page.tsx",
] as const;

/** Les formules de la promesse, telles qu'elles étaient publiées. */
const PROMESSE =
  /aucune donnée personnelle (de visiteur|client)|jamais de (pii visiteur|données client)|no (visitor|client) personal data|never (visitor pii|client data)|never any client data|aucune donnée client/i;

/** La précision qui rend la phrase vraie : elle parle de l'éditorial. */
const PRECISION = /éditoria|editorial/i;

function phrases(texte: string): string[] {
  return texte.split(/(?<=[.;:])\s+/);
}

function promessesNues(texte: string): string[] {
  return phrases(texte).filter((p) => PROMESSE.test(p) && !PRECISION.test(p));
}

function tousLesTextes(actif: boolean): string {
  return [
    ...(["fr", "en"] as const).flatMap((l) => Object.values(textesPagesIa(l, actif))),
    ...(["fr", "en"] as const).flatMap((l) => Object.values(complementsNotice(l, actif))),
  ].join("\n");
}

describe("aucune page ne promet l'absence d'IA quand la parole part chez OpenAI", () => {
  for (const fichier of FICHIERS) {
    it(`🔴 ${fichier} ne porte plus la promesse en dur`, () => {
      const source = readFileSync(join(process.cwd(), fichier), "utf8");
      const trouvees = promessesNues(source);
      expect(
        trouvees,
        "une promesse « aucune donnée personnelle… » est écrite en dur : elle ne basculera pas " +
          "avec l'annonce de l'enregistrement. La déplacer dans src/content/visio-annonce.ts.",
      ).toEqual([]);
    });
  }

  it("🔴 le texte « après » ne contient aucune promesse sans la précision « éditorial »", () => {
    expect(promessesNues(tousLesTextes(true))).toEqual([]);
  });

  it("🔴 la politique publiée ne promet rien de nu quand l'annonce est active", () => {
    const prose = JSON.stringify(LEGAL_PAGES);
    if (ANNONCE_VISIO_ACTIVE) {
      expect(promessesNues(prose)).toEqual([]);
    } else {
      // Tant que rien n'est enregistré, la promesse d'aujourd'hui est vraie :
      // elle doit être publiée, sinon la bascule ne remplacerait rien.
      expect(promessesNues(prose).length).toBeGreaterThan(0);
    }
  });

  it("🔑 CONTRE-TÉMOIN : le texte « avant » contient bien des promesses nues", () => {
    expect(promessesNues(tousLesTextes(false)).length).toBeGreaterThanOrEqual(7);
  });
});
