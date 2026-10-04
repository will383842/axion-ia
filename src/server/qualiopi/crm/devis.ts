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
  /**
   * Enveloppe restante SAISIE sur le devis (centimes). Prime sur tout le reste.
   * Absente : plafond annuel (fiche client, sinon barème) − consommation de l'année.
   */
  enveloppeRestanteCents?: number;
  /**
   * Lot A7d — enveloppe annuelle propre au client (`Client.opcoEnveloppeAnnuelleCents`),
   * en centimes. Remplace le plafond annuel du barème comme base de calcul.
   */
  enveloppeAnnuelleClientCents?: number;
  /**
   * Lot A7d — ce que l'OPCO a déjà pris en charge pour ce client sur l'année
   * civile de la session (`consommationOpcoAnnee`). Accordé ET en cours sont
   * déduits : une demande déposée consommera l'enveloppe si elle est accordée,
   * et promettre deux fois la même somme serait pire que la sous-estimer.
   * Absente : consommation inconnue → comportement antérieur.
   */
  consommationAnnee?: { annee: number; accordeCents: number; enCoursCents: number };
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
  /** Lot A7d — consommation de l'année déduite de l'enveloppe, en centimes (si > 0). */
  consommationDeduiteCents?: number;
}

const eurosFr = (cents: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

/** Lot A7d — la phrase ajoutée à l'avertissement quand une consommation a été déduite. */
export function phraseConsommationDeduite(
  consommation: { annee: number; accordeCents: number; enCoursCents: number },
  enveloppeRestanteCents: number,
): string {
  const total = consommation.accordeCents + consommation.enCoursCents;
  const detail =
    consommation.enCoursCents > 0
      ? ` (${eurosFr(consommation.accordeCents)} accordés, ${eurosFr(consommation.enCoursCents)} demandés en cours)`
      : "";
  return (
    `Enveloppe annuelle ${consommation.annee} diminuée de ${eurosFr(total)} déjà pris en charge ` +
    `par l'OPCO pour ce client${detail} : il reste ${eurosFr(enveloppeRestanteCents)}.`
  );
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

  // Enveloppe effective (lot A7d) :
  //   1. saisie sur le devis → telle quelle ;
  //   2. sinon base annuelle (enveloppe de la fiche client, à défaut plafond du
  //      barème) − consommation de l'année, BORNÉE À 0 ;
  //   3. consommation inconnue → la base annuelle (comportement antérieur).
  const baseAnnuelleCents = input.enveloppeAnnuelleClientCents ?? plafondAnnuelCents;
  let consommationDeduiteCents = 0;
  let enveloppe: number;
  if (input.enveloppeRestanteCents !== undefined) {
    enveloppe = input.enveloppeRestanteCents;
  } else if (input.consommationAnnee !== undefined) {
    consommationDeduiteCents =
      Math.max(0, Math.round(input.consommationAnnee.accordeCents)) +
      Math.max(0, Math.round(input.consommationAnnee.enCoursCents));
    enveloppe = Math.max(0, baseAnnuelleCents - consommationDeduiteCents);
  } else {
    enveloppe = baseAnnuelleCents;
  }

  // Montant théorique (integer math : dureeHeures peut être décimal → utiliser *100/100)
  const theoriqueCents = Math.round(input.nbParticipants * input.dureeHeures * tarifHoraireCents);

  // Plafonnement successif
  const plafonnéParEnveloppe = Math.min(theoriqueCents, enveloppe);
  const montantPriseEnChargeCents = Math.min(plafonnéParEnveloppe, input.montantHtCents);

  const resteAChargeCents = Math.max(0, input.montantHtCents - montantPriseEnChargeCents);

  // Lot A4 — sans barème, le chiffre reste celui des réglages par défaut (pas de
  // régression commerciale), mais il est DIT indicatif.
  const avertissementBareme =
    origine === "bareme"
      ? baremeCompleteParDefaut
        ? AVERTISSEMENT_BAREME_INCOMPLET
        : undefined
      : AVERTISSEMENT_SANS_BAREME;
  // Lot A7d — une consommation déduite se DIT : sans elle, un chiffre plus bas
  // que d'habitude passerait pour une erreur de barème.
  const phraseConsommation =
    consommationDeduiteCents > 0 && input.consommationAnnee !== undefined
      ? phraseConsommationDeduite(input.consommationAnnee, enveloppe)
      : undefined;
  const avertissement = [avertissementBareme, phraseConsommation].filter(Boolean).join(" ");
  return {
    montantPriseEnChargeCents,
    resteAChargeCents,
    origine,
    ...(avertissement !== "" ? { avertissement } : {}),
    ...(consommationDeduiteCents > 0 ? { consommationDeduiteCents } : {}),
  };
}

/**
 * Lot A7d — la date à laquelle on lit le barème et l'année de l'enveloppe d'un
 * devis : la date de début PRÉVUE de la session liée (un devis d'octobre pour
 * une session de février relève du barème et de l'enveloppe de février), à
 * défaut la date de validité du devis, à défaut la date du jour.
 */
export function dateDeReferenceDevis(p: {
  debutSessionPrevue?: Date | null;
  dateValidite?: Date | null;
  maintenant: Date;
}): Date {
  return p.debutSessionPrevue ?? p.dateValidite ?? p.maintenant;
}
