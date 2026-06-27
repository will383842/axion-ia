/**
 * Qualiopi 1-to-1 / AFEST — snapshot légal anti-stale (WS9).
 *
 * Différence avec le snapshot des formations collectives :
 *   - Collectif : la `TrainingSession` lit une `Formation` PARTAGÉE et mutable →
 *     on fige la formation dans la session à la CRÉATION.
 *   - 1-to-1 : le contenu engageant vit DÉJÀ sur la `CoachingSession`, mais (a)
 *     il est renseigné APRÈS la création (cadrage AFEST), et (b) l'intitulé est
 *     résolu en LIVE depuis un catalogue statique (`coachingInterventionLabel`).
 *     Le risque n'est donc pas une lecture cross-table, mais l'INCOHÉRENCE entre
 *     documents successifs d'un même parcours (protocole → attestation →
 *     certificat → kits) si le contenu — ou le libellé — change entre deux
 *     émissions.
 *
 * Solution : « snapshot-on-first-emit ». Au PREMIER document légal émis, on fige
 * le contenu pédagogique engageant dans `CoachingSession.coachingSnapshot` ;
 * tous les documents suivants lisent ce snapshot (repli LIVE pour les parcours
 * legacy sans document émis). Le binding moment = première émission (pas la
 * création), car le contenu n'est complet qu'après le cadrage.
 *
 * Helpers purs + un `ensureCoachingSnapshot` idempotent (lit/écrit la DB).
 */

import { prisma } from "@/lib/prisma";
import { coachingInterventionLabel } from "@/server/formateur/coaching-options";

/** Modalité AFEST canonique (jusqu'ici codée en dur dans chaque générateur). */
export const AFEST_MODALITE = "Action de formation en situation de travail (AFEST)";

/** Champs `CoachingSession` à sélectionner pour bâtir un snapshot (Prisma select). */
export const COACHING_SNAPSHOT_SELECT = {
  interventionSlug: true,
  objectifsPedagogiques: true,
  heuresPrevuesConvention: true,
  certificationType: true,
  codeRncp: true,
  codeRs: true,
  numeroEnregistrementFc: true,
} as const;

/** Sous-ensemble d'une CoachingSession suffisant pour bâtir un snapshot. */
export interface CoachingSnapshotSource {
  interventionSlug: string;
  objectifsPedagogiques?: unknown;
  /** Decimal Prisma | number | null — coercé en number. */
  heuresPrevuesConvention?: { toString(): string } | number | null;
  certificationType?: string | null;
  codeRncp?: string | null;
  codeRs?: string | null;
  numeroEnregistrementFc?: string | null;
}

/** Snapshot figé persisté dans `CoachingSession.coachingSnapshot`. */
export interface CoachingSnapshot {
  v: 1;
  /** Intitulé RÉSOLU du parcours (pas le slug) — capture la dérive catalogue. */
  intitule: string;
  objectifsPedagogiques: unknown;
  heuresPrevuesConvention: number | null;
  modalite: string;
  certificationType: string | null;
  codeRncp: string | null;
  codeRs: string | null;
  numeroEnregistrementFc: string | null;
  capturedAt: string;
}

function toNumberOrNull(v: CoachingSnapshotSource["heuresPrevuesConvention"]): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

/** Construit le snapshot figé d'un parcours coaching à un instant donné. */
export function buildCoachingSnapshot(
  src: CoachingSnapshotSource,
  capturedAt: Date,
): CoachingSnapshot {
  return {
    v: 1,
    intitule: coachingInterventionLabel(src.interventionSlug),
    objectifsPedagogiques: src.objectifsPedagogiques ?? null,
    heuresPrevuesConvention: toNumberOrNull(src.heuresPrevuesConvention),
    modalite: AFEST_MODALITE,
    certificationType: src.certificationType ?? null,
    codeRncp: src.codeRncp ?? null,
    codeRs: src.codeRs ?? null,
    numeroEnregistrementFc: src.numeroEnregistrementFc ?? null,
    capturedAt: capturedAt.toISOString(),
  };
}

/** Champs résolus pour la génération d'un document coaching. */
export interface ResolvedCoachingForDocs {
  intitule: string;
  objectifsPedagogiques: unknown;
  heuresPrevuesConvention: number | null;
  modalite: string;
  certificationType: string | null;
  codeRncp: string | null;
  codeRs: string | null;
  numeroEnregistrementFc: string | null;
  source: "snapshot" | "live";
}

/** Un snapshot est exploitable s'il porte au minimum un `intitule` string. */
export function isUsableCoachingSnapshot(value: unknown): value is CoachingSnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { intitule?: unknown }).intitule === "string"
  );
}

/**
 * Résout les champs coaching pour un document : snapshot EN PRIORITÉ, sinon repli
 * sur le contenu LIVE de la session (parcours legacy sans document émis).
 */
export function readCoachingForDocs(
  snapshot: unknown,
  live: CoachingSnapshotSource,
): ResolvedCoachingForDocs {
  if (isUsableCoachingSnapshot(snapshot)) {
    return { ...snapshotToResolved(snapshot), source: "snapshot" };
  }
  return { ...snapshotToResolved(buildCoachingSnapshot(live, new Date())), source: "live" };
}

function snapshotToResolved(s: CoachingSnapshot): Omit<ResolvedCoachingForDocs, "source"> {
  return {
    intitule: s.intitule,
    objectifsPedagogiques: s.objectifsPedagogiques ?? null,
    heuresPrevuesConvention: s.heuresPrevuesConvention ?? null,
    modalite: s.modalite,
    certificationType: s.certificationType ?? null,
    codeRncp: s.codeRncp ?? null,
    codeRs: s.codeRs ?? null,
    numeroEnregistrementFc: s.numeroEnregistrementFc ?? null,
  };
}

/**
 * Snapshot-on-first-emit IDEMPOTENT : à partir d'une CoachingSession déjà
 * chargée (avec `coachingSnapshot` + les champs `COACHING_SNAPSHOT_SELECT`),
 * retourne le snapshot existant, ou le construit, le PERSISTE et le retourne.
 *
 * Appelé au début de chaque générateur de document → le 1er document émis fige
 * le contenu, les suivants le réutilisent.
 */
export async function ensureCoachingSnapshot(
  cs: { id: string; coachingSnapshot: unknown } & CoachingSnapshotSource,
  now: Date = new Date(),
): Promise<CoachingSnapshot> {
  if (isUsableCoachingSnapshot(cs.coachingSnapshot)) {
    return cs.coachingSnapshot;
  }
  const snap = buildCoachingSnapshot(cs, now);
  await prisma.coachingSession.update({
    where: { id: cs.id },
    data: { coachingSnapshot: snap as never },
  });
  return snap;
}
