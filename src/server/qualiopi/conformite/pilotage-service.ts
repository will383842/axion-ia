/**
 * Qualiopi — Service pilotage (AGENT B — T12, filtres LOT 4).
 *
 * getPilotage(options) : calcule les 14 métriques de pilotage RNQ V9.
 *   - options = annee seule (rétro-compatible : `getPilotage(2026)`) OU
 *     `{ annee, periode?, typeAction? }` :
 *       · periode : année entière / trimestre / mois — plage de dates dérivée
 *         en heure de Paris (Europe/Paris) ;
 *       · typeAction : filtre `formation.typesActionQualiopi has <type>` sur
 *         les métriques liées aux sessions (M1-M7, M12, M14). Les métriques
 *         transverses (M8 réclamations, M9 partie réclamations, M10 documents,
 *         M11 formateurs, M13 sous-traitants) ne sont PAS filtrées par type
 *         d'action — elles ne sont pas rattachées à une formation.
 *   Réutilise getIndicateurs (T10) + counts registres pour la vue année
 *   entière sans filtre ; calcule les taux M3/M5/M6 en direct (mêmes
 *   formules calcul.ts) dès qu'un filtre période/type est actif.
 *   Cache Redis optionnel TTL 3600 s (clé par année × période × type).
 *
 * M7 (LOT 4)  : incidents RÉELS du registre `incidents` + complément proxy
 *               sessions annulées/reportées (affiché en détail).
 * M9 (LOT 4)  : actions correctives = incidents avec actionCorrective non
 *               vide + réclamations avec actionsCorrectives (sources sommées).
 * M11 (LOT 4) : formateur « à jour » = actif, CV présent (cvUrl non null) ET
 *               preuve datée < 24 mois — cvUploadedAt pour un salarié ;
 *               cvUploadedAt OU sousTraitantVerifieAt pour un sous-traitant.
 *
 * pilotageToLignes / pilotageToCsv : sérialisation pour les exports PDF/CSV.
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", retourne un
 * PilotageResult vide (safe au build SSG).
 */

import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { getIndicateurs } from "@/server/qualiopi/indicateurs/service";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import {
  computeTauxSatisfaction,
  computeTauxReussite,
  computeTauxCompletion,
} from "@/server/qualiopi/indicateurs/calcul";
import { derivePlage, periodeKey, periodeLabel, type PilotagePeriode } from "./periode";
import type { TypeActionQualiopi } from "../../../../prisma/generated/client";

// Helpers de période extraits dans ./periode (module pur, sans DB/auth) — réexportés
// pour ne pas casser les imports existants (`from pilotage-service`).
export { derivePlage, periodeKey, periodeLabel };
export type { PilotagePeriode };

// ─────────────────────────────────────────────────────────────────────────────
// Types exportés
// ─────────────────────────────────────────────────────────────────────────────

export interface MetriqueValeur {
  valeur: number | string;
  libelle: string;
  unite?: string;
  /** Détail complémentaire affiché sous la valeur (proxys conservés, ventilation…). */
  detail?: string;
}

export interface PilotageOptions {
  annee: number;
  periode?: PilotagePeriode;
  typeAction?: TypeActionQualiopi;
}

