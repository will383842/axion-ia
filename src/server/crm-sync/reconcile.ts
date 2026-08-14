/**
 * RÉCONCILIATION quotidienne de la synchro CRM (lot L5).
 *
 * « Le temps réel donne la fraîcheur, le batch donne la garantie. »
 *
 * ── Ce qu'elle répare, et ce qu'elle ne répare pas ──────────────────────────
 * L'outbox du lot L2 est POST-COMMIT (cf. `enqueue.ts`) : entre l'écriture
 * métier et l'écriture de la ligne d'outbox, il existe une fenêtre — étroite,
 * mais réelle — où un crash du processus laisse une soumission sans événement
 * à émettre. Ce batch est le filet qui rend cette fenêtre VISIBLE.
 *
 * 🔴 Il CONSIGNE, il ne ré-enfile pas. Ré-émettre automatiquement supposerait
 * de reconstruire un payload complet (PII déchiffrées, consentement, société)
 * depuis une source qu'on n'a pas relue — une reconstruction approximative
 * poussée dans un CRM vaut moins qu'une absence signalée. La décision de
 * rejouer reste humaine, depuis la console.
 *
 * ── Les deux faux positifs qu'on refuse de produire ─────────────────────────
 * Une alerte qui crie à tort est pire qu'une alerte absente : elle apprend à
 * ne plus lire. Deux bornes évitent cela :
 *   1. la fenêtre ne remonte JAMAIS avant la première ligne d'outbox — tout ce
 *      qui précède l'allumage du drapeau n'a légitimement rien émis ;
 *   2. les enregistrements des dernières minutes sont ignorés — sinon le batch
 *      accuserait une soumission arrivée pendant qu'il tourne.
 *
 * ── Le signal de VIE (leçon IndexNow) ──────────────────────────────────────
 * Un job vert qui ne relaie rien est le pire des états. Ce batch journalise
 * donc ses compteurs à CHAQUE passage, y compris — surtout — quand tout va
 * bien : l'absence de nouvelles doit être visible, pas supposée.
 */

import { prisma } from "@/lib/prisma";

import { alertCrmSync } from "./alerts";
import { isCrmSyncCandidatesEnabled, isCrmSyncEnabled } from "./config";
import type { CrmUniverse } from "./types";

/** Profondeur de la comparaison. Au-delà, l'anomalie n'est plus fraîche. */
export const RECONCILE_WINDOW_DAYS = 7;

/**
 * Les enregistrements plus récents que ce délai sont ignorés : l'écriture de
 * l'outbox est post-commit, donc décalée de quelques millisecondes. Cinq
 * minutes couvrent très largement, y compris un processus sous charge.
 */
const GRACE_MS = 5 * 60 * 1000;

/**
 * Plafond de sources examinées par famille et par passage.
 *
 * Ce n'est pas une optimisation prématurée : la comparaison passe par un
 * `IN (…)` sur les `subject_ref`, dont la taille est bornée par ce nombre. À
 * volume constant (Axion-IA produit quelques dizaines de soumissions par
 * semaine), le plafond n'est jamais atteint ; s'il l'était, le rapport le
 * DIRAIT au lieu de tronquer en silence.
 */
const MAX_SOURCES_PER_FAMILY = 2000;

/** Nombre d'identifiants manquants détaillés dans le rapport (le reste est compté). */
const MAX_REPORTED_IDS = 20;

export type CrmSyncFamily = "submission" | "job_application";

export interface ReconcileFamilyReport {
  family: CrmSyncFamily;
  label: string;
  universe: CrmUniverse;
  /** Nombre d'enregistrements source examinés sur la fenêtre. */
  sources: number;
  /** Nombre d'entre eux qui ont bien une ligne d'outbox. */
  emitted: number;
  /** Nombre d'entre eux qui n'en ont AUCUNE. */
  missing: number;
  /** Identifiants des manquants (tronqué à 20 — `missing` porte le total). */
  missingIds: string[];
  /** Renseigné quand la famille n'a pas été comparée, avec la raison. */
  skipped?: string;
  /** Vrai si le plafond de sources a été atteint (comparaison partielle). */
  truncated: boolean;
}

