/**
 * Conditions tarifaires des formations — SOURCE UNIQUE de ce que les pages de
 * prix en disent.
 *
 * 🔴 2026-10-16 (lot L16, NC7) — Décision de Will : « prix fixe, sans surprise »
 * est RETIRÉ. Ce slogan promettait une absence de surprise que les conditions
 * générales ne garantissent pas : annulation tardive facturée, TVA, pénalités de
 * retard, somme restant due si l'OPCO refuse. Un client qui lit « sans surprise »
 * puis découvre le barème d'annulation dans la convention a une mention trompeuse
 * sous les yeux. On dit donc les conditions elles-mêmes.
 *
 * ⚠️ Chaque chiffre ci-dessous est une COPIE des conditions générales
 * (`legal.ts`, sections « Prix », « Conditions de paiement », « Annulation, report
 * et remboursement », « Financement par un OPCO »). La copie est gardée par
 * `l16-concordance-du-site.spec.ts`, qui rougit si les seuils de la CGV bougent
 * sans que cette liste suive. Les CGV restent le texte opposable.
 *
 * Module sans dépendance, comme `delai-acces.ts` et `effectif.ts`.
 */

import { EFFECTIF_PLAGE_FR } from "./effectif";

/** Ligne unique, pour une description de section ou une méta. */
export const CONDITIONS_TARIFAIRES_RESUME_FR = `Prix en euros hors taxes, par groupe ${EFFECTIF_PLAGE_FR} — jamais par personne. Paiement, annulation et prise en charge OPCO : conditions ci-dessous et conditions générales de vente.`;

/** Les conditions réelles, dans l'ordre où le client les rencontre. */
export const CONDITIONS_TARIFAIRES_FR: ReadonlyArray<{ titre: string; texte: string }> = [
  {
    titre: "Prix",
    texte: `En euros hors taxes (HT), par groupe ${EFFECTIF_PLAGE_FR}, jamais par personne. La TVA française au taux en vigueur s'applique selon le régime fiscal d'Axion-IA et votre statut ; le détail figure sur le devis et sur la facture.`,
  },
  {
    titre: "Paiement",
    texte:
      "Par virement bancaire. Pour une prestation inférieure à 5 000 € HT, le paiement intervient à la commande ; au-delà, un échelonnement peut être convenu au devis. Aucun escompte en cas de paiement anticipé.",
  },
  {
    titre: "Annulation et report",
    texte:
      "À plus de 15 jours ouvrés avant le début, aucune somme n'est due. Entre 8 et 15 jours ouvrés, 50 % du prix HT restent dus ; à moins de 8 jours ouvrés, le prix HT reste dû en totalité. La formation est reportable une fois sans frais, à une date convenue ensemble.",
  },
  {
    titre: "Prise en charge OPCO",
    texte:
      "Vous déposez la demande auprès de votre OPCO avant le début de la formation. En cas de refus ou de prise en charge partielle, les sommes non prises en charge restent dues par l'entreprise.",
  },
];

/**
 * Slogans retirés, que le contenu public des formations ne doit plus porter.
 * Lu par la garde `l16-concordance-du-site.spec.ts`.
 */
export const SLOGANS_TARIFAIRES_RETIRES: ReadonlyArray<RegExp> = [
  /sans\s+surprise/i,
  /no\s+surprises?/i,
  /prix\s+fixe\s+par\s+(?:formation|groupe)/i,
];
