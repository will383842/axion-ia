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
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { redis } from "@/lib/redis";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { QUALIOPI_CONFIG_REGISTRY } from "@/server/qualiopi/config/registry";
import { buildMethodesCalcul, type MethodesCalcul } from "./methodes";
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

/**
 * Les quatre phrases de méthode vivent dans `./methodes` — module PUR, hors du
 * chemin DB. Le type est ré-exporté ici pour ne pas casser les imports
 * existants (`import type { MethodesCalcul } from ".../indicateurs/service"`).
 */
export type { MethodesCalcul };

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
      ...inscriptionsActives(),
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

  const methodes: MethodesCalcul = buildMethodesCalcul({
    annee,
    seuilPresencePct: seuilPresencePct as number,
    nbSatisfaction: satResult.nb,
  });

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
    // 🔴 2026-09-17 — ces quatre champs valaient `""`. C'est ce résultat-là qui
    // sort au build SSG sous `stub.invalid`, et `revalidate = 3600` le FIGE
    // dans le HTML pré-rendu de `/fr/certification-qualiopi` : mesuré en
    // production, zéro occurrence des quatre méthodes dans 1 411 588 octets.
    // La méthode ne dépend d'AUCUNE donnée — seulement de l'année, du seuil de
    // présence (défaut du registre quand la base ne répond pas) et de
    // l'effectif, qui vaut honnêtement 0 ici. Elle est donc construite, pas
    // vidée : une page « en cours de constitution » doit dire COMMENT le
    // chiffre sera calculé quand il existera.
    methodes: buildMethodesCalcul({
      annee,
      seuilPresencePct: QUALIOPI_CONFIG_REGISTRY["seuil_presence_pct"].default,
      nbSatisfaction: 0,
    }),
    calculeAt: new Date(),
  };
}
