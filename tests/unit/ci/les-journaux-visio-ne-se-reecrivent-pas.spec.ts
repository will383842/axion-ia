/**
 * ⛔ LES CINQ JOURNAUX DU CHANTIER VISIO NE SE RÉÉCRIVENT PAS, ET LE JOURNAL
 * D'EFFACEMENT NE NOMME QUE DES CIBLES CONNUES (chantier visio, PR 2).
 *
 * Deux choses, qui se tiennent :
 *
 *   1. Aucun code de `src/` ni de `scripts/` ne MODIFIE ni ne SUPPRIME une
 *      ligne de `fait_evenements`, `projet_evenements`,
 *      `rencontre_rattachement_evenements`, `effacements_journal` ou
 *      `client_fusion_elements`. Le trigger `visio_journal_ajout_seul` le
 *      refuse en base, sans exception (pas même sous le drapeau d'effacement
 *      RGPD, Gate D cas 18) ; cette garde le dit AVANT la base : un appel
 *      `updateMany` sur un journal est une erreur de conception, pas un cas à
 *      découvrir en production.
 *
 *   2. `effacements_journal.table_cible` est l'énumération `CibleEffacement`.
 *      Le journal est rejoué après une restauration : une cible fausse ferait
 *      passer le rejeu à côté des lignes, sans erreur, et la personne effacée
 *      réapparaîtrait. Le typage de `journaliserEffacements` refuse déjà une
 *      chaîne hors liste (Gate A) ; cette garde vérifie en plus que CHAQUE
 *      valeur de l'énumération a un écrivain, et chaque écrivain une valeur —
 *      une cible déclarée que personne n'écrit est un rejeu qui ne sert à rien,
 *      ou un écrivain oublié.
 *
 * Contre-témoins : les motifs reconnaissent un appel fautif fictif, et la
 * lecture du schéma trouve bien l'énumération.
 *
 * Mutation qui fait rougir : écrire `journaliserEffacements(tx, "faits.citation", …)`
 * dans `src/lib/rgpd-erase.ts` → la cible n'est pas dans l'énumération → rouge
 * (et Gate A aussi).
 */

import { describe, expect, it } from "vitest";
import { lire, sansCommentaires, sourcesSous } from "./sources-du-circuit-visio";

const MODELES_JOURNAUX = [
  "faitEvenement",
  "projetEvenement",
  "rencontreRattachementEvenement",
  "effacementJournal",
  "clientFusionElement",
] as const;

/** `x.faitEvenement.updateMany(` et consorts : toute écriture autre qu'un ajout. */
const REECRITURE_D_UN_JOURNAL = new RegExp(
  `\\.(${MODELES_JOURNAUX.join("|")})\\s*\\.\\s*(update|updateMany|upsert|delete|deleteMany)\\s*\\(`,
);

/** SQL brut qui viserait un journal par son nom de table. */
const REECRITURE_SQL_D_UN_JOURNAL =
  /\b(UPDATE|DELETE\s+FROM)\s+"?(fait_evenements|projet_evenements|rencontre_rattachement_evenements|effacements_journal|client_fusion_elements)\b/i;

const ECRIVAIN = "src/lib/rgpd-erase.ts";

function valeursDeCibleEffacement(): string[] {
  const schema = lire("prisma/schema.prisma");
  const bloc = /\benum CibleEffacement\s*\{([\s\S]*?)\}/.exec(schema)?.[1];
  if (!bloc) throw new Error("enum CibleEffacement introuvable dans prisma/schema.prisma");
  return bloc
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"));
}

/** Premier argument littéral après `tx` : `journaliserEffacements(tx, "faits", …)`. */
function ciblesEcrites(code: string): string[] {
  return [...code.matchAll(/journaliserEffacements\(\s*tx\s*,\s*"([^"]+)"/g)].map((m) => m[1]!);
}

describe("les journaux du chantier visio ne se réécrivent pas", () => {
  it("contre-témoin : les motifs reconnaissent une réécriture", () => {
    expect(REECRITURE_D_UN_JOURNAL.test(`await tx.effacementJournal.deleteMany({})`)).toBe(true);
    expect(REECRITURE_D_UN_JOURNAL.test(`tx.projetEvenement.updateMany({ data })`)).toBe(true);
    expect(REECRITURE_D_UN_JOURNAL.test(`tx.projetEvenement.createMany({ data })`)).toBe(false);
    expect(REECRITURE_SQL_D_UN_JOURNAL.test(`UPDATE projet_evenements SET motif = NULL`)).toBe(
      true,
    );
    expect(REECRITURE_SQL_D_UN_JOURNAL.test(`DELETE FROM "effacements_journal"`)).toBe(true);
    expect(REECRITURE_SQL_D_UN_JOURNAL.test(`INSERT INTO effacements_journal`)).toBe(false);
  });

  it("aucun fichier de src/ ni de scripts/ ne modifie ou ne supprime une ligne de journal", () => {
    const fautifs = sourcesSous(["src", "scripts"]).filter((f) => {
      const code = sansCommentaires(lire(f));
      return REECRITURE_D_UN_JOURNAL.test(code) || REECRITURE_SQL_D_UN_JOURNAL.test(code);
    });
    expect(
      fautifs,
      "ces fichiers réécrivent un journal en ajout seul (le trigger le refusera en base) :",
    ).toEqual([]);
  });
});

describe("le journal d'effacement ne nomme que des cibles connues", () => {
  it("contre-témoin : l'énumération est lue et l'écrivain y écrit", () => {
    expect(valeursDeCibleEffacement()).toContain("faits");
    expect(ciblesEcrites(lire(ECRIVAIN)).length).toBeGreaterThan(0);
  });

  it("chaque cible écrite est une valeur de CibleEffacement", () => {
    const valeurs = new Set(valeursDeCibleEffacement());
    const inconnues = ciblesEcrites(sansCommentaires(lire(ECRIVAIN))).filter(
      (c) => !valeurs.has(c),
    );
    expect(inconnues, "cibles absentes de enum CibleEffacement :").toEqual([]);
  });

  it("chaque valeur de CibleEffacement a un écrivain", () => {
    const ecrites = new Set(ciblesEcrites(sansCommentaires(lire(ECRIVAIN))));
    const orphelines = valeursDeCibleEffacement().filter((v) => !ecrites.has(v));
    expect(orphelines, "valeurs de CibleEffacement que rien n'écrit :").toEqual([]);
  });

  it("personne d'autre n'écrit dans le journal d'effacement", () => {
    const autres = sourcesSous(["src", "scripts"]).filter(
      (f) => f !== ECRIVAIN && /\.effacementJournal\s*\.\s*create/.test(sansCommentaires(lire(f))),
    );
    expect(autres, "écrivent effacements_journal hors de src/lib/rgpd-erase.ts :").toEqual([]);
  });
});
