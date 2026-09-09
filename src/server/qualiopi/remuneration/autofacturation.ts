/**
 * Qualiopi — Autofacturation des honoraires de sous-traitance (module PUR).
 *
 * Étape 3 du chantier « payer les formateurs ». Aucune lecture Prisma, aucune
 * horloge implicite : ce module DÉCIDE, il n'écrit rien. L'émission, la pièce
 * et la transmission vivent ailleurs — et c'est voulu, parce que la partie
 * coûteuse à se tromper est celle-ci.
 *
 * ── CE QU'EST L'AUTOFACTURATION, ET CE QU'ELLE N'EST PAS ────────────────────
 *
 * Ce n'est PAS « une facture de plus qu'on émet ». C'est la facture DU
 * SOUS-TRAITANT, que l'organisme établit **en son nom et pour son compte**, sur
 * mandat. Le sous-traitant reste le fournisseur et demeure seul redevable de la
 * TVA mentionnée. Trois conséquences qui traversent tout ce module :
 *
 *   · le VENDEUR de la pièce est le formateur, l'ACHETEUR est l'organisme —
 *     l'inverse de toutes les autres factures du dépôt ;
 *   · la pièce porte l'identité fiscale DU FORMATEUR (SIRET, n° de TVA
 *     intracommunautaire s'il y est assujetti), pas celle de l'organisme ;
 *   · le numéro appartient à une série PROPRE (`AXI-AUTOF`) : intercaler des
 *     pièces d'achat dans la série des ventes ferait mentir la continuité que
 *     cette série est censée garantir.
 *
 * ── LES QUATRE ÉLÉMENTS, ET POURQUOI ON REFUSE PLUTÔT QUE D'ÉMETTRE ─────────
 *
 * 🔴 Une facture d'autofacturation est régulière si, et seulement si, elle
 * réunit : un mandat écrit et **préalable**, la mention « Autofacturation »,
 * l'émission au nom et pour le compte du sous-traitant, et un droit de
 * contestation. **Il en manque un seul et la pièce est irrégulière : la TVA
 * qu'elle porte n'est pas déductible.**
 *
 * Ce n'est donc pas un domaine où l'on émet « au mieux » en signalant les
 * manques. `verifierEligibiliteAutofacture` REFUSE, et il rend la LISTE des
 * motifs plutôt que le premier rencontré — un opérateur qui découvre les
 * obstacles un par un, à chaque tentative, finit par croire qu'il n'en reste
 * plus qu'un.
 *
 * ⚠️ Calendrier de la réforme : au 1ᵉʳ septembre 2026 toutes les entreprises
 * doivent pouvoir **RECEVOIR** une facture électronique ; l'obligation
 * d'**ÉMETTRE** ne touche les TPE/PME qu'au 1ᵉʳ septembre 2027. Il y a donc de
 * la marge sur l'émission — mais l'autofacturation doit naître conforme, parce
 * qu'une pièce irrégulière ne se rattrape pas après coup.
 *
 * ⚠️ NE PAS TRANSPOSER À UN APPORTEUR. Ce module encadre le paiement d'une
 * DETTE (une prestation faite, un délai qui court). Une commission d'apport est
 * un DROIT dont on définit le fait générateur — l'encaissement du client — et
 * l'analogie s'arrête là. Cf. `contrat-sous-traitance.tsx` et le contrat v1
 * d'Axion Partners.
 */

import type { StatementStatut } from "./run";
import type { TvaRegimeHonoraires } from "./calcul";

/**
 * Mention obligatoire portée par la pièce. Constante, et pas une chaîne écrite
 * dans le gabarit : c'est l'un des quatre éléments de régularité, et un gabarit
 * peut être reformulé par mégarde. La garde lit CETTE valeur.
 */
export const MENTION_AUTOFACTURATION = "Autofacturation" as const;

/**
 * Mention d'émission déléguée. « Au nom et pour le compte de » n'est pas une
 * formule de style : c'est ce qui dit au lecteur, et à l'administration, qui
 * est le fournisseur de l'opération.
 */