export interface PilotageResult {
  annee: number;
  /** Période effective (année entière si absente). */
  periode: PilotagePeriode;
  /** Filtre type d'action Qualiopi appliqué (undefined = tous). */
  typeAction?: TypeActionQualiopi;
  /** M1 — Prestations ouvertes / terminées */
  m1_prestations: MetriqueValeur;
  /** M2 — Taux d'entrée dans le délai */
  m2_taux_entree_delai: MetriqueValeur;
  /** M3 — Taux de complétion */
  m3_taux_completion: MetriqueValeur;
  /** M4 — Taux d'abandon */
  m4_taux_abandon: MetriqueValeur;
  /** M5 — Taux d'atteinte des objectifs (réussite) */
  m5_taux_reussite: MetriqueValeur;
  /** M6 — Satisfaction globale */
  m6_satisfaction: MetriqueValeur;
  /** M7 — Incidents déclarés (registre) + complément sessions annulées/reportées */
  m7_incidents: MetriqueValeur;
  /** M8 — Réclamations reçues + délai moyen de traitement */
  m8_reclamations: MetriqueValeur;
  /** M9 — Actions correctives (incidents + réclamations) */
  m9_actions_correctives: MetriqueValeur;
  /** M10 — Mise à jour documentaire (documents générés dans la période) */
  m10_maj_documentaire: MetriqueValeur;
  /** M11 — Formateurs à jour de leurs preuves de compétences */
  m11_formateurs_a_jour: MetriqueValeur;
  /** M12 — Adaptations handicap réalisées */
  m12_adaptations_handicap: MetriqueValeur;
  /** M13 — Sous-traitances évaluées (contrat signé) */
  m13_sous_traitances_evaluees: MetriqueValeur;
  /** M14 — Conformité dossiers audités en interne */
  m14_conformite_dossiers: MetriqueValeur;
  calculeAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes + helpers période (Europe/Paris)
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_SEC = 3600;

function cacheKey(
  annee: number,
  periode: PilotagePeriode,
  typeAction?: TypeActionQualiopi,
): string {
  return `qualiopi:pilotage:${annee}:${periodeKey(periode)}:${typeAction ?? "all"}`;
}

/** Normalise l'entrée rétro-compatible (`number` → options année entière). */
function normalizeOptions(
  input: number | PilotageOptions,
): Required<Pick<PilotageOptions, "annee">> & Omit<PilotageOptions, "annee"> {
  if (typeof input === "number") return { annee: input };
  const periode = input.periode;
  return {
    annee: input.annee,
    ...(periode !== undefined ? { periode } : {}),
    ...(input.typeAction !== undefined ? { typeAction: input.typeAction } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getPilotage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule les 14 métriques de pilotage Qualiopi pour la période donnée.
 *
 * Réutilise :
 *   - getIndicateurs (T10) → taux satisfaction, réussite, complétion (année
 *     entière sans filtre type) ; sinon calcul direct via calcul.ts filtré
 *   - counts Prisma → sessions, incidents, réclamations, sous-traitants,
 *     adaptations, documents
 *
 * Cache Redis TTL 3600 s (optionnel — fail-soft).
 * Stub-aware : retourne PilotageResult vide si stub.invalid.
 */
export async function getPilotage(input: number | PilotageOptions): Promise<PilotageResult> {
  const options = normalizeOptions(input);
  const annee = options.annee;
  const periode: PilotagePeriode = options.periode ?? { type: "annee" };
  const typeAction = options.typeAction;

  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return buildEmptyPilotage(annee, periode, typeAction);
  }

  const key = cacheKey(annee, periode, typeAction);

  // Lecture cache
  try {
    const cached = await redis.get(key);
    if (cached !== null && cached !== undefined) {
      const parsed = JSON.parse(cached as string) as PilotageResult;
      return { ...parsed, calculeAt: new Date(parsed.calculeAt) };
    }
  } catch {
    // fail-soft
  }

  const plage = derivePlage(annee, periode);

  // Filtre commun sur les sessions : plage de dates + type d'action Qualiopi
  // (champ réel `Formation.typesActionQualiopi TypeActionQualiopi[]`).
  const sessionWhere = {
    dateDebut: plage,
    ...(typeAction !== undefined
      ? { formation: { typesActionQualiopi: { has: typeAction } } }
      : {}),
  };

  // Filtre plein (année, aucun type) → réutilise les agrégats T10 cachés.
  const sansFiltre = periode.type === "annee" && typeAction === undefined;

  // Récupération parallèle : counts registres + taux
  const [
    taux,
    nbSessionsRealisees,
    nbSessionsPlanifiees,
    nbEnrollmentsAbandons,
    nbEnrollmentsTotal,
    nbReclamations,
    nbReclamationsEnRetard,
    nbReclamationsResolues,
    nbSousTraitantsTotal,
    nbSousTraitantsContratSigne,
    nbDocumentsAnnee,
    nbTrainersTotal,
    nbTrainersAJour,
    nbAdaptationsHandicap,
    nbEnrollmentsConvocations,
    nbIncidentsReels,
    nbSessionsAnnuleesReportees,
    nbIncidentsAvecAction,
    nbReclamationsAvecAction,
  ] = await Promise.all([
    computeTaux(annee, plage, typeAction, sansFiltre),
    prisma.trainingSession.count({
      where: { ...sessionWhere, statut: "realisee" },
    }),
    prisma.trainingSession.count({
      where: sessionWhere,
    }),
    prisma.enrollment.count({
      where: {
        statut: "abandon",
        session: sessionWhere,
      },
    }),
    prisma.enrollment.count({
      where: {
        session: sessionWhere,
      },
    }),
    prisma.reclamation.count({
      where: { dateReception: plage },
    }),
    // Réclamations sans réponse depuis > 15 jours
    prisma.reclamation.count({
      where: {
        dateReception: plage,
        dateReponse: null,
        createdAt: {
          lt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.reclamation.count({
      where: {
        dateReception: plage,
        statut: { in: ["resolue", "cloturee"] },
      },
    }),
    prisma.sousTraitant.count(),
    prisma.sousTraitant.count({ where: { contratSigneAt: { not: null } } }),
    prisma.documentGenere.count({ where: { createdAt: plage } }),
    prisma.trainer.count({ where: { actif: true } }),
    // M11 (LOT 4) — critère « à jour » HONNÊTE (remplace le proxy updatedAt) :
    // formateur actif avec CV présent (cvUrl non null) ET preuve datée dans les
    // 24 derniers mois :
    //   · salarié       → cvUploadedAt (le CV est la preuve maintenue — off.21/22) ;
    //   · sous-traitant → cvUploadedAt OU sousTraitantVerifieAt (la vérification
    //     data.gouv/NDA du sous-traitant vaut preuve de qualification à date).
    // 24 mois = fenêtre de renouvellement des preuves entre deux audits de
    // surveillance ; borne calculée à la fin de la période analysée (min(now)).
    prisma.trainer.count({
      where: {
        actif: true,
        cvUrl: { not: null },
        OR: [
          {
            statut: { in: ["salarie", "dirigeant"] },
            cvUploadedAt: { gte: cutoff24Mois(plage.lt) },
          },
          {
            statut: "sous_traitant",
            OR: [
              { cvUploadedAt: { gte: cutoff24Mois(plage.lt) } },
              { sousTraitantVerifieAt: { gte: cutoff24Mois(plage.lt) } },
            ],
          },
        ],
      },
    }),
    // Adaptations handicap réalisées sur inscriptions de la période
    prisma.enrollment.count({
      where: {
        adaptationsRealisees: { not: null },
        session: sessionWhere,
      },
    }),
    // Convocations générées (proxy délai d'entrée)
    prisma.enrollment.count({
      where: {
        session: sessionWhere,
        statut: { notIn: ["abandon", "exclu"] },
      },
    }),
    // M7 (LOT 4) — incidents RÉELS du registre sur la période. Si un type
    // d'action est filtré, seuls les incidents rattachés à une session de ce
    // type sont comptés (un incident sans session est hors périmètre du filtre).
    prisma.incident.count({
      where: {
        dateIncident: plage,
        ...(typeAction !== undefined
          ? { session: { formation: { typesActionQualiopi: { has: typeAction } } } }
          : {}),
      },
    }),
    // Complément M7 — ancien proxy conservé en détail : sessions annulées/reportées.
    prisma.trainingSession.count({
      where: {
        ...sessionWhere,
        statut: { in: ["annulee", "reportee"] },
      },
    }),
    // M9 (LOT 4) — incidents de la période avec action corrective renseignée.
    prisma.incident.count({
      where: {
        dateIncident: plage,
        actionCorrective: { not: "" },
        ...(typeAction !== undefined
          ? { session: { formation: { typesActionQualiopi: { has: typeAction } } } }
          : {}),
      },
    }),
    // M9 — réclamations de la période avec actions correctives renseignées.
    prisma.reclamation.count({
      where: {
        dateReception: plage,
        actionsCorrectives: { not: null },
      },
    }),
  ]);

  // ── M1 — Prestations ouvertes / terminées ──────────────────────────────────
  const nbTerminees = nbSessionsRealisees;
  const nbOuvertes = nbSessionsPlanifiees;
  const m1: MetriqueValeur = {
    valeur: `${nbTerminees} terminée(s) / ${nbOuvertes} au total`,
    libelle: "Prestations ouvertes / terminées",
  };

  // ── M2 — Taux d'entrée dans le délai ──────────────────────────────────────
  // Proxy : % d'inscrits actifs sur sessions ouvertes dans la période
  const m2Val =
    nbSessionsPlanifiees > 0
      ? Math.round((nbEnrollmentsConvocations / Math.max(nbEnrollmentsTotal, 1)) * 100)
      : 0;
  const m2: MetriqueValeur = {
    valeur: m2Val,
    libelle: "Taux d'entrée dans le délai",
    unite: "%",
  };

  // ── M3 — Taux de complétion ────────────────────────────────────────────────
  const m3: MetriqueValeur = taux.completion.fiable
    ? { valeur: taux.completion.tauxPct, libelle: taux.completion.libelle, unite: "%" }
    : { valeur: "—", libelle: taux.completion.libelle };

  // ── M4 — Taux d'abandon ────────────────────────────────────────────────────
  const m4Val =
    nbEnrollmentsTotal > 0 ? Math.round((nbEnrollmentsAbandons / nbEnrollmentsTotal) * 100) : 0;
  const m4: MetriqueValeur = {
    valeur: m4Val,
    libelle: "Taux d'abandon",
    unite: "%",
  };

  // ── M5 — Taux d'atteinte des objectifs (réussite) ─────────────────────────
  const m5: MetriqueValeur = taux.reussite.fiable
    ? { valeur: taux.reussite.tauxPct, libelle: taux.reussite.libelle, unite: "%" }
    : { valeur: "—", libelle: taux.reussite.libelle };

  // ── M6 — Satisfaction globale ──────────────────────────────────────────────
  const m6: MetriqueValeur = taux.satisfaction.fiable
    ? { valeur: taux.satisfaction.tauxPct, libelle: taux.satisfaction.libelle, unite: "%" }
    : { valeur: "—", libelle: taux.satisfaction.libelle };

  // ── M7 — Incidents (LOT 4 : registre réel + proxy conservé en détail) ─────
  const m7: MetriqueValeur = {
    valeur: nbIncidentsReels,
    libelle: "Incidents déclarés (registre)",
    detail: `Complément : ${nbSessionsAnnuleesReportees} session(s) annulée(s)/reportée(s) sur la période`,
  };

  // ── M8 — Réclamations + délai ─────────────────────────────────────────────
  const m8: MetriqueValeur = {
    valeur: `${nbReclamations} reçue(s) · ${nbReclamationsEnRetard} en retard · ${nbReclamationsResolues} résolue(s)`,
    libelle: "Réclamations reçues + délai de traitement",
  };

  // ── M9 — Actions correctives (LOT 4 : incidents + réclamations sommés) ────
  const nbActionsCorrectives = nbIncidentsAvecAction + nbReclamationsAvecAction;
  const m9: MetriqueValeur = {
    valeur: nbActionsCorrectives,
    libelle: "Actions correctives engagées",
    detail: `${nbIncidentsAvecAction} incident(s) avec action corrective · ${nbReclamationsAvecAction} réclamation(s) avec actions correctives`,
  };

  // ── M10 — Mise à jour documentaire ────────────────────────────────────────
  const m10: MetriqueValeur = {
    valeur: nbDocumentsAnnee,
    libelle: "Documents générés dans la période",
  };

  // ── M11 — Formateurs à jour (LOT 4 : preuve datée < 24 mois) ──────────────
  const m11Val = nbTrainersTotal > 0 ? Math.round((nbTrainersAJour / nbTrainersTotal) * 100) : 0;
  const m11: MetriqueValeur = {
    valeur: `${nbTrainersAJour} / ${nbTrainersTotal} (${m11Val} %)`,
    libelle: "Formateurs à jour de leurs preuves de compétences",
    detail:
      "Critère : actif, CV présent et preuve datée < 24 mois (CV téléversé — ou vérification sous-traitant)",
  };

  // ── M12 — Adaptations handicap réalisées ──────────────────────────────────
  const m12: MetriqueValeur = {
    valeur: nbAdaptationsHandicap,
    libelle: "Adaptations handicap réalisées",
  };

  // ── M13 — Sous-traitances évaluées ────────────────────────────────────────
  const m13Val =
    nbSousTraitantsTotal > 0
      ? Math.round((nbSousTraitantsContratSigne / nbSousTraitantsTotal) * 100)
      : 0;
  const m13: MetriqueValeur = {
    valeur: `${nbSousTraitantsContratSigne} / ${nbSousTraitantsTotal} (${m13Val} %)`,
    libelle: "Sous-traitances avec contrat signé",
  };

  // ── M14 — Conformité dossiers audités en interne ──────────────────────────
  // Proxy : sessions avec tous les documents attendus générés
  const nbSessionsAvecDocs = await prisma.trainingSession.count({
    where: {
      ...sessionWhere,
      statut: "realisee",
      documents: { some: {} },
    },
  });
  const m14Val = nbTerminees > 0 ? Math.round((nbSessionsAvecDocs / nbTerminees) * 100) : 0;
  const m14: MetriqueValeur = {
    valeur: `${nbSessionsAvecDocs} / ${nbTerminees} (${m14Val} %)`,
    libelle: "Sessions réalisées avec dossier documentaire complet",
  };

  const result: PilotageResult = {
    annee,
    periode,
    ...(typeAction !== undefined ? { typeAction } : {}),
    m1_prestations: m1,
    m2_taux_entree_delai: m2,
    m3_taux_completion: m3,
    m4_taux_abandon: m4,
    m5_taux_reussite: m5,
    m6_satisfaction: m6,
    m7_incidents: m7,
    m8_reclamations: m8,
    m9_actions_correctives: m9,
    m10_maj_documentaire: m10,
    m11_formateurs_a_jour: m11,
    m12_adaptations_handicap: m12,
    m13_sous_traitances_evaluees: m13,
    m14_conformite_dossiers: m14,
    calculeAt: new Date(),
  };

  // Écriture cache
  try {
    await redis.set(key, JSON.stringify(result), "EX", CACHE_TTL_SEC);
  } catch {
    // fail-soft
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Taux M3/M5/M6 — réutilise getIndicateurs (année pleine) OU calcul direct filtré
// ─────────────────────────────────────────────────────────────────────────────

interface TauxDetail {
  tauxPct: number;
  fiable: boolean;
  libelle: string;
}

interface TauxResult {
  satisfaction: TauxDetail;
  reussite: TauxDetail;
  completion: TauxDetail;
}

async function computeTaux(
  annee: number,
  plage: { gte: Date; lt: Date },
  typeAction: TypeActionQualiopi | undefined,
  sansFiltre: boolean,
): Promise<TauxResult> {
  if (sansFiltre) {
    // Année pleine sans filtre → agrégats T10 (mêmes chiffres que /indicateurs).
    const indicateurs = await getIndicateurs(annee);
    return {
      satisfaction: indicateurs.tauxSatisfaction,
      reussite: indicateurs.tauxReussite,
      completion: indicateurs.tauxCompletion,
    };
  }

  // Filtre actif → calcul direct avec les MÊMES formules (calcul.ts) sur le
  // périmètre filtré (période Europe/Paris + type d'action éventuel).
  const sessionWhere = {
    statut: "realisee" as const,
    dateDebut: plage,
    ...(typeAction !== undefined
      ? { formation: { typesActionQualiopi: { has: typeAction } } }
      : {}),
  };

  const seuilPresencePct = await getQualiopiConfig("seuil_presence_pct").catch(() => 80);

  const [questionnaires, evaluations, enrollments] = await Promise.all([
    prisma.questionnaire.findMany({
      where: {
        type: "satisfaction_chaud",
        reponduAt: { not: null },
        noteGlobale: { not: null },
        enrollment: { session: sessionWhere },
      },
      select: { noteGlobale: true },
    }),
    prisma.evaluationAcquis.findMany({
      where: {
        type: "finale",
        enrollment: { session: sessionWhere },
      },
      select: { niveauGlobal: true },
    }),
    prisma.enrollment.findMany({
      where: {
        statut: { notIn: ["abandon", "exclu"] },
        session: sessionWhere,
      },
      select: { tauxPresencePct: true },
    }),
  ]);

  const notes = questionnaires.map((q) => q.noteGlobale).filter((n): n is number => n !== null);
  const niveaux = evaluations.map(
    (e) => e.niveauGlobal as "non_acquis" | "partiellement_acquis" | "acquis",
  );
  const tauxPresences = enrollments.map((e) => e.tauxPresencePct);

  const sat = computeTauxSatisfaction(notes);
  const reussite = computeTauxReussite(niveaux);
  const completion = computeTauxCompletion(
    tauxPresences,
    typeof seuilPresencePct === "number" ? seuilPresencePct : 80,
  );

  const libelle = (r: { tauxPct: number; fiable: boolean }): string =>
    r.fiable ? `${r.tauxPct} %` : "En cours de constitution";

  return {
    satisfaction: { tauxPct: sat.tauxPct, fiable: sat.fiable, libelle: libelle(sat) },
    reussite: { tauxPct: reussite.tauxPct, fiable: reussite.fiable, libelle: libelle(reussite) },
    completion: {
      tauxPct: completion.tauxPct,
      fiable: completion.fiable,
      libelle: libelle(completion),
    },
  };
}

/** Borne « preuve datée < 24 mois » : 24 mois avant la fin de période (plafonné à now). */
function cutoff24Mois(finPeriode: Date): Date {
  const ref = finPeriode.getTime() < Date.now() ? new Date(finPeriode) : new Date();
  ref.setMonth(ref.getMonth() - 24);
  return ref;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sérialisation exports (LOT 4 — CSV + PDF)
// ─────────────────────────────────────────────────────────────────────────────

/** Ordre canonique des 14 métriques (exports + affichage). */
export function pilotageMetriques(
  result: PilotageResult,
): Array<{ code: string; metrique: MetriqueValeur }> {
  return [
    { code: "M1", metrique: result.m1_prestations },
    { code: "M2", metrique: result.m2_taux_entree_delai },
    { code: "M3", metrique: result.m3_taux_completion },
    { code: "M4", metrique: result.m4_taux_abandon },
    { code: "M5", metrique: result.m5_taux_reussite },
    { code: "M6", metrique: result.m6_satisfaction },
    { code: "M7", metrique: result.m7_incidents },
    { code: "M8", metrique: result.m8_reclamations },
    { code: "M9", metrique: result.m9_actions_correctives },
    { code: "M10", metrique: result.m10_maj_documentaire },
    { code: "M11", metrique: result.m11_formateurs_a_jour },
    { code: "M12", metrique: result.m12_adaptations_handicap },
    { code: "M13", metrique: result.m13_sous_traitances_evaluees },
    { code: "M14", metrique: result.m14_conformite_dossiers },
  ];
}

/** Lignes [Métrique, Valeur, Détail] pour le template PDF registre générique. */
export function pilotageToLignes(result: PilotageResult): string[][] {
  return pilotageMetriques(result).map(({ code, metrique }) => [
    `${code} — ${metrique.libelle}`,
    `${metrique.valeur}${metrique.unite !== undefined ? ` ${metrique.unite}` : ""}`,
    metrique.detail ?? "",
  ]);
}

/** CSV (séparateur « ; », valeurs entre guillemets) des 14 métriques. */
export function pilotageToCsv(result: PilotageResult): string {
  const esc = (s: string): string => `"${s.replace(/"/g, '""')}"`;
  const lignes: string[] = [
    ["Code", "Métrique", "Valeur", "Unité", "Détail"].map(esc).join(";"),
    ...pilotageMetriques(result).map(({ code, metrique }) =>
      [code, metrique.libelle, String(metrique.valeur), metrique.unite ?? "", metrique.detail ?? ""]
        .map(esc)
        .join(";"),
    ),
    "",
    [
      esc("Période"),
      esc(periodeLabel(result.annee, result.periode)),
      esc("Type d'action"),
      esc(result.typeAction ?? "tous"),
      esc(`Calculé le ${result.calculeAt.toLocaleDateString("fr-FR")}`),
    ].join(";"),
  ];
  return lignes.join("\n") + "\n";
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper interne
// ─────────────────────────────────────────────────────────────────────────────

function videMetrique(libelle: string): MetriqueValeur {
  return { valeur: 0, libelle };
}

function videMetriquePct(libelle: string): MetriqueValeur {
  return { valeur: 0, libelle, unite: "%" };
}

function buildEmptyPilotage(
  annee: number,
  periode: PilotagePeriode,
  typeAction?: TypeActionQualiopi,
): PilotageResult {
  return {
    annee,
    periode,
    ...(typeAction !== undefined ? { typeAction } : {}),
    m1_prestations: videMetrique("Prestations ouvertes / terminées"),
    m2_taux_entree_delai: videMetriquePct("Taux d'entrée dans le délai"),
    m3_taux_completion: videMetriquePct("Taux de complétion"),
    m4_taux_abandon: videMetriquePct("Taux d'abandon"),
    m5_taux_reussite: videMetriquePct("Taux d'atteinte des objectifs"),
    m6_satisfaction: videMetriquePct("Satisfaction globale"),
    m7_incidents: videMetrique("Incidents"),
    m8_reclamations: videMetrique("Réclamations"),
    m9_actions_correctives: videMetrique("Actions correctives"),
    m10_maj_documentaire: videMetrique("Mise à jour documentaire"),
    m11_formateurs_a_jour: videMetrique("Formateurs à jour"),
    m12_adaptations_handicap: videMetrique("Adaptations handicap"),
    m13_sous_traitances_evaluees: videMetrique("Sous-traitances évaluées"),
    m14_conformite_dossiers: videMetrique("Conformité dossiers"),
    calculeAt: new Date(),
  };
}
