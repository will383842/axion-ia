/**
 * Qualiopi — Service alertes système (T15 AGENT A).
 *
 * creerOuDedup      : crée une alerte (skip si doublon code+cibleId non résolue).
 * resoudreAlerte    : marque une alerte résolue + resolueAt.
 * marquerLu         : marque une alerte lue.
 * marquerToutLu     : marque toutes les alertes non-lues comme lues.
 * listAlertes       : liste les alertes (filtres optionnels).
 * countNonLues      : compte les alertes non lues.
 * synchroniserAlertes : évalue + crée/résout en masse.
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", toutes les fonctions
 * retournent des fallbacks vides/null sans appel Prisma.
 */

import { prisma } from "@/lib/prisma";
import type { AlerteNiveau, AlerteSysteme } from "../../../../prisma/generated/client";
import { evaluerAlertesDetaille } from "./evaluateur";
import { ALERTE_CATALOGUE } from "./catalogue";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AlerteInput {
  readonly code: string;
  readonly niveau: AlerteNiveau;
  readonly titre: string;
  readonly message: string;
  readonly cibleType?: string;
  readonly cibleId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ListAlertesOptions {
  readonly resolue?: boolean;
  readonly lu?: boolean;
  readonly niveau?: AlerteNiveau;
  readonly limit?: number;
}

export type { AlerteSysteme };

// ─────────────────────────────────────────────────────────────────────────────
// Guard stub
// ─────────────────────────────────────────────────────────────────────────────

function isStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

// ─────────────────────────────────────────────────────────────────────────────
// creerOuDedup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée une alerte en DB. Si une alerte (code, cibleId) non résolue existe déjà,
 * retourne `null` (dé-duplication silencieuse).
 */
export async function creerOuDedup(input: AlerteInput): Promise<AlerteSysteme | null> {
  if (isStub()) return null;

  const existing = await prisma.alerteSysteme.findFirst({
    where: {
      code: input.code,
      resolue: false,
      ...(input.cibleId !== undefined ? { cibleId: input.cibleId } : { cibleId: null }),
    },
  });
  if (existing) return null;

  return prisma.alerteSysteme.create({
    data: {
      code: input.code,
      niveau: input.niveau,
      titre: input.titre,
      message: input.message,
      ...(input.cibleType !== undefined ? { cibleType: input.cibleType } : {}),
      ...(input.cibleId !== undefined ? { cibleId: input.cibleId } : {}),
      metadata: (input.metadata ?? {}) as never,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// resoudreAlerte
// ─────────────────────────────────────────────────────────────────────────────

export async function resoudreAlerte(id: string): Promise<AlerteSysteme | null> {
  if (isStub()) return null;
  return prisma.alerteSysteme.update({
    where: { id },
    data: { resolue: true, resolueAt: new Date() },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// marquerLu
// ─────────────────────────────────────────────────────────────────────────────

export async function marquerLu(id: string): Promise<AlerteSysteme | null> {
  if (isStub()) return null;
  return prisma.alerteSysteme.update({
    where: { id },
    data: { lu: true },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// marquerToutLu
// ─────────────────────────────────────────────────────────────────────────────

export async function marquerToutLu(): Promise<{ count: number }> {
  if (isStub()) return { count: 0 };
  const result = await prisma.alerteSysteme.updateMany({
    where: { lu: false },
    data: { lu: true },
  });
  return { count: result.count };
}

// ─────────────────────────────────────────────────────────────────────────────
// listAlertes
// ─────────────────────────────────────────────────────────────────────────────

export async function listAlertes(options?: ListAlertesOptions): Promise<AlerteSysteme[]> {
  if (isStub()) return [];
  return prisma.alerteSysteme.findMany({
    where: {
      ...(options?.resolue !== undefined ? { resolue: options.resolue } : {}),
      ...(options?.lu !== undefined ? { lu: options.lu } : {}),
      ...(options?.niveau !== undefined ? { niveau: options.niveau } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    ...(options?.limit !== undefined ? { take: options.limit } : {}),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// countNonLues
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Alertes non lues ET encore ACTIVES.
 *
 * 🔴 `resolue: false` manquait. Le compteur additionnait donc les alertes déjà
 * résolues mais jamais marquées lues — et résoudre une alerte ne la marque pas
 * lue. La pastille affichait 17 là où la page listait 5 alertes actives, et
 * l'écart ne pouvait que croître : une pastille qu'on ne peut pas faire
 * redescendre cesse d'être un signal.
 */
export async function countNonLues(): Promise<number> {
  if (isStub()) return 0;
  return prisma.alerteSysteme.count({ where: { lu: false, resolue: false } });
}

// ─────────────────────────────────────────────────────────────────────────────
// synchroniserAlertes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Évalue les alertes (via evaluerAlertes si disponible), crée les nouvelles
 * et résout automatiquement celles dont la condition a disparu.
 *
 * Import dynamique d'evaluerAlertes pour éviter un cycle si evaluateur.ts
 * n'est pas encore livré (Agent A l'implémente séparément).
 */
export async function synchroniserAlertes(): Promise<{ crees: number; resolues: number }> {
  if (isStub()) return { crees: 0, resolues: 0 };

  const { candidates: candidats, reglesEnEchec } = await evaluerAlertesDetaille();

  let crees = 0;
  for (const c of candidats) {
    const created = await creerOuDedup(c);
    if (created) crees++;
  }

  // 🔴 Une règle en échec (fail-soft) ne produit AUCUNE candidate : résoudre
  // « ce qui n'est plus signalé » effacerait alors en masse toutes les alertes
  // ouvertes de ses codes — un timeout DB un matin suffirait. Créations
  // conservées, résolution suspendue jusqu'au prochain tour sain.
  if (reglesEnEchec.length > 0) {
    console.warn(
      `[alertes-service] résolution auto SUSPENDUE ce tour : ${reglesEnEchec.length} règle(s) en échec (${reglesEnEchec.join(", ")})`,
    );
    return { crees, resolues: 0 };
  }

  // Résolution automatique : codes à resolutionAuto=true dont la condition
  // a disparu — on vérifie par (code, cibleId) pour la précision.
  const codesAutoResolution = Object.entries(ALERTE_CATALOGUE)
    .filter(([, entry]) => entry.resolutionAuto)
    .map(([code]) => code);

  // Ensemble des (code::cibleId) encore actifs
  const actifSet = new Set(candidats.map((c) => `${c.code}::${c.cibleId ?? "null"}`));

  const alertesOuvertes = await prisma.alerteSysteme.findMany({
    where: {
      code: { in: codesAutoResolution },
      resolue: false,
    },
    select: { id: true, code: true, cibleId: true },
  });

  let resolues = 0;
  for (const alerte of alertesOuvertes) {
    const key = `${alerte.code}::${alerte.cibleId ?? "null"}`;
    if (!actifSet.has(key)) {
      try {
        await resoudreAlerte(alerte.id);
        resolues++;
      } catch (err) {
        console.error(
          `[alertes-service] erreur résolution auto alerte ${alerte.id}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  return { crees, resolues };
}
