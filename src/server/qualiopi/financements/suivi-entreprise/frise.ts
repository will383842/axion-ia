/**
 * Lot OPCO A8 — la frise du suivi de l'entreprise, pour `DepotOpcoPanel`
 * (module PUR à partir du contexte lu).
 *
 * Envoyé le, relances faites, réponses reçues (date + « oui / pas encore /
 * accord / refus »), prochaine relance prévue, arrêt éventuel. Aucune adresse,
 * aucun jeton : la frise ne dit que des dates et des réponses fermées.
 */

import type { ContexteSuivi } from "./lecture";
import { jourParis, prochaineRelancePrevue, type ReponseEntreprise } from "./planning";

export interface EvenementFrise {
  /** AAAA-MM-JJ (Paris). */
  jour: string;
  libelle: string;
}

export interface FriseSuivi {
  envoyeLe: string;
  envoiAutomatique: boolean;
  evenements: EvenementFrise[];
  relancesFaites: number;
  prochaineRelance: { jour: string; libelle: string } | null;
  relancesArreteesLe: string | null;
  accordFichierDepose: boolean;
}

export const LIBELLE_REPONSE_COURT: Record<ReponseEntreprise, string> = {
  oui: "oui, déposé",
  pas_encore: "pas encore",
  accord: "accord",
  refus: "refus",
};

function libelleEtape(etape: string, rang: number): string {
  if (etape === "envoi") return rang === 0 ? "Dossier envoyé" : "Dossier renvoyé";
  if (etape === "relance_depot") return `Relance dépôt n° ${rang}`;
  return `Relance réponse OPCO n° ${rang}`;
}

export function friseSuivi(c: ContexteSuivi, now: Date): FriseSuivi | null {
  const s = c.suivi;
  if (!s) return null;
  const evenements: EvenementFrise[] = [];
  for (const m of s.messages) {
    evenements.push({ jour: m.jourParis, libelle: libelleEtape(m.etape, m.rang) });
    if (m.reponse && m.reponduLe) {
      evenements.push({
        jour: jourParis(m.reponduLe),
        libelle: `Réponse de l'entreprise : ${LIBELLE_REPONSE_COURT[m.reponse]}`,
      });
    }
  }
  evenements.sort((a, b) => a.jour.localeCompare(b.jour));
  const prochaine = prochaineRelancePrevue(c.dossier, s, now);
  return {
    envoyeLe: jourParis(s.envoyeLe),
    envoiAutomatique: c.brut.suiviEntreprise?.envoiAutomatique === true,
    evenements,
    relancesFaites: s.messages.filter((m) => m.etape !== "envoi").length,
    prochaineRelance: prochaine
      ? {
          jour: prochaine.jour,
          libelle:
            prochaine.etape === "relance_depot"
              ? `relance dépôt n° ${prochaine.rang}`
              : `relance réponse OPCO n° ${prochaine.rang}`,
        }
      : null,
    relancesArreteesLe: s.relancesArreteesLe ? jourParis(s.relancesArreteesLe) : null,
    accordFichierDepose: c.brut.suiviEntreprise?.accordFichierKey != null,
  };
}
