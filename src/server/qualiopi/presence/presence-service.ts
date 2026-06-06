/**
 * Qualiopi — Service de présence (T8).
 *
 * `recomputeTauxPresence` : lit tous les créneaux d'un enrollment, calcule le
 * taux et met à jour `Enrollment.tauxPresencePct` + le flag `present` de chaque
 * créneau.
 *
 * `upsertCreneau` : helper interne — idempotence sur [enrollmentId, date, demiJournee].
 *
 * Stub-aware (build GitHub Actions) : early-exit si `DATABASE_URL` contient
 * "stub.invalid" (le service de génération de doc peut être appelé depuis le
 * build SSG).
 */

import { prisma } from "@/lib/prisma";
import type { DemiJournee, PresenceSource } from "../../../../prisma/generated/client";
import { computeTauxPresence } from "./taux";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";

// ─────────────────────────────────────────────────────────────────────────────
// Types internes
// ─────────────────────────────────────────────────────────────────────────────

export interface UpsertCreneauInput {
  enrollmentId: string;
  date: Date;
  demiJournee: DemiJournee;
  libelle: string;
  dureePrevueMinutes: number;
  source: PresenceSource;
  present?: boolean;
  dureeRealiseeMinutes?: number;
  heureConnexion?: Date;
  heureDeconnexion?: Date;
  importId?: string;
  commentaire?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper interne — upsert idempotent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée ou met à jour un créneau de présence. Idempotence sur
 * `@@unique [enrollmentId, date, demiJournee]`. Retourne l'id du créneau.
 *
 * Stub-aware : retourne "stub-id" si DATABASE_URL contient "stub.invalid".
 */
export async function upsertCreneau(input: UpsertCreneauInput): Promise<string> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return "stub-id";

  const present = input.present ?? false;
  const dureeRealiseeMinutes = input.dureeRealiseeMinutes ?? 0;

  const row = await prisma.presenceCreneau.upsert({
    where: {
      enrollmentId_date_demiJournee: {
        enrollmentId: input.enrollmentId,
        date: input.date,
        demiJournee: input.demiJournee,
      },
    },
    create: {
      enrollmentId: input.enrollmentId,
      date: input.date,
      demiJournee: input.demiJournee,
      libelle: input.libelle,
      dureePrevueMinutes: input.dureePrevueMinutes,
      dureeRealiseeMinutes,
      present,
      source: input.source,
      ...(input.heureConnexion !== undefined ? { heureConnexion: input.heureConnexion } : {}),
      ...(input.heureDeconnexion !== undefined ? { heureDeconnexion: input.heureDeconnexion } : {}),
      ...(input.importId !== undefined ? { importId: input.importId } : {}),
      ...(input.commentaire !== undefined ? { commentaire: input.commentaire } : {}),
    },
    update: {
      libelle: input.libelle,
      dureePrevueMinutes: input.dureePrevueMinutes,
      dureeRealiseeMinutes,
      present,
      source: input.source,
      ...(input.heureConnexion !== undefined ? { heureConnexion: input.heureConnexion } : {}),
      ...(input.heureDeconnexion !== undefined ? { heureDeconnexion: input.heureDeconnexion } : {}),
      ...(input.importId !== undefined ? { importId: input.importId } : {}),
      ...(input.commentaire !== undefined ? { commentaire: input.commentaire } : {}),
    },
    select: { id: true },
  });

  return row.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recompute taux de présence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recompute le taux de présence d'un enrollment à partir de tous ses créneaux.
 *
 * Algorithme :
 *   1. Lit tous les `PresenceCreneau` de l'enrollment.
 *   2. Met à jour `present` de chaque créneau selon le seuil par créneau
 *      (réalisé ≥ 0.5 × prévu ; seuil fixe — cf. contrat T8 §AGENT B).
 *   3. Appelle `computeTauxPresence` (logique pure, AGENT A).
 *   4. Met à jour `Enrollment.tauxPresencePct`.
 *   5. Retourne le tauxPct.
 *
 * Stub-aware : retourne 0 si DATABASE_URL contient "stub.invalid".
 */
export async function recomputeTauxPresence(enrollmentId: string): Promise<number> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return 0;

  // Seuil de présence par créneau : fixe 0.5 (cf. contrat — "réalisé ≥ moitié du prévu")
  const SEUIL_CRENEAU = 0.5;

  // 1. Lecture des créneaux existants.
  const creneaux = await prisma.presenceCreneau.findMany({
    where: { enrollmentId },
    select: {
      id: true,
      dureePrevueMinutes: true,
      dureeRealiseeMinutes: true,
    },
  });

  if (creneaux.length === 0) {
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { tauxPresencePct: 0 },
    });
    return 0;
  }

  // 2. Calcul du flag `present` par créneau + mise à jour en DB.
  const updates: Array<{ id: string; present: boolean }> = creneaux.map((c) => ({
    id: c.id,
    present:
      c.dureePrevueMinutes > 0 && c.dureeRealiseeMinutes >= SEUIL_CRENEAU * c.dureePrevueMinutes,
  }));

  // Mise à jour parallèle des flags (best-effort batch).
  await Promise.all(
    updates.map((u) =>
      prisma.presenceCreneau.update({
        where: { id: u.id },
        data: { present: u.present },
      }),
    ),
  );

  // 3. Calcul du taux agrégé.
  const { tauxPct } = computeTauxPresence(
    creneaux.map((c) => ({
      dureePrevueMinutes: c.dureePrevueMinutes,
      dureeRealiseeMinutes: c.dureeRealiseeMinutes,
    })),
  );

  // 4. Mise à jour Enrollment.
  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { tauxPresencePct: tauxPct },
  });

  // 5. Lecture seuil présence complète depuis config (usage pour classifierPresence)
  // NOTE : la classification n'est pas stockée ici — elle est calculée à l'affichage.
  // On lit le seuil uniquement pour consommation aval (ex. doc PDF).
  await getQualiopiConfig("seuil_presence_pct"); // préchauffe le cache config

  return tauxPct;
}
