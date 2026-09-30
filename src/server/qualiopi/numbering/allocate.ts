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
 * ## Le registre des numéros émis — `numeros_emis` (2026-09-30)
 *
 * Le maximum des lignes PRÉSENTES ne suffisait pas : il recule dès que la
 * ligne qui le porte disparaît. C'est arrivé. Le 19/08/2026, les données de
 * deux actions ont été supprimées directement en base ; la série des factures
 * est repartie à 001 et `AXI-FACT-2026-001` a été émis une SECONDE fois le
 * 15/09. Aucun `@unique` ne pouvait le voir : la première ligne n'existait
 * plus.
 *
 * `nextNumero` lit donc DEUX sources et prend le maximum des deux :
 *
 *   - la table métier, par le lecteur fourni (inchangé) ;
 *   - le registre append-only `numeros_emis`, sur le même préfixe.
 *
 * Le registre n'est écrit par AUCUN code applicatif — les 18 sites d'appel
 * n'ont pas bougé. Il est alimenté par un DÉCLENCHEUR `AFTER INSERT OR UPDATE
 * OF numero` posé sur chaque table porteuse (migration
 * `20260930120000_numeros_emis_registre`), donc dans la MÊME transaction que
 * la ligne métier, quel que soit l'écrivain : app, worker, script, psql. La
 * base y refuse UPDATE, DELETE et TRUNCATE. Supprimer une facture ne libère
 * plus son numéro.
 *
 * La liste des tables porteuses est DÉRIVÉE des sites d'appel par
 * `tests/unit/ci/tout-allocateur-alimente-le-registre-des-numeros.spec.ts` :
 * un nouvel allocateur sur une nouvelle table rougit tant qu'une migration ne
 * lui a pas posé son déclencheur.
 *
 * ### Le registre est lu par PRÉFIXE, sans filtre de table
 *
 * Un numéro émis par une table ne se réemploie dans AUCUNE autre : c'est
 * l'unicité inter-tables que les `@unique` déclarés table par table ne savent
 * pas exprimer — pour tout numéro émis à partir de la migration. Les 7
 * collisions héritées (ADR 0035 §4) restent en base, le registre ne les
 * efface pas ; leur préfixe est déjà lu en croisé par les allocateurs
 * concernés (`formations/numbering.ts`), et d'après le relevé de l'ADR 0035
 * (formations à -057 contre -003 côté documents, devis ≥ -002 contre -002)
 * aucun numéro hérité n'y dépasse la borne de sa série : le registre ne
 * devrait pas créer de saut. À revérifier en base si le relevé a vieilli.
 *
 * ### Pourquoi par le client global, hors transaction
 *
 * Plusieurs appelants lisent leur série dans une transaction interactive
 * (`audit-missions`, `porte-client`, `formations/numbering` avec `tx`). Le
 * registre, lui, est lu par `prisma` global, jamais par ce `tx` : une erreur
 * Postgres (table absente) ANNULERAIT la transaction de l'appelant — on
 * perdrait la création au lieu de retomber sur l'ancien calcul.
 *
 * ### Repli : la fenêtre où la table n'existe pas encore
 *
 * Le worker exécute le code neuf ~50 min avant que l'app ne migre, et
 * l'entrypoint migre en best-effort. Tant que `numeros_emis` n'existe pas, la
 * lecture échoue en P2021 : `nextNumero` retombe sur la seule table métier
 * (comportement antérieur) et le signale UNE fois par processus. Toute autre
 * erreur du registre produit le même repli, signalé en erreur à chaque fois.
 * Une facturation ne se bloque JAMAIS sur le registre. Une erreur de la table
 * métier, elle, remonte comme avant.
 *
 * ### Ce qui reste hors de portée
 *
 * La course concurrente reste fermée par l'index unique de chaque table et la
 * reprise P2002 de l'appelant, pas par le registre (il n'est pas réservé
 * AVANT l'insertion : ce serait écrire depuis les 18 sites). Et le doublon
 * `AXI-FACT-2026-001` déjà émis n'est pas « réparé » ici : c'est une
 * régularisation comptable qui appartient au dirigeant.
 */

import { prisma } from "@/lib/prisma";
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
  // Les deux lectures partent ensemble ; seule celle de la table métier peut
  // faire échouer l'allocation (`lireRegistre` ne rejette jamais).
  const [lignesMetier, lignesRegistre] = await Promise.all([
    lireSerie(prefixe),
    lireRegistre(prefixe),
  ]);
  const lignes = [...lignesMetier, ...lignesRegistre];

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

// ─────────────────────────────────────────────────────────────────────────────
// Registre des numéros émis
// ─────────────────────────────────────────────────────────────────────────────

let registreAbsentSignale = false;

/** Pour les specs : le signalement « une fois par processus » repart de zéro. */
export function __reinitialiserAvertissementRegistre(): void {
  registreAbsentSignale = false;
}

function estTableAbsente(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2021";
}

/**
 * Numéros du registre `numeros_emis` pour le préfixe donné — ou `[]`, sans
 * jamais rejeter, si le registre est illisible (cf. « Repli » en tête).
 *
 * Le Proxy de build (`src/lib/prisma.ts`, `stub.invalid`) rend `[]` pour tout
 * `findMany` : aucun appel réseau au build GitHub Actions.
 */
async function lireRegistre(prefixe: string): Promise<ReadonlyArray<{ numero: string }>> {
  try {
    return await prisma.numeroEmis.findMany({
      where: { numero: { startsWith: prefixe } },
      select: { numero: true },
    });
  } catch (err) {
    if (estTableAbsente(err)) {
      if (!registreAbsentSignale) {
        registreAbsentSignale = true;
        console.warn(
          "[numbering] table numeros_emis absente (migration pas encore passée ?) — " +
            "borne calculée sur la seule table métier, comme avant le registre.",
        );
      }
    } else {
      console.error(
        "[numbering] lecture du registre numeros_emis impossible — " +
          "borne calculée sur la seule table métier.",
        err,
      );
    }
    return [];
  }
}
