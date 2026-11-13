/**
 * Qualiopi ind. 30 — appréciations d'ESSAI écartées de la preuve (NC14).
 *
 * Trois lignes du 04/08 sont des essais (sans session ni inscription,
 * confirmés par Will). On ne les supprime pas, on ne les modifie pas : on les
 * marque « hors preuve », en AJOUT SEUL, dans une clé `SiteSetting` volontairement
 * hors du registre de configuration Qualiopi (préfixe sans `qualiopi.`).
 *
 * Aucune action « démarquer » : le marquage est une trace d'audit.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../prisma/generated/client";

export const CLE_APPRECIATIONS_HORS_PREUVE = "qualiopi_marquage.appreciations_hors_preuve";
export const MOTIF_MIN_CARACTERES = 10;

const marqueSchema = z.object({
  appreciationId: z.string().uuid(),
  motif: z.string(),
  marqueLe: z.string(),
  marquePar: z.string(),
});
const marquesSchema = z.array(marqueSchema);
export type MarqueHorsPreuve = z.infer<typeof marqueSchema>;

function lireMarques(value: unknown): MarqueHorsPreuve[] {
  const p = marquesSchema.safeParse(value);
  return p.success ? p.data : [];
}

/** Verrou consultatif : deux marquages simultanés se suivent au lieu de s'écraser. */
const VERROU_MARQUAGE = "qualiopi.appreciations_hors_preuve";

/** Marques lues, avec leur motif (pour la console). Vide si absent ou invalide. */
export async function lireMarquesHorsPreuve(): Promise<MarqueHorsPreuve[]> {
  const row = await prisma.siteSetting.findUnique({
    where: { key: CLE_APPRECIATIONS_HORS_PREUVE },
    select: { value: true },
  });
  return row ? lireMarques(row.value) : [];
}

/** Identifiants des appréciations d'essai. Ensemble vide si la clé est absente ou invalide. */
export async function lireAppreciationsHorsPreuve(): Promise<Set<string>> {
  return new Set((await lireMarquesHorsPreuve()).map((m) => m.appreciationId));
}

/**
 * Filtre Prisma à poser sur tout lecteur de PREUVE (ind. 30) : écarte les essais
 * marqués. Objet vide si rien n'est marqué (la requête reste identique à avant).
 */
export function filtreHorsPreuve(horsPreuve: ReadonlySet<string>): {
  where?: { id: { notIn: string[] } };
} {
  return horsPreuve.size > 0 ? { where: { id: { notIn: [...horsPreuve] } } } : {};
}

export type ResultatMarquage = { ok: true; dejaMarquee: boolean } | { ok: false; raison: string };

export async function marquerHorsPreuve(
  appreciationId: string,
  motif: string,
  adminId: string,
  /**
   * Écrit le journal DANS la transaction du marquage : une marque ne naît jamais
   * sans sa trace (si le journal lève, tout est annulé). Appelé seulement quand
   * une marque est réellement ajoutée.
   */
  journaliser?: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<ResultatMarquage> {
  const motifNet = motif.trim();
  if (motifNet.length < MOTIF_MIN_CARACTERES) {
    return {
      ok: false,
      raison: `Le motif est obligatoire (au moins ${MOTIF_MIN_CARACTERES} caractères).`,
    };
  }
  return prisma.$transaction(async (tx): Promise<ResultatMarquage> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${VERROU_MARQUAGE}))`;
    const existe = await tx.appreciation.findUnique({
      where: { id: appreciationId },
      select: { id: true },
    });
    if (!existe) return { ok: false, raison: "Appréciation introuvable." };

    const row = await tx.siteSetting.findUnique({
      where: { key: CLE_APPRECIATIONS_HORS_PREUVE },
      select: { value: true },
    });
    // Valeur existante illisible : on n'écrase JAMAIS l'historique en repartant de [].
    const lue = row ? marquesSchema.safeParse(row.value) : null;
    if (lue !== null && !lue.success) {
      return {
        ok: false,
        raison:
          "Le registre des marques « hors preuve » est illisible : rien n'a été écrit. À corriger avant tout nouveau marquage.",
      };
    }
    const marques = lue?.data ?? [];
    if (marques.some((m) => m.appreciationId === appreciationId)) {
      return { ok: true, dejaMarquee: true };
    }
    const suivantes = [
      ...marques,
      {
        appreciationId,
        motif: motifNet,
        marqueLe: new Date().toISOString(),
        marquePar: adminId,
      },
    ];
    await tx.siteSetting.upsert({
      where: { key: CLE_APPRECIATIONS_HORS_PREUVE },
      create: {
        key: CLE_APPRECIATIONS_HORS_PREUVE,
        value: suivantes,
        description: "Appréciations d'essai écartées de la preuve (ajout seul, ind. 30).",
        // `general`, pas `qualiopi` : le compteur `configKeysSet` du seed ne compte que
        // `qualiopi`, et cette clé n'est pas une clé du registre. (`SiteSettingCategory` est une
        // énumération : une catégorie dédiée demanderait une migration.)
        category: "general",
        updatedByAdminId: adminId,
      },
      update: { value: suivantes, updatedByAdminId: adminId },
    });
    if (journaliser) await journaliser(tx);
    return { ok: true, dejaMarquee: false };
  });
}
