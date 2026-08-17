/**
 * Qualiopi — Service Évaluations des acquis (AGENT A — T9).
 *
 * createEvaluation       : vérifie la cohérence de la date avec le calendrier de
 *                          la session, calcule score/niveau/réussite via
 *                          scoring.ts, insère EvaluationAcquis, retourne { id }.
 * incoherenceDateEvaluation : règle PURE de chronologie (indicateur 4).
 * listEvaluationsForEnrollment : liste toutes les évaluations d'une inscription.
 * getFinaleReussite      : retourne le résultat de l'évaluation finale la plus
 *                          récente (null si aucune).
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", toutes les mutations
 * lèvent et les lectures retournent des valeurs vides (safe au build SSG).
 */

import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { computeEvaluationScore, niveauFromScore, reussiteFromScore } from "./scoring";
import type { EvaluationAcquis } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types internes
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateEvaluationInput {
  enrollmentId: string;
  type: "initiale" | "intermediaire" | "finale";
  dateEvaluation: string;
  competences: Array<{
    libelle: string;
    note?: 1 | 2 | 3;
    observations?: string;
    objectifRef?: string;
  }>;
  recommandations?: string;
  /**
   * Auteur de l'évaluation (`AdminUser.id`).
   *
   * Colonne restée MORTE jusqu'ici : jamais écrite, jamais lue. Sans elle, rien
   * ne permet de démontrer QUI a évalué — anodin avec un formateur unique,
   * critique dès que plusieurs intervenants coexistent. Renseignée par l'action
   * serveur à partir de la session admin ; optionnelle pour ne pas casser les
   * appelants existants (imports, seeds).
   */
  evalueParId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cohérence chronologique — indicateur 4 (non graduable)
// ─────────────────────────────────────────────────────────────────────────────

/** Début de la journée civile UTC, en millisecondes — convention du dépôt. */
export function jourUtc(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** JJ/MM/AAAA en UTC — indépendant de la locale du serveur. */
export function formaterJourUtc(d: Date): string {
  const jour = String(d.getUTCDate()).padStart(2, "0");
  const mois = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${jour}/${mois}/${d.getUTCFullYear()}`;
}

/**
 * Message d'erreur si la date d'une évaluation contredit le calendrier de la
 * session, `null` si elle est cohérente. Fonction PURE : c'est elle qui porte
 * la règle, `createEvaluation` ne fait que l'appliquer.
 *
 * 🔴 Audit blanc de certification 2026-08-15 — non-conformité MAJEURE.
 *
 * Le dossier unique de l'organisme portait une évaluation « initiale (avant
 * formation) » datée du 04/08/2026 pour une session tenue et clôturée le
 * 31/07/2026, affichée juste sous l'évaluation « finale » du 31/07. Sur une
 * seule capture d'écran, l'auditeur lisait un « avant formation » daté APRÈS
 * l'« après formation ». L'indicateur 4 n'est pas graduable : c'est bloquant.
 *
 * Rien ne l'empêchait : le schéma Zod de l'action serveur ne demandait qu'une
 * chaîne non vide, et le service persistait `new Date(...)` sans jamais la
 * confronter à `session.dateDebut`.
 *
 * ⚠️ Comparaison à la JOURNÉE civile, jamais à la milliseconde : une
 * évaluation saisie le matin même du premier jour est parfaitement légitime —
 * c'est le cas NOMINAL du positionnement d'entrée. Seule l'inversion de l'ordre
 * des jours est refusée. Une garde plus stricte que le métier ferait refuser la
 * saisie honnête, et apprendrait à contourner la garde.
 */
export function incoherenceDateEvaluation(params: {
  type: CreateEvaluationInput["type"];
  dateEvaluation: Date;
  dateDebutSession: Date;
}): string | null {
  const { type, dateEvaluation, dateDebutSession } = params;

  if (Number.isNaN(dateEvaluation.getTime())) {
    return "La date d'évaluation est invalide.";
  }
  if (Number.isNaN(dateDebutSession.getTime())) {
    return "La date de début de la session est invalide : la cohérence de l'évaluation ne peut pas être vérifiée.";
  }

  const jourEvaluation = jourUtc(dateEvaluation);
  const jourDebut = jourUtc(dateDebutSession);
  const debutLisible = formaterJourUtc(dateDebutSession);
  const evaluationLisible = formaterJourUtc(dateEvaluation);

  if (type === "initiale") {
    if (jourEvaluation > jourDebut) {
      return (
        `Une évaluation initiale ne peut pas être datée après le début de la session du ${debutLisible} ` +
        `(date saisie : ${evaluationLisible}). Une évaluation « avant formation » postérieure à la ` +
        `formation n'est pas une preuve recevable : corrigez la date, ou enregistrez cette évaluation ` +
        `comme intermédiaire ou finale.`
      );
    }
    return null;
  }

  // Symétrique, et pour l'intermédiaire aussi : « en cours de formation » et
  // « après formation » sont l'un comme l'autre impossibles avant le premier
  // jour. Une garde qui ne couvrirait que la finale laisserait le même dossier
  // incohérent se reconstituer d'un cran à côté.
  if (jourEvaluation < jourDebut) {
    const libelle = type === "finale" ? "finale" : "intermédiaire";
    return (
      `Une évaluation ${libelle} ne peut pas être datée avant le début de la session du ${debutLisible} ` +
      `(date saisie : ${evaluationLisible}). Corrigez la date, ou enregistrez cette évaluation comme initiale.`
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// createEvaluation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée une évaluation des acquis.
 *
 * 1. Vérifie la cohérence de `dateEvaluation` avec `session.dateDebut`.
 * 2. Calcule score/niveau/réussite via scoring.ts (fonctions pures).
 * 3. Lit le seuil de réussite depuis la config Qualiopi.
 * 4. Insère `EvaluationAcquis` en DB.
 * 5. Retourne `{ id }`.
 *
 * Lève une erreur en français, lisible telle quelle par l'admin : l'action
 * serveur (`createEvaluationAcquisAction`) remonte `err.message` dans
 * `{ error }`, donc le texte ci-dessous s'affiche directement dans la console.
 *
 * Stub-aware : lève si DATABASE_URL contient "stub.invalid" (pas de mutation au build).
 */
export async function createEvaluation(input: CreateEvaluationInput): Promise<{ id: string }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("createEvaluation: stub DB — non disponible au build");
  }

  // ── Garde chronologique (indicateur 4) ──────────────────────────────────────
  //
  // Lecture AVANT tout calcul : rien ne doit être écrit si la date contredit le
  // calendrier de la session. C'est le point de passage OBLIGÉ des deux chemins
  // de création (saisie humaine par l'action serveur, transcription automatique
  // du questionnaire de positionnement) — la garde tient donc les deux.
  const dateEvaluation = new Date(input.dateEvaluation);

  const inscription = await prisma.enrollment.findUnique({
    where: { id: input.enrollmentId },
    select: { session: { select: { dateDebut: true } } },
  });
  if (inscription === null) {
    throw new Error(
      "Inscription introuvable : la cohérence de la date d'évaluation ne peut pas être vérifiée.",
    );
  }

  const dateDebutSession = inscription.session?.dateDebut;
  if (!(dateDebutSession instanceof Date)) {
    throw new Error(
      "Session de l'inscription illisible : la cohérence de la date d'évaluation ne peut pas être vérifiée.",
    );
  }

  const incoherence = incoherenceDateEvaluation({
    type: input.type,
    dateEvaluation,
    dateDebutSession,
  });
  if (incoherence !== null) {
    throw new Error(incoherence);
  }

  const seuilReussitePct = await getQualiopiConfig("seuil_reussite_pct");

  const { scoreObtenu, scoreMax, scorePct } = computeEvaluationScore(input.competences);
  const niveauGlobal = niveauFromScore(scorePct);

  // 🔴 Une évaluation d'ENTRÉE ne « réussit » pas.
  //
  // Le dossier audité affichait « Réussite : Oui » sur un positionnement
  // d'entrée : le stagiaire y déclarait ses niveaux de DÉPART, et le système en
  // tirait un verdict de réussite parce que la moyenne dépassait le seuil.
  // Réussir avant d'avoir été formé ne veut rien dire, et affiché à côté de la
  // finale ça donne à lire un parcours qui n'a rien appris à personne.
  //
  // La colonne `reussite` est NOT NULL avec `@default(false)` : `false` est donc
  // le seul « non renseigné » disponible ici. Le score et le niveau, eux, restent
  // écrits — ils portent le niveau d'entrée, qui est précisément la preuve
  // attendue à l'indicateur 4.
  const reussite =
    input.type === "initiale" ? false : reussiteFromScore(scorePct, seuilReussitePct);

  const created = await prisma.evaluationAcquis.create({
    data: {
      enrollmentId: input.enrollmentId,
      type: input.type,
      dateEvaluation,
      scoreObtenu,
      scoreMax,
      scorePct,
      niveauGlobal,
      reussite,
      competences: input.competences as never,
      ...(input.recommandations !== undefined ? { recommandations: input.recommandations } : {}),
      ...(input.evalueParId !== undefined ? { evalueParId: input.evalueParId } : {}),
    },
    select: { id: true },
  });

  return { id: created.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// listEvaluationsForEnrollment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne toutes les évaluations d'une inscription, triées par date décroissante.
 */
export async function listEvaluationsForEnrollment(
  enrollmentId: string,
): Promise<EvaluationAcquis[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return [];
  }
  return prisma.evaluationAcquis.findMany({
    where: { enrollmentId },
    orderBy: { dateEvaluation: "desc" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// getFinaleReussite
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Résultats détaillés de l'évaluation finale, objectif par objectif.
 *
 * 🔴 Audit certification 2026-07-26 (F21). `getFinaleReussite` ne remontait
 * qu'un booléen, et l'attestation imprimait donc sous « Compétences acquises »
 * la liste COMPLÈTE des objectifs du catalogue — un stagiaire noté « non
 * acquis » sur trois objectifs sur cinq était attesté sur les cinq. L'article
 * L6353-1 exige les RÉSULTATS de l'évaluation des acquis, pas le programme.
 *
 * On remonte donc le détail, et c'est à l'appelant de ne pas le recopier.
 */
export interface ResultatsFinale {
  reussite: boolean;
  scorePct: number;
  niveauGlobal: string;
  /** Libellés répartis par note. Une compétence non notée n'est dans aucune. */
  acquis: string[];
  partiels: string[];
  nonAcquis: string[];
  /** Compétences attendues mais laissées sans note — à signaler, jamais à taire. */
  nonEvalues: string[];
}

/** Forme d'une compétence telle que stockée dans la colonne Json `competences`. */
interface CompetenceStockee {
  libelle?: unknown;
  note?: unknown;
}

/**
 * Retourne le détail de l'évaluation finale la plus récente, ou `null`.
 *
 * `competences` est une colonne `Json` : son contenu n'est pas garanti par le
 * typage. On la lit défensivement — un libellé manquant est ignoré plutôt que
 * de faire échouer la génération de l'attestation.
 */
export async function getFinaleResultats(enrollmentId: string): Promise<ResultatsFinale | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return null;
  }
  const finale = await prisma.evaluationAcquis.findFirst({
    where: { enrollmentId, type: "finale" },
    orderBy: { dateEvaluation: "desc" },
    select: {
      reussite: true,
      scorePct: true,
      niveauGlobal: true,
      competences: true,
    },
  });
  if (finale === null) return null;

  return repartirCompetences(finale);
}

/**
 * Vrai si l'évaluation ne comporte AUCUNE compétence notée.
 *
 * 🔴 Vérification E2E 2026-07-26. F22 avait sorti les compétences non notées du
 * calcul, mais la conséquence n'était pas propagée : une évaluation enregistrée
 * avec toutes les cases vides donne `scoreMax = 0`, donc `scorePct = 0`, donc
 * `reussite = false` — et ces trois valeurs sont PERSISTÉES. L'attestation
 * imprimait alors « Non validée — score 0 % », c'est-à-dire exactement le faux
 * échec que F22 prétendait fermer, un étage plus haut.
 *
 * Un commentaire de test affirmait même le contraire (« l'attestation porte
 * alors "Évaluation des acquis non réalisée" ») : c'était faux, cette branche
 * n'était atteinte que sans AUCUNE ligne en base.
 */
export function evaluationSansAucuneNote(r: ResultatsFinale): boolean {
  return r.acquis.length === 0 && r.partiels.length === 0 && r.nonAcquis.length === 0;
}

/**
 * Répartit les compétences d'une évaluation par note. Partagé entre la voie
 * collective et la voie AFEST 1-to-1.
 *
 * 🔴 Ce partage n'est pas une commodité : c'est la garantie que les deux
 * familles d'attestation restituent les résultats de la MÊME façon. Mon premier
 * correctif F21 n'avait touché que la voie collective, et l'AFEST a continué
 * pendant ce temps à imprimer le programme sous « Compétences acquises ».
 * Dupliquer la logique aurait reproduit la divergence.
 */
function repartirCompetences(finale: {
  reussite: boolean;
  scorePct: number;
  niveauGlobal: unknown;
  competences: unknown;
}): ResultatsFinale {
  const lignes: CompetenceStockee[] = Array.isArray(finale.competences)
    ? (finale.competences as CompetenceStockee[])
    : [];

  const acquis: string[] = [];
  const partiels: string[] = [];
  const nonAcquis: string[] = [];
  const nonEvalues: string[] = [];

  for (const c of lignes) {
    if (c === null || typeof c !== "object") continue;
    const libelle = typeof c.libelle === "string" ? c.libelle.trim() : "";
    if (libelle === "") continue;
    if (c.note === 3) acquis.push(libelle);
    else if (c.note === 2) partiels.push(libelle);
    else if (c.note === 1) nonAcquis.push(libelle);
    else nonEvalues.push(libelle);
  }

  return {
    reussite: finale.reussite,
    scorePct: finale.scorePct,
    niveauGlobal: String(finale.niveauGlobal),
    acquis,
    partiels,
    nonAcquis,
    nonEvalues,
  };
}

/**
 * Même chose pour un parcours AFEST 1-to-1, indexé par `coachingSessionId`.
 *
 * L'AFEST est le dispositif où l'évaluation individuelle est le cœur du sujet au
 * regard de L6353-1 : y restituer le programme au lieu des résultats est plus
 * grave encore qu'en collectif.
 */
export async function getFinaleResultats1to1(
  coachingSessionId: string,
): Promise<ResultatsFinale | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return null;
  }
  const finale = await prisma.evaluationAcquis.findFirst({
    where: { coachingSessionId, type: "finale" },
    orderBy: { dateEvaluation: "desc" },
    select: { reussite: true, scorePct: true, niveauGlobal: true, competences: true },
  });
  if (finale === null) return null;
  return repartirCompetences(finale);
}

/**
 * Retourne la réussite de l'évaluation finale la plus récente.
 * Retourne `null` si aucune évaluation finale n'existe.
 */
export async function getFinaleReussite(enrollmentId: string): Promise<boolean | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return null;
  }
  const finale = await prisma.evaluationAcquis.findFirst({
    where: { enrollmentId, type: "finale" },
    orderBy: { dateEvaluation: "desc" },
    select: { reussite: true },
  });
  return finale?.reussite ?? null;
}
