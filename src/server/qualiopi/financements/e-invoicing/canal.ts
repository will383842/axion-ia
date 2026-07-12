/**
 * E-invoicing (Phase 6) — classification du CANAL RÉGLEMENTAIRE d'une facture.
 *
 * Réforme facturation électronique française (réception 1/9/2026, émission
 * TPE/PME 1/9/2027) — module PUR, testé isolément :
 *   - `chorus_pro`    : client secteur public → dépôt Chorus Pro (obligation
 *                       EN VIGUEUR, antérieure et distincte de la réforme) ;
 *   - `pa_einvoicing` : B2B France taxable → facture électronique via la
 *                       Plateforme Agréée (émission obligatoire 1/9/2027) ;
 *   - `e_reporting`   : B2C ou client étranger → transmission des données de
 *                       transaction (et de paiement pour les services) ;
 *   - `hors_champ`    : opération exonérée art. 261-4-4° CGI (formation
 *                       professionnelle continue) — exclue de l'e-invoicing
 *                       ET de l'e-reporting (art. 289 bis / 290 CGI).
 */

import type { ActiviteFacturation } from "../../../../../prisma/generated/client";
import type { RegimeTva } from "@/server/qualiopi/legal/tva";
import { ACTIVITES_EXONERABLES } from "@/server/qualiopi/financements/facture-libre-pur";

export type CanalReglementaire = "chorus_pro" | "pa_einvoicing" | "e_reporting" | "hors_champ";

export const CANAL_LABELS: Record<CanalReglementaire, string> = {
  chorus_pro: "Chorus Pro",
  pa_einvoicing: "PA (e-invoicing)",
  e_reporting: "E-reporting",
  hors_champ: "Hors champ (261-4-4°)",
};

export interface ClassifierCanalInput {
  activite: ActiviteFacturation | null;
  regimeTva: RegimeTva;
  /** Client secteur public (mairie, université, collectivité…). */
  clientEstPublic: boolean;
  /** Code pays ISO 3166-1 alpha-2 du client (null/FR = France). */
  clientPaysCode: string | null;
  /** Destinataire particulier (B2C). */
  clientEstParticulier: boolean;
}

/**
 * Classifie le canal réglementaire d'une facture. Ordre des règles :
 * public > exonération formation > étranger > B2C > B2B France taxable.
 * (Un client public reste Chorus Pro même pour une prestation exonérée —
 * l'obligation Chorus est organique, pas fiscale.)
 */
export function classifierCanalReglementaire(input: ClassifierCanalInput): CanalReglementaire {
  if (input.clientEstPublic) return "chorus_pro";

  const exoneree =
    input.regimeTva === "exoneration_261" &&
    input.activite !== null &&
    ACTIVITES_EXONERABLES.includes(input.activite);
  if (exoneree) return "hors_champ";

  const etranger = input.clientPaysCode !== null && input.clientPaysCode.toUpperCase() !== "FR";
  if (etranger) return "e_reporting";
  if (input.clientEstParticulier) return "e_reporting";

  return "pa_einvoicing";
}
