/**
 * Qualiopi — Lecture des barèmes de rémunération d'un formateur (pilier C).
 *
 * Aucune règle métier : la résolution versionnée vit dans `calcul.ts`. Ici on ne
 * fait que présenter les versions telles qu'elles sont en base, la plus récente
 * d'abord, pour que l'opérateur voie l'HISTORIQUE — une règle close n'est jamais
 * supprimée, elle reste visible avec sa fenêtre de validité.
 *
 * Stub-aware (try/catch → []). Jamais de `*OrThrow`.
 */

import { prisma } from "@/lib/prisma";
import type { CompensationModel } from "./calcul";

export interface RegleView {
  id: string;
  model: CompensationModel;
  /** Libellé du type de prestation ciblé, ou `null` = barème global du formateur. */
  prestationType: string | null;
  /** Slug d'intervention ciblé, ou `null` = tous. */
  interventionSlug: string | null;
  tauxJourneeHtCents: number | null;
  tauxHoraireHtCents: number | null;
  /** Pourcentage (Decimal Prisma → number). */
  commissionPct: number | null;
  forfaitHtCents: number | null;
  effectiveFrom: Date;
  /** `null` = règle toujours en vigueur (non close). */
  effectiveTo: Date | null;
  note: string | null;
}

/**
 * Toutes les versions de barème d'un formateur, cibles confondues, de la plus
 * récente à la plus ancienne. Les règles closes sont incluses : elles expliquent
 * pourquoi une ligne passée porte tel taux (intangibilité comptable).
 */
export async function listReglesFormateur(trainerId: string): Promise<RegleView[]> {
  try {
    const rows = await prisma.trainerCompensationRule.findMany({
      where: { trainerId },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      model: r.model,
      prestationType: r.prestationType,
      interventionSlug: r.interventionSlug,
      tauxJourneeHtCents: r.tauxJourneeHtCents,
      tauxHoraireHtCents: r.tauxHoraireHtCents,
      // Decimal | null → number | null. Le moteur ne voit jamais un Decimal.
      commissionPct: r.commissionPct === null ? null : r.commissionPct.toNumber(),
      forfaitHtCents: r.forfaitHtCents,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
      note: r.note,
    }));
  } catch {
    return [];
  }
}

/** Une formation, réduite à ce qu'un sélecteur de barème ciblé affiche. */
export interface FormationOption {
  slug: string;
  titre: string;
}

/**
 * Formations actives, pour cibler un barème sur une intervention précise. On
 * renvoie le `slug` (et non l'id) car c'est lui que `resolveRegle` compare à
 * `interventionSlug` — passer l'id créerait une cible qui ne matcherait jamais.
 */
export async function listFormationOptions(): Promise<FormationOption[]> {
  try {
    const rows = await prisma.formation.findMany({
      // Actives OU publiées — tout sauf archivées. Filtrer sur `actif` seul
      // masquerait les formations `publie`, qui sont pourtant bien animables.
      where: { statut: { not: "archive" } },
      select: { slug: true, titre: true },
      orderBy: { titre: "asc" },
    });
    return rows.map((r) => ({ slug: r.slug, titre: r.titre }));
  } catch {
    return [];
  }
}
