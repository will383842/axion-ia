/**
 * Qualiopi — Numérotation séquentielle unique des documents officiels.
 *
 * Format : `AXI-<TYPE>-YYYY-NNN` (NNN = compteur ≥ 3 chiffres, zero-padded),
 * suffixe `-R0N` pour les occurrences de sessions récurrentes (ex.
 * `AXI-SESS-2026-001-R01`). Séquence non modifiable, conservée 5 ans.
 *
 * Ce module ne porte que les **formats purs** (constantes + formatter + regex
 * de validation), testables sans DB. L'allocation atomique du prochain NNN
 * (table compteur transactionnelle) est livrée avec les modèles cœur (T2/T3),
 * pas en T0 — pour ne jamais avoir deux documents au même numéro.
 */

/** Préfixes de type de document (segment `<TYPE>`). */
export const NUMBERING_PREFIX = {
  formation: "AXI-FORM",
  session: "AXI-SESS",
  attestation: "AXI-ATT",
  certificat: "AXI-CERT",
  facture: "AXI-FACT",
  reclamation: "AXI-REC",
  client: "AXI-CLI",
  devis: "AXI-DEV",
  offre: "AXI-OFF",
  audit: "AXI-AUD",
  avoir: "AXI-AVO",
  // 🔴 V19 — série PROPRE au registre des pièces émises (`documents_generes`).
  // Sans elle, ce registre EMPRUNTAIT AXI-FORM / AXI-SESS / AXI-DEV aux tables
  // métier : `AXI-FORM-2026-001` désigne à la fois une formation du catalogue
  // et un livret d'accueil. Vérifié en production le 2026-07-26 : 7 numéros
  // dans ce cas. Voir DOCUMENT_REGISTER_TYPES plus bas et l'ADR 0035.
  document: "AXI-DOC",
  // Réservée à `coaching_contracts` (table vide à ce jour). Le schéma prescrivait
  // de « réutiliser le compteur formation » : un TROISIÈME écrivain sur AXI-FORM.
  // Dette éteinte avant d'avoir été matérialisée.
  coaching: "AXI-COACH",
} as const;

export type NumberingType = keyof typeof NUMBERING_PREFIX;

/** Largeur minimale du compteur (zero-pad). */
export const SEQ_PAD_WIDTH = 3 as const;

/**
 * Séries SANS millésime. `client` est la seule, et ce n'est pas un oubli :
 * `AXI-CLI-001` et `AXI-CLI-002` sont DÉJÀ émis en production sous ce format
 * (vérifié 2026-07-26 : ce sont les deux seules lignes de `clients`).
 * Les renuméroter casserait les références externes. On assume donc le format
 * et on l'inscrit dans le validateur, plutôt que de fabriquer en douce une
 * deuxième forme `AXI-CLI-2026-001` pour la même série.
 */
export const SERIES_WITHOUT_YEAR: ReadonlySet<NumberingType> = new Set<NumberingType>(["client"]);

/**
 * Construit un numéro de document officiel.
 *
 * @param type        type de document (clé de NUMBERING_PREFIX).
 * @param year        année (4 chiffres).
 * @param seq         compteur séquentiel >= 1.
 * @param recurrence  optionnel : n° d'occurrence d'une session récurrente >= 1
 *                    → suffixe `-R0N`.
 * @throws si année/seq/recurrence invalides.
 */
