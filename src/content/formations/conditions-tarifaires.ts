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
export const CONDITIONS_TARIFAIRES_RESUME_FR = `Prix en euros hors taxes, par groupe ${EFFECTIF_PLAGE_FR} — jamais par personne. Paiement, annulation et report : conditions ci-dessous et conditions générales de vente.`;

/** Les conditions réelles, dans l'ordre où le client les rencontre. */
export const CONDITIONS_TARIFAIRES_FR: ReadonlyArray<{ titre: string; texte: string }> = [
  {
    titre: "Prix",
    texte: `En euros hors taxes (HT), par groupe ${EFFECTIF_PLAGE_FR}, jamais par personne. La TVA française au taux en vigueur s'applique selon le régime fiscal d'Axion-IA et votre statut ; le détail figure sur le devis et sur la facture.`,
  },
  {
    titre: "Paiement",
    texte:
      "Par virement, selon les phases et l'échéancier fixés au devis. Aucun escompte en cas de paiement anticipé.",
  },
  {
    titre: "Annulation et report",
    texte:
      "Pour les clients professionnels et les personnes morales non professionnelles, dès qu'il est versé, l'acompte prévu au devis reste acquis en cas d'annulation, quel que soit le délai (hors rétractation légale, manquement ou report à l'initiative d'Axion-IA et force majeure ; voir CGV, articles 6.5 et 46.4). À plus de 15 jours ouvrés avant le début, aucune somme n'est due en plus de l'acompte. Entre 8 et 15 jours ouvrés, 50 % du prix HT restent dus ; à moins de 8 jours ouvrés, le prix HT reste dû en totalité ; la somme due n'est jamais inférieure à l'acompte versé. Ces sommes sont un dédit facturé à part, non imputable sur les fonds de la formation professionnelle. La formation est reportable une fois sans frais, à une date convenue ensemble dans les 3 mois. Si Axion-IA ne peut pas tenir la date convenue, elle reporte sans frais : au moins 2 nouvelles dates proposées par écrit dans les 3 mois suivant la date qu'Axion-IA ne peut pas tenir, acompte reporté ; l'acompte n'est rendu que si aucune date ne convient ou si les dates ne sont pas proposées dans les 10 jours ouvrés (CGV, article 46.4).",
  },
];

/**
 * Ligne « Financement » : EN SOMMEIL. Elle parle de solutions de financement, que les CGV ne
 * citent qu'une fois la certification obtenue : la page des tarifs ne l'affiche que si
 * `isQualiopiCertificationObtenue()`.
 */
export const CONDITION_TARIFAIRE_FINANCEMENT_EN_SOMMEIL_FR: { titre: string; texte: string } = {
  titre: "Financement",
  texte:
    "Nous vous indiquons les solutions de financement possibles lors du premier échange. La formation reste due par l'entreprise dans les conditions prévues au devis.",
};

/**
 * Slogans retirés, que le contenu public des formations ne doit plus porter.
 * Lu par la garde `l16-concordance-du-site.spec.ts`.
 */
export const SLOGANS_TARIFAIRES_RETIRES: ReadonlyArray<RegExp> = [
  /sans\s+surprise/i,
  /no\s+surprises?/i,
  /prix\s+fixe\s+par\s+(?:formation|groupe)/i,
];
