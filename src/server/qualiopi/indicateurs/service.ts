/**
 * Qualiopi — Service indicateurs (AGENT A — T10).
 *
 * getIndicateurs          : calcule les 4 indicateurs Qualiopi via Prisma + calcul.ts,
 *                           avec cache Redis TTL 3600 s.
 * invalidateIndicateursCache : supprime les clés de cache Redis.
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", retourne des valeurs
 * vides (safe au build SSG). Redis stub-aware via @/lib/redis.
 */

import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import {
  computeTauxSatisfaction,
  computeTauxReussite,
  computeTauxCompletion,
  computeDelaiAccesMoyen,
} from "./calcul";

// ─────────────────────────────────────────────────────────────────────────────
// Types exportés
// ─────────────────────────────────────────────────────────────────────────────

export interface IndicateurDetail {
  tauxPct: number;
  nb: number;
  fiable: boolean;
  libelle: string;
}

export interface DelaiAccesDetail {
  jours: number;
  nb: number;
  /** Même seuil de plausibilité que les trois taux (cf. `SEUIL_FIABILITE`). */
  fiable: boolean;
}

export interface MethodesCalcul {
  satisfaction: string;
  reussite: string;
  completion: string;
  delaiAcces: string;
}

export interface IndicateursResult {
  annee: number;
  tauxSatisfaction: IndicateurDetail;
  tauxReussite: IndicateurDetail;
  tauxCompletion: IndicateurDetail;
  delaiAccesMoyen: DelaiAccesDetail;
  methodes: MethodesCalcul;
  calculeAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_SEC = 3600;

function cacheKey(annee: number, formationId?: string): string {
  return `qualiopi:indicateurs:${annee}:${formationId ?? "all"}`;
}

function anneeRange(annee: number): { gte: Date; lt: Date } {
  return {
    gte: new Date(`${annee}-01-01T00:00:00.000Z`),
    lt: new Date(`${annee + 1}-01-01T00:00:00.000Z`),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getIndicateurs
// ─────────────────────────────────────────────────────────────────────────────

export async function getIndicateurs(
  annee: number,
  formationId?: string,
): Promise<IndicateursResult> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return buildEmptyResult(annee);
  }

  const key = cacheKey(annee, formationId);

  try {
    const cached = await redis.get(key);
    if (cached !== null && cached !== undefined) {
      const parsed = JSON.parse(cached as string) as IndicateursResult;
      return { ...parsed, calculeAt: new Date(parsed.calculeAt) };
    }
  } catch {
    // fail-soft
  }

  const plage = anneeRange(annee);

  const seuilPresencePct = await getQualiopiConfig("seuil_presence_pct");

  const questionnaires = await prisma.questionnaire.findMany({
    where: {
      type: "satisfaction_chaud",
      reponduAt: { not: null },
      noteGlobale: { not: null },
      enrollment: {
        session: {
          statut: "realisee",
          dateDebut: plage,
          ...(formationId !== undefined ? { formationId } : {}),
        },
      },
    },
    select: { noteGlobale: true },
  });

  const notes = questionnaires.map((q) => q.noteGlobale).filter((n): n is number => n !== null);

  const evaluations = await prisma.evaluationAcquis.findMany({
    where: {
      type: "finale",
      enrollment: {
        session: {
          statut: "realisee",
          dateDebut: plage,
          ...(formationId !== undefined ? { formationId } : {}),
        },
      },
    },
    select: { niveauGlobal: true },
  });

  const niveaux = evaluations.map(
    (e) => e.niveauGlobal as "non_acquis" | "partiellement_acquis" | "acquis",
  );

  const enrollments = await prisma.enrollment.findMany({
    where: {
      statut: { notIn: ["abandon", "exclu"] },
      session: {
        statut: "realisee",
        dateDebut: plage,
        ...(formationId !== undefined ? { formationId } : {}),
      },
    },
    select: {
      tauxPresencePct: true,
      createdAt: true,
      session: { select: { dateDebut: true } },
    },
  });

  const tauxPresences = enrollments.map((e) => e.tauxPresencePct);

  const paires = enrollments.map((e) => ({
    dateDebut: e.session.dateDebut,
    createdAt: e.createdAt,
  }));

  const satResult = computeTauxSatisfaction(notes);
  const reussiteResult = computeTauxReussite(niveaux);
  const completionResult = computeTauxCompletion(tauxPresences, seuilPresencePct as number);
  const delaiResult = computeDelaiAccesMoyen(paires);

  const debutStr = `01/01/${annee}`;
  const finStr = `31/12/${annee}`;

  const methodes: MethodesCalcul = {
    satisfaction: `Calculé sur la note globale (1 à 5) de tous les questionnaires de satisfaction remplis à l'issue de chaque session, rapportée à 100. (${satResult.nb} évaluation${satResult.nb > 1 ? "s" : ""} du ${debutStr} au ${finStr}).`,
    reussite: `Pourcentage de stagiaires ayant obtenu le niveau « acquis » à l'évaluation finale parmi l'ensemble des évaluations finales de l'année.`,
    completion: `Pourcentage de stagiaires ayant atteint ou dépassé le seuil de présence requis (${seuilPresencePct} %) sur l'ensemble des inscriptions actives de sessions réalisées.`,
    delaiAcces: `Délai moyen en jours entre la date d'inscription et le début de la session, sur les sessions réalisées de l'année.`,
  };

  const result: IndicateursResult = {
    annee,
    tauxSatisfaction: {
      ...satResult,
      libelle: satResult.fiable ? `${satResult.tauxPct} %` : "En cours de constitution",
    },
    tauxReussite: {
      ...reussiteResult,
      libelle: reussiteResult.fiable ? `${reussiteResult.tauxPct} %` : "En cours de constitution",
    },
    tauxCompletion: {
      ...completionResult,
      libelle: completionResult.fiable
        ? `${completionResult.tauxPct} %`
        : "En cours de constitution",
    },
    delaiAccesMoyen: delaiResult,
    methodes,
    calculeAt: new Date(),
  };

  try {
    await redis.set(key, JSON.stringify(result), "EX", CACHE_TTL_SEC);
  } catch {
    // fail-soft
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// invalidateIndicateursCache
// ─────────────────────────────────────────────────────────────────────────────

export async function invalidateIndicateursCache(annee?: number): Promise<void> {
  try {
    const pattern =
      annee !== undefined ? `qualiopi:indicateurs:${annee}:*` : "qualiopi:indicateurs:*";
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...(keys as [string, ...string[]]));
    }
  } catch {
    // fail-soft
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────────────

function buildEmptyResult(annee: number): IndicateursResult {
  const vide: IndicateurDetail = {
    tauxPct: 0,
    nb: 0,
    fiable: false,
    libelle: "En cours de constitution",
  };
  return {
    annee,
    tauxSatisfaction: vide,
    tauxReussite: vide,
    tauxCompletion: vide,
    delaiAccesMoyen: { jours: 0, nb: 0, fiable: false },
    methodes: {
      satisfaction: "",
      reussite: "",
      completion: "",
      delaiAcces: "",
    },
    calculeAt: new Date(),
  };
}
