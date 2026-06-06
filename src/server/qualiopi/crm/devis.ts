/**
 * Qualiopi — Lecture CRM devis + estimation prise en charge OPCO (Atlas).
 *
 * Stub-aware (try/catch → [] / null). Jamais de `*OrThrow`.
 * estimateOpcoCoverage est une fonction PURE async (lit les plafonds via
 * getQualiopiConfig) — mockable en test via vi.mock de @/server/qualiopi/config/site-settings.
 */

import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import type { Devis } from "@/server/qualiopi/crm/types";

export interface ListDevisOpts {
  /** Filtre par clientId UUID. */
  clientId?: string;
}

/** Tous les devis, triés par numéro. Stub-safe → [] au build. */
export async function listDevis(opts?: ListDevisOpts): Promise<Devis[]> {
  try {
    const rows = await prisma.devis.findMany({
      ...(opts?.clientId ? { where: { clientId: opts.clientId } } : {}),
      orderBy: { numero: "asc" },
    });
    return rows;
  } catch {
    return [];
  }
}

/** Devis par id UUID. Stub-safe → null. */
export async function getDevis(id: string): Promise<Devis | null> {
  try {
    return await prisma.devis.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Estimation prise en charge OPCO Atlas
// ─────────────────────────────────────────────────────────────────────────────

export interface OpcoCoverageInput {
  nbParticipants: number;
  dureeHeures: number;
  modalite: "intra" | "inter_presentiel" | "inter_distanciel";
  /** Montant HT de la prestation en CENTIMES. */
  montantHtCents: number;
  /** Enveloppe restante (centimes). Défaut : plafond annuel Atlas. */
  enveloppeRestanteCents?: number;
}

export interface OpcoCoverageResult {
  /** Montant estimé de prise en charge OPCO, en CENTIMES. */
  montantPriseEnChargeCents: number;
  /** Reste à charge client, en CENTIMES. */
  resteAChargeCents: number;
}

/**
 * Calcule l'estimation de prise en charge OPCO Atlas pour un devis.
 *
 * Logique :
 * 1. Résoudre le tarif horaire selon la modalité (centimes/h/participant)
 *    depuis getQualiopiConfig (clés `opco_atlas_*`).
 * 2. Théorique = nbParticipants × dureeHeures × tarifHoraireCents.
 * 3. Plafonner par enveloppeRestanteCents (défaut = plafond_annuel × 100).
 * 4. Plafonner par montantHtCents (OPCO ne couvre pas plus que la facture).
 * 5. resteACharge = max(0, montantHtCents − priseEnCharge).
 *
 * Tous montants en CENTIMES. Aucun arrondi intermédiaire (Integer math).
 */
export async function estimateOpcoCoverage(input: OpcoCoverageInput): Promise<OpcoCoverageResult> {
  const [tarifIntra, tarifInterPres, tarifInterDist, plafondAnnuel] = await Promise.all([
    getQualiopiConfig("opco_atlas_intra_horaire"),
    getQualiopiConfig("opco_atlas_inter_presentiel"),
    getQualiopiConfig("opco_atlas_inter_distanciel"),
    getQualiopiConfig("opco_atlas_plafond_annuel"),
  ]);

  // Tarifs stockés en €/h → convertir en centimes/h
  const tarifHoraireCents: number =
    input.modalite === "intra"
      ? Math.round(tarifIntra * 100)
      : input.modalite === "inter_presentiel"
        ? Math.round(tarifInterPres * 100)
        : Math.round(tarifInterDist * 100);

  // Plafond annuel en centimes
  const plafondAnnuelCents = Math.round(plafondAnnuel * 100);

  // Enveloppe effective (défaut = plafond annuel)
  const enveloppe =
    input.enveloppeRestanteCents !== undefined ? input.enveloppeRestanteCents : plafondAnnuelCents;

  // Montant théorique (integer math : dureeHeures peut être décimal → utiliser *100/100)
  const theoriqueCents = Math.round(input.nbParticipants * input.dureeHeures * tarifHoraireCents);

  // Plafonnement successif
  const plafonnéParEnveloppe = Math.min(theoriqueCents, enveloppe);
  const montantPriseEnChargeCents = Math.min(plafonnéParEnveloppe, input.montantHtCents);

  const resteAChargeCents = Math.max(0, input.montantHtCents - montantPriseEnChargeCents);

  return { montantPriseEnChargeCents, resteAChargeCents };
}
