// Les TEXTES de la page « Mes commissions » (lecture seule). Vouvoiement. Un seul fichier, mot
// pour mot celui du plan « espace-commissions » §10 (à faire relire par la direction).
// Aucune promesse de gain, aucun objectif, compteur, classement ni compte à rebours.

import type { EtatPrincipal } from "@/features/apporteurs-reseau/etat-commission";

export const TEXTES_COMMISSIONS = {
  titre: "Mes commissions",
  sousTitre: "L'état de vos présentations et de vos commissions.",
  retour: "← Retour à mon espace",
  virementTitre: "Virement à venir",
  entreprisesTitre: "Mes entreprises",
  horsEntrepriseTitre: "Hors entreprise",
  piecesTitre: "Mes factures et mes avoirs",
  aucuneEntreprise: "Aucune entreprise présentée.",
  aucuneFacture: "Aucune facture pour l'instant.",
  borne: "Les plus anciennes ne sont pas affichées. Écrivez-nous pour les obtenir.",
  commentTitre: "Comment lire cette page",
  comment: [
    "Votre commission est due quand le client a payé toute sa commande.",
    "Nous établissons alors la facture à votre nom et nous faisons le virement au plus tard 30 jours après ce paiement.",
    "Si le client est remboursé, la commission est ajustée au prorata du remboursement ; si elle vous a déjà été versée, elle est reprise.",
    "La facture en PDF est la pièce qui fait foi.",
  ],
  grille: "Grille des commissions",
  presentee: (d: string) => `Présentée le ${d}`,
  validee: (d: string) => `Validée le ${d}`,
  reserveeJusquAu: (d: string) => `Réservée jusqu'au ${d}`,
  commission: (m: string) => `Commission : ${m} hors taxes`,
  factureDu: (n: string, d: string) => `Facture n° ${n} du ${d}`,
  avoirDu: (n: string, d: string) => `Avoir n° ${n} · ${d}`,
  echeance: (d: string) => `Échéance indiquée sur la facture : ${d}`,
  netApresAvoirs: "Montant net, après déduction des avoirs éventuels.",
  ht: (m: string) => `${m} hors taxes`,
  assujetti: (ht: string, tva: string, ttc: string) =>
    `${ht} hors taxes · TVA 20 % : ${tva} · ${ttc} toutes taxes comprises`,
  franchise: (ht: string) =>
    `${ht} hors taxes · TVA non applicable, article 293 B du code général des impôts`,
  regimeInconnu: (ht: string) => `${ht} hors taxes · TVA : en vérification`,
  montantEnVerification: "Montant en vérification",
  telechargerFacture: (n: string) => `Télécharger la facture ${n}`,
  telechargerAvoir: (n: string) => `Télécharger l'avoir ${n}`,
  parrainage: (n: string, m: string | null, etat: string) =>
    `Parrainage · facture n° ${n}${m ? ` · ${m} hors taxes` : ""} · ${etat}`,
} as const;

export interface DonneesEtat {
  facture: string | null;
  factureLe: string | null;
  echeanceLe: string | null;
  verseeLe: string | null;
  avoir: string | null;
  montant: string | null;
  motifManquant?: string | null;
}

export function texteEtat(etat: EtatPrincipal, d: DonneesEtat): string | null {
  switch (etat) {
    case "suspendue":
      return "Suspendue : le client conteste la prestation. Nous vous avons écrit à ce sujet.";
    case "facturee":
      return `Commission due · facture n° ${d.facture ?? ""}${d.factureLe ? ` du ${d.factureLe}` : ""}${d.echeanceLe ? ` · échéance indiquée sur la facture : ${d.echeanceLe}` : ""}`;
    case "a_preciser":
      return "Payée par le client. Montant en cours de calcul.";
    case "en_attente_pieces":
      return "Nous attendons votre attestation de vigilance et votre justificatif d'immatriculation. Vous pouvez les déposer depuis votre espace.";
    case "en_attente_fiche":
      return "Il nous manque une information pour établir votre facture. Écrivez-nous.";
    case "en_attente_fiche_solde_negatif":
      return "Une reprise reste à déduire avant le prochain versement.";
    case "due":
      return "Commission due. Facture en préparation.";
    case "versee":
      return d.verseeLe ? `Réglée le ${d.verseeLe}` : "Réglée";
    case "sans_commission":
      return "Cette prestation ne donne pas de commission.";
    case "reprise_a_deduire":
      return `Reprise de ${d.montant ?? "—"} hors taxes : elle sera déduite de vos prochaines commissions.`;
    case "reprise_deduite":
      return `Reprise de ${d.montant ?? "—"} hors taxes, déduite${d.avoir ? ` · avoir n° ${d.avoir}` : ""}`;
    case "annulee":
      return "Annulée";
    case "retenue":
      return `Retenue.${d.avoir ? ` Un avoir n° ${d.avoir} l'annule.` : ""} Nous vous avons écrit à ce sujet.`;
    case "masquee":
      return null;
  }
}