export function formatDocumentNumber(
  type: NumberingType,
  year: number,
  seq: number,
  recurrence?: number,
): string {
  // 🔴 Refuser plutôt que produire une variante silencieuse. Appelée avec
  // `client`, cette fonction rendait « AXI-CLI-2026-001 » : un SECOND format
  // pour une série qui en a déjà un en base, et que `isValidDocumentNumber`
  // rejette. C'est très exactement la dérive qu'aucun garde-fou ne voyait.
  // `formatSeriesNumber` connaît les deux formes — c'est lui qu'il faut appeler
  // quand le type n'est pas connu statiquement.
  if (SERIES_WITHOUT_YEAR.has(type)) {
    throw new Error(
      `formatDocumentNumber: la série « ${type} » est sans millésime — utiliser formatSeriesNumber`,
    );
  }
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error(`formatDocumentNumber: année invalide (${year})`);
  }
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`formatDocumentNumber: séquence invalide (${seq})`);
  }
  const base = `${NUMBERING_PREFIX[type]}-${year}-${String(seq).padStart(SEQ_PAD_WIDTH, "0")}`;
  if (recurrence === undefined) return base;
  if (!Number.isInteger(recurrence) || recurrence < 1) {
    throw new Error(`formatDocumentNumber: récurrence invalide (${recurrence})`);
  }
  return `${base}-R${String(recurrence).padStart(2, "0")}`;
}

/**
 * Regex de validation d'un numéro de document officiel (toutes séries).
 *
 * Deux branches, parce qu'il y a deux formats en production et pas un seul :
 * les séries millésimées `AXI-<TYPE>-YYYY-NNN` (+ suffixe `-R0N` pour les
 * occurrences de sessions récurrentes), et la série client `AXI-CLI-NNN`, sans
 * millésime. Avant ce correctif, la regex n'admettait que la première forme :
 * `isValidDocumentNumber("AXI-CLI-001")` rendait `false` sur les 2 clients
 * réellement en base. Un validateur qui rejette les données de production ne
 * valide rien.
 */
export const DOCUMENT_NUMBER_REGEX =
  /^AXI-(?:(?:FORM|SESS|ATT|CERT|FACT|REC|DEV|OFF|AUD|AVO|DOC|COACH)-\d{4}-\d{3,}(?:-R\d{2,})?|CLI-\d{3,})$/;

/** `true` si la chaîne est un numéro de document officiel bien formé. */
export function isValidDocumentNumber(value: string): boolean {
  return DOCUMENT_NUMBER_REGEX.test(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Registres — deux espaces de noms qui doivent rester DISJOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Séries qui identifient un OBJET MÉTIER : une table, un compteur. Le numéro
 * désigne la formation, la session, le devis, la facture elle-même.
 */
export const ENTITY_REGISTER_TYPES = [
  "formation",
  "session",
  "devis",
  "facture",
  "avoir",
  "client",
  "reclamation",
  "audit",
  // `offre` n'a AUCUN allocateur aujourd'hui : le préfixe est réservé, pas utilisé.
  "offre",
  // `coaching` : réservé à `coaching_contracts` (table vide).
  "coaching",
] as const satisfies readonly NumberingType[];

/**
 * Séries du registre des PIÈCES ÉMISES (`documents_generes`). Le numéro y
 * désigne le TIRAGE PDF, pas l'objet métier que la pièce décrit.
 *
 * 🔴 V19 — POURQUOI CETTE SÉPARATION EXISTE, et pourquoi il ne faut pas la
 * défaire. Jusqu'au 2026-07-26, `DOC_TYPE_TO_NUMBERING` projetait 12 types de
 * documents sur la série « formation » et 6 sur « session ». Le registre
 * documentaire frappait donc les MÊMES chaînes que les tables métier ; et comme
 * l'unicité de `numero` est déclarée table par table, Postgres ne peut pas
 * exprimer une unicité inter-tables — rien, ni au niveau code ni au niveau
 * base, n'empêchait la collision. Constat de production (SELECT du 2026-07-26) :
 * `AXI-FORM-2026-001` désigne à la fois la formation « IA Express » et un
 * livret d'accueil ; `AXI-SESS-2026-001` une session ET une feuille
 * d'émargement ; 7 numéros au total portent chacun deux pièces sans rapport.
 * À la demande d'audit « produisez la pièce AXI-FORM-2026-001 », le système
 * renvoie deux objets. Un registre dont la clé n'est pas discriminante est une
 * non-conformité de traçabilité à lui seul.
 *
 * L'intersection avec ENTITY_REGISTER_TYPES doit rester VIDE. C'est le test de
 * disjonction (formats.spec.ts) qui empêche la dérive de revenir — pas la
 * vigilance du prochain lecteur — et c'est le TYPE de `DOC_TYPE_TO_NUMBERING`
 * (documents-service.ts) qui empêche un remappage vers une série métier.
 */
export const DOCUMENT_REGISTER_TYPES = [
  "document",
  "attestation",
  "certificat",
] as const satisfies readonly NumberingType[];

// ─────────────────────────────────────────────────────────────────────────────
// Séries : préfixe, formatage, parsing inverse
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Préfixe complet d'une série : `AXI-FACT-2026-`, ou `AXI-CLI-` sans millésime.
 *
 * Une série n'est PAS identifiée par son préfixe seul mais par le couple
 * (PRÉFIXE, TABLE) : `AXI-FACT` et `AXI-AVO` cohabitent dans
 * `factures_formation`, et `documents_generes` porte ses propres séries. La
 * table est donc toujours fournie par l'appelant, jamais déduite d'ici.
 */
export function seriesPrefix(type: NumberingType, year: number | null): string {
  if (SERIES_WITHOUT_YEAR.has(type)) return `${NUMBERING_PREFIX[type]}-`;
  if (year === null) {
    throw new Error(`seriesPrefix: la série « ${type} » exige un millésime`);
  }
  return `${NUMBERING_PREFIX[type]}-${year}-`;
}

/**
 * Construit un numéro pour n'importe quelle série, millésimée ou non.
 * À préférer à `formatDocumentNumber`, qui refuse les séries sans millésime.
 */
export function formatSeriesNumber(
  type: NumberingType,
  year: number | null,
  seq: number,
  recurrence?: number,
): string {
  if (!SERIES_WITHOUT_YEAR.has(type)) {
    if (year === null) {
      throw new Error(`formatSeriesNumber: la série « ${type} » exige un millésime`);
    }
    return formatDocumentNumber(type, year, seq, recurrence);
  }
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`formatSeriesNumber: séquence invalide (${seq})`);
  }
  if (recurrence !== undefined) {
    throw new Error(`formatSeriesNumber: la série « ${type} » n'admet pas de récurrence`);
  }
  return `${NUMBERING_PREFIX[type]}-${String(seq).padStart(SEQ_PAD_WIDTH, "0")}`;
}