export const MENTION_POUR_LE_COMPTE = "Facture établie au nom et pour le compte de" as const;

/**
 * Fenêtre de contestation, en jours, à compter de la TRANSMISSION.
 *
 * 8 jours : clause 4 bis du contrat de sous-traitance. Passé ce terme la pièce
 * est réputée acceptée.
 *
 * ⚠️ Le délai court depuis la transmission, jamais depuis l'émission. Une pièce
 * émise et non transmise ne fait courir aucun délai — sinon la fenêtre se
 * refermerait sur un formateur qui n'a jamais rien reçu, et la contrepartie que
 * la clause promet serait vidée de son sens.
 */
export const DELAI_CONTESTATION_JOURS = 8;

/** Terme de la fenêtre de contestation. PURE : ne mute pas la date reçue. */
export function dateLimiteContestation(transmiseAt: Date): Date {
  const limite = new Date(transmiseAt.getTime());
  limite.setDate(limite.getDate() + DELAI_CONTESTATION_JOURS);
  return limite;
}

/** Ce qu'il faut savoir du sous-traitant pour émettre en son nom. */
export interface SousTraitantAutofacture {
  readonly siret: string | null;
  readonly numeroTvaIntracom: string | null;
  readonly adresseProfessionnelle: string | null;
  readonly mandatAutofacturationSigneAt: Date | null;
  readonly mandatAutofacturationRevoqueAt: Date | null;
}

/** Ce qu'il faut savoir du relevé pour décider s'il peut être autofacturé. */
export interface ReleveAutofacturable {
  readonly statut: StatementStatut;
  readonly tvaRegime: TvaRegimeHonoraires;
  readonly totalTtcCents: number;
  readonly numeroFacture: string | null;
  readonly autofactureAt: Date | null;
}

/**
 * Le mandat est-il EN VIGUEUR à une date donnée ?
 *
 * 🔑 « Préalable » se vérifie contre la date d'émission de la pièce, pas contre
 * aujourd'hui. Un mandat signé le 15 ne régularise pas une facture datée du 10 :
 * la signature postérieure ne rétroagit pas, et une pièce émise hors mandat
 * reste irrégulière quoi qu'on signe ensuite. C'est pour cela que la colonne est
 * une DATE et non un booléen.
 *
 * La révocation est symétrique et sans effet rétroactif : une pièce émise avant
 * la révocation reste régulière. On lit donc l'intervalle, jamais un drapeau.
 *
 * Bornes : signature INCLUSE (un mandat signé le matin couvre la pièce du jour),
 * révocation EXCLUE (le jour de la révocation, le mandat ne couvre plus).
 */
export function mandatEnVigueur(st: SousTraitantAutofacture, at: Date): boolean {
  if (st.mandatAutofacturationSigneAt === null) return false;
  if (st.mandatAutofacturationSigneAt.getTime() > at.getTime()) return false;
  if (st.mandatAutofacturationRevoqueAt === null) return true;
  return st.mandatAutofacturationRevoqueAt.getTime() > at.getTime();
}

/**
 * Motifs de refus. Chacun nomme le geste qui le lève — un refus qui n'indique
 * pas quoi faire renvoie l'opérateur vers celui qui a écrit le code.
 */
export type MotifRefusAutofacture =
  | "releve_non_valide"
  | "releve_sans_montant"
  | "facture_deja_presente"
  | "mandat_absent_ou_revoque"
  | "siret_manquant"
  | "tva_intracom_manquante"
  | "adresse_manquante";

