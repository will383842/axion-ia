/**
 * Indicateur 10 dans le DOSSIER D'AUDIT D'UNE SESSION — la réponse de
 * l'organisme à chaque besoin d'adaptation déclaré, et sa date.
 *
 * Le dossier de session portait les pièces, les signatures et le journal des
 * envois ; rien n'y disait, stagiaire par stagiaire, « un besoin a été déclaré,
 * voici ce que l'organisme a répondu, et quand ». C'est pourtant la question que
 * l'auditrice pose sur cet indicateur.
 *
 * 🔴 DONNÉE DE SANTÉ (RGPD art. 9). Le DÉTAIL déclaré n'entre jamais ici : ce
 * module ne le reçoit pas. Il reçoit un booléen (« besoin déclaré ») et la
 * réponse de l'organisme — la MESURE prise, déjà imprimée sur la fiche
 * d'adaptation. Le besoin n'est jamais attribué à sa source (fiche ou
 * questionnaire) : dire « la fiche porte un détail » révélerait sans nécessité
 * qu'un détail existe.
 *
 * ⚠️ Module PUR : testable sans monter le ZIP.
 */

import { formaterInstantParis } from "../positionnement/lecture-positionnement";
import {
  decrireDateConsignation,
  estReponseAucuneAdaptation,
  etatReponseAdaptation,
  reponseAdaptationConsignee,
  type HorodatageCircuitAdaptation,
} from "./reponse-organisme";

export interface InscriptionAdaptationDossier {
  readonly stagiaire: string;
  readonly besoinDeclare: boolean;
  readonly adaptationsRealisees: string | null;
  /** Dates du circuit (journal, positionnement) — cf. `lireCircuitAdaptation`. */
  readonly horodatage: HorodatageCircuitAdaptation;
}

function libelleReponse(adaptationsRealisees: string | null): string {
  return estReponseAucuneAdaptation(adaptationsRealisees)
    ? "aucune adaptation nécessaire après échange"
    : `adaptation : « ${(adaptationsRealisees ?? "").trim()} »`;
}

export interface SectionIndicateur10 {
  readonly lignes: string[];
  /** Besoins déclarés SANS réponse consignée : l'appelant en fait un avertissement. */
  readonly nbAConsigner: number;
}

export const MENTION_DETAIL_NON_REPRODUIT =
  "  Le détail d'un besoin déclaré est une donnée de santé : il n'est jamais reproduit dans ce dossier.";

export function sectionIndicateur10(
  inscriptions: readonly InscriptionAdaptationDossier[],
  debutSession: Date,
): SectionIndicateur10 {
  const lignes: string[] = [
    "Adaptations — indicateur 10 (réponse de l'organisme aux besoins d'adaptation déclarés) :",
  ];
  let nbAConsigner = 0;
  let nbSansObjet = 0;

  for (const i of inscriptions) {
    const etat = etatReponseAdaptation(i.besoinDeclare, i.adaptationsRealisees, i.horodatage);
    if (etat === "sans_besoin") {
      nbSansObjet += 1;
      continue;
    }
    const besoin = i.besoinDeclare ? "besoin déclaré" : "aucun besoin déclaré";
    if (etat === "a_consigner") {
      nbAConsigner += 1;
      if (reponseAdaptationConsignee(i.adaptationsRealisees)) {
        // Réponse ANTÉRIEURE à une nouvelle déclaration : elle ne la couvre pas,
        // mais elle reste une trace — on la dit, datée, à côté du manque.
        const declaree = i.horodatage.derniereDeclarationLe;
        lignes.push(
          `  ${i.stagiaire} — ${besoin}${
            declaree !== null ? ` (nouvelle déclaration le ${formaterInstantParis(declaree)})` : ""
          } — AUCUNE RÉPONSE CONSIGNÉE à cette déclaration — réponse antérieure conservée, ${decrireDateConsignation(
            i.horodatage,
            debutSession,
          )} — ${libelleReponse(i.adaptationsRealisees)}`,
        );
      } else {
        lignes.push(`  ${i.stagiaire} — ${besoin} — AUCUNE RÉPONSE CONSIGNÉE`);
      }
      continue;
    }
    lignes.push(
      `  ${i.stagiaire} — ${besoin} — réponse ${decrireDateConsignation(
        i.horodatage,
        debutSession,
      )} — ${libelleReponse(i.adaptationsRealisees)}`,
    );
  }

  if (lignes.length === 1) {
    lignes.push(
      inscriptions.length === 0
        ? "  Aucun stagiaire inscrit."
        : "  Aucun besoin d'adaptation déclaré ni adaptation consignée pour les stagiaires de cette session.",
    );
  } else if (nbSansObjet > 0) {
    lignes.push(
      `  ${nbSansObjet} autre${nbSansObjet > 1 ? "s" : ""} stagiaire${nbSansObjet > 1 ? "s" : ""} sans besoin déclaré ni adaptation consignée.`,
    );
  }
  lignes.push(MENTION_DETAIL_NON_REPRODUIT);
  return { lignes, nbAConsigner };
}
