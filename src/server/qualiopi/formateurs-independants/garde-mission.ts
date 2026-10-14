/**
 * Garde de MISSION (lot L3, ADR 0066 (d)) — module PUR.
 *
 * Avant toute écriture d'affectation d'un formateur INDÉPENDANT (fiche de
 * session, création, report) et à la proposition, à l'acceptation, au renvoi et
 * à l'accord hors outil, une seule question : peut-il recevoir une mission
 * aujourd'hui ? Dans cet ordre :
 *   1. fiche active, collaboration non terminée ;
 *   2. contrat-cadre signé, dans la version EN VIGUEUR (lue dans l'instantané
 *      de la pièce signée, jamais dans une date saisie seule), et dont le SIRET
 *      figé est celui de la fiche (C4) ;
 *   3. contrôle du registre relu il y a un mois au plus ;
 *   4. numéro de déclaration d'activité renseigné ;
 *   5. attestation de vigilance URSSAF valable AUJOURD'HUI — seulement quand le
 *      cumul des honoraires HT a atteint le seuil de vigilance (lot G1).
 *
 * Les salariés et le dirigeant-formateur ne sont jamais concernés.
 *
 * 🔑 Le MODE (coupée / avertir / refuser) se décide ici aussi, d'un seul
 * endroit :
 *  - interrupteur `formateurs.garde_mission_portes` coupé : « coupée », c'est
 *    exactement le comportement d'avant L3 (décision de Will : tout livré
 *    éteint) ;
 *  - allumé : le niveau de `formateurs.garde_mission` (absent ou illisible =
 *    « refuser », règle du lot S0-ter) ; « avertir » ne vaut QUE pour l'ancien
 *    stock (`activationValideeSource = anterieure_au_controle`) — tout autre
 *    formateur est refusé.
 */

import { pieceGardeeProbante, type FormateurPourActivation } from "./gardes";
import type { NiveauGardeMission } from "./interrupteurs";
import { vigilanceExigible } from "./vigilance-seuil";

/** Un contrôle du registre plus vieux qu'un mois ne vaut plus (ADR 0066 (d)). */
export const REGISTRE_VALIDITE_MOIS = 1;

export interface FaitsGardeMission extends FormateurPourActivation {
  readonly actif: boolean;
  readonly finCollaborationAt: Date | null;
  readonly activationValideeSource: "controle" | "anterieure_au_controle" | null;
  /** Version du dernier contrat-cadre intégralement signé (instantané), ou `null`. */
  readonly contratCadreVersion: number | null;
  /** C4 — SIRET de la fiche. */
  readonly siret: string | null;
  /** C4 — SIRET figé dans ce même contrat (`siretDuContrat`), ou `null`. */
  readonly contratCadreSiret: string | null;
  /** Lot G1 — cumul des honoraires HT ; absent ou illisible : attestation exigée. */
  readonly cumulHonorairesHtCents?: number | null;
}

export const MANQUES_MISSION = {
  inactif: "La fiche du formateur n'est pas active.",
  finCollaboration: "La collaboration avec ce formateur est terminée.",
  contrat: "Le contrat-cadre en vigueur n'est pas signé.",
  siretContrat:
    "Le SIRET inscrit dans le contrat-cadre signé n'est plus celui de la fiche : un contrat à jour doit être signé.",
  registre: "Le contrôle du registre public date de plus d'un mois.",
  nda: "Le numéro de déclaration d'activité n'est pas renseigné.",
  vigilance: "L'attestation de vigilance URSSAF n'est pas valable aujourd'hui.",
  erreur: "Le contrôle du formateur n'a pas pu aboutir.",
} as const;

export type VerdictMission =
  { readonly ok: true } | { readonly ok: false; readonly manques: ReadonlyArray<string> };

function ilYaMois(maintenant: Date, mois: number): Date {
  const d = new Date(maintenant.getTime());
  d.setUTCMonth(d.getUTCMonth() - mois);
  return d;
}

/** Le formateur peut-il recevoir une mission aujourd'hui ? Pur ; échoue fermé. */
export function peutRecevoirMission(
  f: FaitsGardeMission,
  versionContratEnVigueur: number,
  maintenant: Date = new Date(),
): VerdictMission {
  try {
    if (f.statut === "salarie" || f.statut === "dirigeant") return { ok: true };
    const manques: string[] = [];
    if (!f.actif) manques.push(MANQUES_MISSION.inactif);
    if (f.finCollaborationAt !== null) manques.push(MANQUES_MISSION.finCollaboration);
    const signe =
      f.sousTraitantContratSigneAt !== null &&
      f.sousTraitantContratSigneAt.getTime() <= maintenant.getTime();
    if (!signe || (f.contratCadreVersion ?? 0) < versionContratEnVigueur) {
      manques.push(MANQUES_MISSION.contrat);
    } else {
      const siret = (f.siret ?? "").replace(/\s+/g, "");
      if (siret === "" || (f.contratCadreSiret ?? "").replace(/\s+/g, "") !== siret) {
        manques.push(MANQUES_MISSION.siretContrat);
      }
    }
    const verifie = f.sousTraitantVerifieAt;
    if (
      verifie === null ||
      verifie.getTime() > maintenant.getTime() ||
      verifie.getTime() < ilYaMois(maintenant, REGISTRE_VALIDITE_MOIS).getTime()
    ) {
      manques.push(MANQUES_MISSION.registre);
    }
    if ((f.sousTraitantNda ?? "").trim() === "") manques.push(MANQUES_MISSION.nda);
    if (
      vigilanceExigible(f.cumulHonorairesHtCents) &&
      !f.pieces.some((p) => pieceGardeeProbante(p, "attestation_vigilance_urssaf", maintenant))
    ) {
      manques.push(MANQUES_MISSION.vigilance);
    }
    return manques.length === 0 ? { ok: true } : { ok: false, manques };
  } catch {
    return { ok: false, manques: [MANQUES_MISSION.erreur] };
  }
}

export type ModeGardeMission = "coupee" | "avertir" | "refuser";

/** Le mode qui s'applique à CE formateur. */
export function modeGardeMission(
  portesAllumees: boolean,
  niveau: NiveauGardeMission,
  source: FaitsGardeMission["activationValideeSource"],
): ModeGardeMission {
  if (!portesAllumees) return "coupee";
  return niveau === "avertir" && source === "anterieure_au_controle" ? "avertir" : "refuser";
}

export interface IssueGarde {
  /** Non vide : l'écriture est REFUSÉE, avec ces raisons. */
  readonly refus: ReadonlyArray<string>;
  /** Raisons dites sans bloquer (mode « avertir »). */
  readonly avertissements: ReadonlyArray<string>;
}

export const AUCUNE_ISSUE: IssueGarde = { refus: [], avertissements: [] };

export function appliquerGarde(mode: ModeGardeMission, verdict: VerdictMission): IssueGarde {
  if (mode === "coupee" || verdict.ok) return AUCUNE_ISSUE;
  return mode === "refuser"
    ? { refus: verdict.manques, avertissements: [] }
    : { refus: [], avertissements: verdict.manques };
}