export const LIBELLE_REFUS_AUTOFACTURE: Readonly<Record<MotifRefusAutofacture, string>> = {
  releve_non_valide:
    "Le relevé n'est pas validé. La facture est émise APRÈS validation du relevé de la période (fait générateur, clause 4) — valider d'abord.",
  releve_sans_montant: "Le relevé est à 0 € : il n'y a rien à facturer.",
  facture_deja_presente:
    "Une facture est déjà rattachée à ce relevé. Émettre une seconde pièce pour la même période créerait un doublon comptable.",
  mandat_absent_ou_revoque:
    "Aucun mandat de facturation en vigueur à cette date. Sans mandat écrit et préalable, la pièce est irrégulière et sa TVA non déductible — à défaut de mandat, c'est le sous-traitant qui émet sa facture.",
  siret_manquant:
    "Le SIRET du sous-traitant manque. Nous émettons EN SON NOM : sa facture doit porter son SIRET (art. 242 nonies A CGI). Renseignez-le sur sa fiche.",
  tva_intracom_manquante:
    "Le sous-traitant est assujetti à la TVA et son numéro de TVA intracommunautaire manque. C'est une mention obligatoire de la pièce.",
  adresse_manquante:
    "L'adresse professionnelle du sous-traitant manque : la facture doit identifier les deux parties.",
};

export type EligibiliteAutofacture =
  | { readonly eligible: true }
  | { readonly eligible: false; readonly refus: readonly MotifRefusAutofacture[] };

/**
 * Le relevé peut-il être autofacturé à la date `emissionAt` ?
 *
 * 🔑 Rend TOUS les motifs, jamais le premier. Un opérateur qui corrige un
 * obstacle, réessaie, en découvre un deuxième, corrige, réessaie… n'apprend
 * jamais combien il en reste. Ici il voit la liste et fait le tour en une fois.
 */
export function verifierEligibiliteAutofacture(
  releve: ReleveAutofacturable,
  sousTraitant: SousTraitantAutofacture,
  emissionAt: Date,
): EligibiliteAutofacture {
  const refus: MotifRefusAutofacture[] = [];

  // Fait générateur : la facture est émise après réalisation ET validation du
  // relevé (clause 4). Émettre depuis `a_valider` facturerait des heures que
  // personne n'a arrêtées.
  if (releve.statut !== "valide") refus.push("releve_non_valide");
  if (releve.totalTtcCents <= 0) refus.push("releve_sans_montant");
  if (releve.numeroFacture !== null || releve.autofactureAt !== null) {
    refus.push("facture_deja_presente");
  }

  if (!mandatEnVigueur(sousTraitant, emissionAt)) refus.push("mandat_absent_ou_revoque");

  if (sousTraitant.siret === null || sousTraitant.siret.trim() === "") {
    refus.push("siret_manquant");
  }
  // ⚠️ Le n° de TVA n'est exigé QUE de l'assujetti. Le réclamer en franchise
  // 293 B ou en exonération formation produirait un refus qu'aucun geste ne
  // lève : ces régimes n'ont pas de numéro à donner.
  if (
    releve.tvaRegime === "assujetti_20" &&
    (sousTraitant.numeroTvaIntracom === null || sousTraitant.numeroTvaIntracom.trim() === "")
  ) {
    refus.push("tva_intracom_manquante");
  }
  if (
    sousTraitant.adresseProfessionnelle === null ||
    sousTraitant.adresseProfessionnelle.trim() === ""
  ) {
    refus.push("adresse_manquante");
  }

  return refus.length === 0 ? { eligible: true } : { eligible: false, refus };
}

/**
 * La pièce est-elle encore contestable ?
 *
 * Rend `false` quand aucune fenêtre n'a été ouverte (pièce non transmise) : une
 * fenêtre qu'on n'a pas ouverte n'est pas une fenêtre expirée, et la distinction
 * compte — c'est celle entre « le formateur a laissé passer » et « le formateur
 * n'a jamais reçu la pièce ».
 */
export function contestationOuverte(
  releve: { readonly contestationAvantAt: Date | null; readonly contesteeAt: Date | null },
  now: Date,
): boolean {
  if (releve.contestationAvantAt === null) return false;
  if (releve.contesteeAt !== null) return false;
  return releve.contestationAvantAt.getTime() > now.getTime();
}