export interface ReconcileReport {
  ranAt: string;
  /** Faux ⇒ le batch est sorti immédiatement, rien n'a été comparé. */
  enabled: boolean;
  windowDays: number;
  /** Borne basse effective de la comparaison (null si rien à comparer). */
  since: string | null;
  families: ReconcileFamilyReport[];
  totalMissing: number;
}

const FAMILY_LABELS: Record<CrmSyncFamily, string> = {
  submission: "Formulaires (submissions)",
  job_application: "Candidatures aux offres",
};

/**
 * Compare les enregistrements SOURCE aux `subject_ref` émis, sans rien écrire
 * ni alerter. Séparée de `runCrmSyncReconciliation` pour que la console puisse
 * afficher l'écart courant sans déclencher de notification au chargement d'une
 * page — une carte d'observabilité ne doit pas avoir d'effet de bord.
 */
export async function collectReconciliation(): Promise<ReconcileReport> {
  const ranAt = new Date().toISOString();

  if (!isCrmSyncEnabled()) {
    return {
      ranAt,
      enabled: false,
      windowDays: RECONCILE_WINDOW_DAYS,
      since: null,
      families: [],
      totalMissing: 0,
    };
  }

  // Borne 1 : on ne remonte jamais avant la toute première ligne d'outbox.
  // Sans elle, la semaine qui suit l'allumage du drapeau produirait un écart
  // massif et parfaitement légitime — la meilleure façon de faire ignorer
  // l'alerte pour toujours.
  const first = await prisma.crmSyncOutbox.findFirst({
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  if (!first) {
    return {
      ranAt,
      enabled: true,
      windowDays: RECONCILE_WINDOW_DAYS,
      since: null,
      families: [],
      totalMissing: 0,
    };
  }

  const windowStart = new Date(Date.now() - RECONCILE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const since = first.createdAt > windowStart ? first.createdAt : windowStart;
  // Borne 2 : la période de grâce, pour ne pas accuser ce qui vient d'arriver.
  const until = new Date(Date.now() - GRACE_MS);

  const families: ReconcileFamilyReport[] = [];

  families.push(
    await compareFamily({
      family: "submission",
      universe: "business",
      since,
      until,
      // 🔴 `submittedAt` et non `createdAt` : c'est le nom de la colonne
      // d'horodatage sur `Submission` comme sur `JobApplication`. Un
      // `createdAt` inventé ici ne compile pas — mais avec un `where` typé
      // trop large il aurait pu passer et comparer la fenêtre ENTIÈRE.
      loadIds: (from, to) =>
        prisma.submission.findMany({
          where: { submittedAt: { gte: from, lt: to } },
          select: { id: true },
          orderBy: { submittedAt: "asc" },
          take: MAX_SOURCES_PER_FAMILY,
        }),
    }),
  );

  // Le vivier a son propre verrou (`CRM_SYNC_CANDIDATES_ENABLED`). Tant qu'il
  // est fermé, AUCUNE candidature n'est censée avoir de ligne d'outbox :
  // comparer produirait un écart de 100 % qui ne signale rien.
  if (isCrmSyncCandidatesEnabled()) {
    families.push(
      await compareFamily({
        family: "job_application",
        universe: "vivier",
        since,
        until,
        loadIds: (from, to) =>
          prisma.jobApplication.findMany({
            where: { submittedAt: { gte: from, lt: to } },
            select: { id: true },
            orderBy: { submittedAt: "asc" },
            take: MAX_SOURCES_PER_FAMILY,
          }),
      }),
    );
  } else {
    families.push({
      family: "job_application",
      label: FAMILY_LABELS.job_application,
      universe: "vivier",
      sources: 0,
      emitted: 0,
      missing: 0,
      missingIds: [],
      skipped: "flux candidats fermé (CRM_SYNC_CANDIDATES_ENABLED)",
      truncated: false,
    });
  }

  return {
    ranAt,
    enabled: true,
    windowDays: RECONCILE_WINDOW_DAYS,
    since: since.toISOString(),
    families,
    totalMissing: families.reduce((sum, f) => sum + f.missing, 0),
  };
}

interface CompareInput {
  family: CrmSyncFamily;
  universe: CrmUniverse;
  since: Date;
  until: Date;
  /**
   * Charge les identifiants source de la fenêtre. Le `where` est construit par
   * l'appelant et non ici : chaque modèle nomme sa colonne d'horodatage comme
   * il l'entend (`submittedAt` sur les deux familles actuelles), et un contrat
   * générique qui imposerait un nom de colonne serait faux dès le 3e modèle.
   */
  loadIds: (since: Date, until: Date) => PromiseLike<Array<{ id: string }>>;
}

async function compareFamily(input: CompareInput): Promise<ReconcileFamilyReport> {
  const sources = await input.loadIds(input.since, input.until);
  const refs = sources.map((s) => `site:${input.family}:${s.id}`);

  if (refs.length === 0) {
    return {
      family: input.family,
      label: FAMILY_LABELS[input.family],
      universe: input.universe,
      sources: 0,
      emitted: 0,
      missing: 0,
      missingIds: [],
      truncated: false,
    };
  }

  // Une seule requête, sur l'index `subject_ref` créé par la migration L2.
  // On demande les `subject_ref` PRÉSENTS et on déduit les absents en mémoire :
  // l'inverse (un NOT IN) ne saurait pas dire quels identifiants manquent.
  const emitted = await prisma.crmSyncOutbox.findMany({
    where: { subjectRef: { in: refs } },
    select: { subjectRef: true },
  });

  const seen = new Set(emitted.map((row) => row.subjectRef));
  const missing = refs.filter((ref) => !seen.has(ref));

  return {
    family: input.family,
    label: FAMILY_LABELS[input.family],
    universe: input.universe,
    sources: refs.length,
    emitted: refs.length - missing.length,
    missing: missing.length,
    missingIds: missing.slice(0, MAX_REPORTED_IDS),
    truncated: refs.length >= MAX_SOURCES_PER_FAMILY,
  };
}

/**
 * Le passage quotidien : compare, ALERTE si écart, et journalise toujours.
 *
 * Ne lève jamais — un échec du batch est lui-même une anomalie signalée
 * (`reconcile_failed`), pas un job rouge dont personne ne lit la trace.
 */
export async function runCrmSyncReconciliation(): Promise<ReconcileReport> {
  if (!isCrmSyncEnabled()) {
    // Sortie immédiate, drapeau à OFF. Aucune requête, aucun log de vie : dans
    // cet état l'outbox est vide par construction, il n'y a rien à surveiller.
    return {
      ranAt: new Date().toISOString(),
      enabled: false,
      windowDays: RECONCILE_WINDOW_DAYS,
      since: null,
      families: [],
      totalMissing: 0,
    };
  }

  let report: ReconcileReport;
  try {
    report = await collectReconciliation();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[crm-sync][réconciliation] échec du batch :", detail);
    await alertCrmSync({ kind: "reconcile_failed", detail });
    return {
      ranAt: new Date().toISOString(),
      enabled: true,
      windowDays: RECONCILE_WINDOW_DAYS,
      since: null,
      families: [],
      totalMissing: 0,
    };
  }

  // ── SIGNAL DE VIE ────────────────────────────────────────────────────────
  // Journalisé même quand tout est à zéro. C'est la seule preuve que la
  // garantie quotidienne a effectivement tourné : sans elle, un batch mort et
  // un batch qui ne trouve rien sont indiscernables.
  console.warn(
    `[crm-sync][réconciliation] ${JSON.stringify({
      ranAt: report.ranAt,
      since: report.since,
      totalMissing: report.totalMissing,
      familles: report.families.map((f) => ({
        famille: f.family,
        sources: f.sources,
        manquants: f.missing,
        ...(f.skipped ? { ignoree: f.skipped } : {}),
      })),
    })}`,
  );

  if (report.totalMissing > 0) {
    const detail = report.families
      .filter((f) => f.missing > 0)
      .map((f) => `${f.label} : ${f.missing} (${f.missingIds.join(", ")})`)
      .join(" · ");

    await alertCrmSync({
      kind: "reconcile_gap",
      count: report.totalMissing,
      detail: detail.slice(0, 400),
    });
  }

  return report;
}
