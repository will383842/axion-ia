/**
 * Qualiopi — Allocation d'un numéro de pièce : BORNE HAUTE, jamais cardinalité.
 *
 * ## Le piège que ce module remplace
 *
 * Dix-huit allocateurs faisaient `count(*) + 1`. Cela ne rend le bon numéro que
 * si TROIS invariants tiennent simultanément : la série est dense (aucun trou),
 * elle démarre à 1, et l'ensemble compté est EXACTEMENT la série. Aucun des
 * trois n'était garanti, et les trois étaient déjà violés en pratique :
 *
 *   - un trou (pièce purgée, création annulée) faisait RECULER le compteur et
 *     réattribuait un numéro déjà émis — interdit par l'art. 242 nonies A ann. II
 *     du CGI, qui exige une séquence chronologique continue et sans réemploi ;
 *   - pire, la reprise sur collision était un PLACEBO. `withNumberRetry` et les
 *     boucles `for attempt` relancent la même closure, donc le même `count()`,
 *     donc le MÊME numéro : cinq tentatives identiques, puis échec dur. La
 *     conséquence n'était pas un doublon, c'était un VERROU PERMANENT sur la
 *     création — déjà atteignable via le cycle seed-demo / purge-demo ;
 *   - les lignes hors-série étaient comptées comme des pièces : fixtures
 *     `-DEMO-`, brouillons `BROUILLON-<uuid>` posés dans `factures_formation`
 *     par le cron des plans récurrents, et — cas le plus grave — les AVOIRS
 *     `AXI-AVO-*`, qui vivent dans la même table que les factures et faisaient
 *     sauter un numéro de la série légale à chaque émission.
 *
 * `nextNumero` lit MAX(séquence) sur les seules lignes qui appartiennent
 * réellement à la série. Un numéro émis n'est jamais réattribué, et la reprise
 * sur P2002 CONVERGE : le maximum progresse dès qu'une insertion concurrente a
 * abouti, contrairement au `count()` sous trou.
 *
 * ## Pourquoi l'appelant fournit lui-même le lecteur
 *
 * Une série n'est PAS identifiée par son préfixe seul, mais par le couple
 * (PRÉFIXE, TABLE). `AXI-FACT` et `AXI-AVO` cohabitent dans `factures_formation`
 * — deux séries, une table — et `documents_generes` porte ses propres séries.
 * Une table déduite du type serait fausse par construction : c'est exactement
 * l'erreur qui, avant le correctif V19, faisait frapper `AXI-FORM-2026-001` par
 * deux registres indépendants. L'appelant écrit donc la table à la main : elle
 * est lisible sur place et le typage Prisma la vérifie.
 *
 * ## Pourquoi un `findMany` et pas un `MAX()` SQL
 *
 * Parce que le parsing d'une séquence doit avoir UNE SEULE implémentation. Une
 * version antérieure de ce correctif portait deux règles — une regex JS ancrée
 * en fin, un `substring()` SQL sans ancrage — qui ne concordaient pas, et c'est
 * la SQL, non testée, qui s'exécutait. Ici la règle est `parseSequence` : pure,
 * unique, testée, et c'est elle qui tourne. Trois bénéfices de bord :
 * `$queryRawUnsafe` n'est PAS intercepté par le Proxy stub de `src/lib/prisma.ts`
 * (le build GitHub Actions serait parti chercher un Postgres inexistant), aucun
 * nom de table n'est interpolé dans du SQL, et les specs continuent de mocker le
 * modèle Prisma comme avant. Coût : quelques dizaines de lignes lues par série
 * et par an, sur une colonne indexée.
 *
 * ## Ce que ce module NE fait PAS
 *
 * Il ne prend aucun verrou consultatif. C'est délibéré. Le défaut corrigé n'est
 * pas une course mais une régression du compteur, et le maximum seul la ferme.
 * Un `pg_advisory_xact_lock` obligerait à envelopper le rendu PDF dans la
 * transaction sur trois sites (documents-service, facturation-service,
 * facturation-1to1) : plusieurs centaines de millisecondes sous verrou,
 * sérialisation de toute la génération documentaire, épuisement du pool sous le
 * cron des plans récurrents. La sérialisation reste donc assurée par l'index
 * unique + la reprise P2002 de l'appelant, qui converge désormais.
 *
 * La garantie forte — un registre `numero_registre(numero UNIQUE, serie,
 * entite_id)` alimenté dans la MÊME transaction par TOUS les allocateurs — est
 * la seule construction qui fermerait à la fois la course concurrente et
 * l'unicité inter-tables (que Postgres ne peut pas exprimer avec des `@unique`
 * déclarés table par table). Chantier distinct, à ne pas simuler ici.
 */

import {
  formatSeriesNumber,
  parseSequence,
  seriesPrefix,
  type NumberingType,
} from "@/server/qualiopi/numbering/formats";

/**
 * Lit les numéros DÉJÀ ÉMIS de la série dont le préfixe est fourni.
 *
 * Implémentation attendue chez l'appelant, en une ligne :
 *
 * ```ts
 * (prefixe) => prisma.<table>.findMany({
 *   where: { numero: { startsWith: prefixe } },
 *   select: { numero: true },
 * })
 * ```
 *
 * Ne PAS y ajouter de filtre supplémentaire (date, statut, activité…) : le
 * préfixe EST la définition de la série, et tout filtre en plus recrée la
 * divergence de dénominateur entre allocateurs d'une même série.
 */
export type LecteurSerie = (prefixe: string) => Promise<ReadonlyArray<{ numero: string | null }>>;

/**
 * Prochain numéro libre de la série : borne haute + 1.
 *
 * @param type       série, au sens de `NUMBERING_PREFIX`.
 * @param year       millésime, ou `null` pour les séries sans millésime (client).
 * @param lireSerie  lecteur de LA table qui porte cette série.
 * @param recurrence occurrence d'une session récurrente (suffixe `-R0N`).
 */
export async function nextNumero(
  type: NumberingType,
  year: number | null,
  lireSerie: LecteurSerie,
  recurrence?: number,
): Promise<string> {
  const prefixe = seriesPrefix(type, year);
  const lignes = await lireSerie(prefixe);

  // ⚠️ La borne est calculée NUMÉRIQUEMENT. Un MAX lexicographique serait faux
  // dès le millième document : « AXI-FACT-2026-999 » > « AXI-FACT-2026-1000 »
  // en tri texte, le zero-padding n'étant garanti qu'à 3 chiffres
  // (SEQ_PAD_WIDTH). C'est le piège dans lequel tomberait quiconque recopierait
  // tel quel le patron de `src/lib/invoice-numbering.ts`, qui s'en sort
  // seulement parce qu'il pad à 4 et plafonne à 9999 par an.
  //
  // `parseSequence` écarte au passage tout ce qui n'appartient pas à la série :
  // fixtures DEMO, brouillons, reprises d'historique, format legacy.
  let borne = 0;
  for (const ligne of lignes) {
    if (ligne.numero == null) continue;
    const seq = parseSequence(ligne.numero, prefixe);
    if (seq !== null && seq > borne) borne = seq;
  }

  return formatSeriesNumber(type, year, borne + 1, recurrence);
}
