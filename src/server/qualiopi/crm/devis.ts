/**
 * Qualiopi — Lecture CRM devis + estimation prise en charge OPCO (Atlas).
 *
 * Stub-aware (try/catch → [] / null). Jamais de `*OrThrow`.
 * estimateOpcoCoverage est une fonction PURE async (lit les plafonds via
 * getQualiopiConfig) — mockable en test via vi.mock de @/server/qualiopi/config/site-settings.
 */

import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import {
  resolveBaremeOpco,
  tarifHoraireBaremeCents,
} from "@/server/qualiopi/financements/bareme-opco";
import {
  AVERTISSEMENT_BAREME_INCOMPLET,
  AVERTISSEMENT_HORS_FONDS_LEGAUX,
  AVERTISSEMENT_SANS_BAREME,
  horsFondsLegaux,
} from "@/server/qualiopi/financements/bareme-opco-branche";
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
  /** Enveloppe restante (centimes). Défaut : plafond annuel du barème résolu. */
  enveloppeRestanteCents?: number;
  /**
   * OPCO du client (Lot 5). Si un barème central versionné est en vigueur pour
   * cet OPCO, ses plafonds priment (champ par champ) sur les valeurs Atlas par
   * défaut. Absent ou barème introuvable → comportement Atlas inchangé.
   */
  opco?: string;
  /** Date de résolution du barème versionné (défaut : maintenant). */
  asOf?: Date;
  /** Lot A4 — IDCC de la branche du client (4 chiffres), oriente le barème. */
  idcc?: string;
  /** Lot A4 — effectif du client ; ≥ 50 → hors fonds légaux (art. L6332-17). */
  effectif?: number;
}

/** Lot A4 — d'où vient le chiffre estimé. */
export type OrigineEstimationOpco = "bareme" | "reglage_par_defaut" | "hors_fonds_legaux";

export interface OpcoCoverageResult {
  /** Montant estimé de prise en charge OPCO, en CENTIMES. */
  montantPriseEnChargeCents: number;
  /** Reste à charge client, en CENTIMES. */
  resteAChargeCents: number;
  /** Lot A4 — barème relevé, réglage par défaut (aucun barème), ou hors fonds légaux. */
  origine: OrigineEstimationOpco;
  /** Lot A4 — à afficher avec le chiffre quand il n'est pas adossé à un barème. */
  avertissement?: string;
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
  // Lot A4 — 50 salariés ou plus : pas de fonds légaux du plan de développement
  // des compétences (art. L6332-17 C. trav.). Effectif inconnu → pas de conclusion.
  if (horsFondsLegaux(input.effectif)) {
    return {
      montantPriseEnChargeCents: 0,
      resteAChargeCents: Math.max(0, input.montantHtCents),
      origine: "hors_fonds_legaux",
      avertissement: AVERTISSEMENT_HORS_FONDS_LEGAUX,
    };
  }

  const [tarifIntra, tarifInterPres, tarifInterDist, plafondAnnuel] = await Promise.all([
    getQualiopiConfig("opco_atlas_intra_horaire"),
    getQualiopiConfig("opco_atlas_inter_presentiel"),
    getQualiopiConfig("opco_atlas_inter_distanciel"),
    getQualiopiConfig("opco_atlas_plafond_annuel"),
  ]);

  // Tarifs Atlas par défaut (stockés en €/h → centimes/h).
  const atlasHoraireCents: number =
    input.modalite === "intra"
      ? Math.round(tarifIntra * 100)
      : input.modalite === "inter_presentiel"
        ? Math.round(tarifInterPres * 100)
        : Math.round(tarifInterDist * 100);
  const atlasAnnuelCents = Math.round(plafondAnnuel * 100);

  // Barème central versionné (Lot 5) : prime CHAMP PAR CHAMP s'il est renseigné.
  // Fallback Atlas conservé si l'OPCO est absent, inconnu, sans barème en vigueur
  // ou si le plafond concerné n'est pas encore relevé (structure vide).
  let tarifHoraireCents = atlasHoraireCents;
  let plafondAnnuelCents = atlasAnnuelCents;
  let origine: OrigineEstimationOpco = "reglage_par_defaut";
  let baremeCompleteParDefaut = false;
  if (input.opco) {
    const bareme = await resolveBaremeOpco(input.opco, input.asOf ?? new Date(), {
      ...(input.idcc !== undefined ? { idcc: input.idcc } : {}),
      ...(input.effectif !== undefined ? { effectif: input.effectif } : {}),
    });
    if (bareme) {
      origine = "bareme";
      const baremeHoraire = tarifHoraireBaremeCents(bareme, input.modalite);
      if (baremeHoraire != null) tarifHoraireCents = baremeHoraire;
      if (bareme.plafondAnnuelCents != null) plafondAnnuelCents = bareme.plafondAnnuelCents;
      // Un barème relevé mais INCOMPLET est complété par les réglages par défaut :
      // on le DIT, sinon « origine : barème » ferait passer un chiffre Atlas pour un relevé.
      baremeCompleteParDefaut = baremeHoraire == null || bareme.plafondAnnuelCents == null;
    }
  }

  // Enveloppe effective (défaut = plafond annuel)
  const enveloppe =
    input.enveloppeRestanteCents !== undefined ? input.enveloppeRestanteCents : plafondAnnuelCents;

  // Montant théorique (integer math : dureeHeures peut être décimal → utiliser *100/100)
  const theoriqueCents = Math.round(input.nbParticipants * input.dureeHeures * tarifHoraireCents);

  // Plafonnement successif
  const plafonnéParEnveloppe = Math.min(theoriqueCents, enveloppe);
  const montantPriseEnChargeCents = Math.min(plafonnéParEnveloppe, input.montantHtCents);

  const resteAChargeCents = Math.max(0, input.montantHtCents - montantPriseEnChargeCents);

  // Lot A4 — sans barème, le chiffre reste celui des réglages par défaut (pas de
  // régression commerciale), mais il est DIT indicatif.
  if (origine === "bareme" && baremeCompleteParDefaut) {
    return {
      montantPriseEnChargeCents,
      resteAChargeCents,
      origine,
      avertissement: AVERTISSEMENT_BAREME_INCOMPLET,
    };
  }
  return origine === "bareme"
    ? { montantPriseEnChargeCents, resteAChargeCents, origine }
    : {
        montantPriseEnChargeCents,
        resteAChargeCents,
        origine,
        avertissement: AVERTISSEMENT_SANS_BAREME,
      };
}