/**
 * Extrait le compteur d'un numéro appartenant à la série `prefixe`, ou `null`
 * si le numéro n'appartient pas à cette série.
 *
 * ⚠️ L'ANCRAGE `$` EST LA MOITIÉ UTILE DE CETTE FONCTION. C'est lui qui exclut
 * du dénominateur tout ce qui n'est pas une pièce de la série. Formes visées,
 * les unes constatées, les autres possibles par construction : les fixtures
 * `AXI-DEV-2026-DEMO-001` (seed de démo), les brouillons `BROUILLON-<uuid>`
 * posés dans `factures_formation` par le cron des plans récurrents (constatés
 * dans le code de `plan-recurrent.ts`), une éventuelle reprise d'historique
 * hors séquence, et une forme millésimée `AXI-CLI-2026-NNN` face au préfixe
 * `AXI-CLI-`. Ces deux dernières n'existent PAS en base aujourd'hui (SELECT du
 * 2026-07-26 : `factures_formation` est vide, `clients` ne contient que
 * `AXI-CLI-001` et `AXI-CLI-002`) — l'ancrage est un garde-fou, pas la
 * correction d'un désordre existant. Aucun `count()` ne faisait ce tri.
 *
 * Le suffixe de récurrence `-R0N` ne crée PAS d'entrée distincte : les N
 * occurrences d'une session récurrente partagent le numéro de base.
 */
export function parseSequence(numero: string, prefixe: string): number | null {
  if (!numero.startsWith(prefixe)) return null;
  const reste = numero.slice(prefixe.length);
  const groupes = /^(\d+)(?:-R\d+)?$/.exec(reste);
  const chiffres = groupes?.[1];
  if (chiffres === undefined) return null;
  const n = Number.parseInt(chiffres, 10);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}
