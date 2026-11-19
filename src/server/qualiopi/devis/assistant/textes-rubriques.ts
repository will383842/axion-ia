/**
 * Textes des rubriques « délais », « garantie » et « plafonds » de l'assistant de devis.
 * Validés par le fondateur, issus des CGV v3. Ils vivent dans le code (la table
 * `devis_textes_bibliotheque` n'a pas de colonne de rubrique) et n'entrent que dans les
 * NOUVEAUX brouillons : un devis déjà émis garde ses textes figés.
 */

export const TEXTE_DELAIS =
  "Les délais indiqués sont des estimations, pas des dates garanties. Ils commencent quand nous avons reçu le premier versement et les éléments prévus au devis (accès, informations, contenus). Ils s'allongent d'autant si une réponse ou une validation de votre part arrive en retard, si le périmètre change, en cas de force majeure ou si un service extérieur tombe en panne.";

export const TEXTE_GARANTIE =
  "Pendant la durée de garantie indiquée, à compter de la réception de la livraison finale, nous corrigeons gratuitement les anomalies que vous nous signalez par écrit et qui rendent le livrable non conforme au devis. La garantie ne couvre pas : une modification faite par vous ou par un tiers, un usage non prévu, la panne ou le changement d'un service extérieur ou d'un fournisseur d'IA, une demande nouvelle, ni une erreur isolée dans une réponse produite par l'IA.";

/** Sans point final : imprimé au milieu de « Frais à confirmer : {texte} — plafond X HT ». */
export const TEXTE_PLAFOND_FRAIS =
  "services extérieurs découverts en cours de projet, souscrits à votre nom et seulement après votre accord écrit";

export const TEXTE_PLAFOND_RESPONSABILITE =
  "Notre responsabilité couvre les dommages directs. Elle est plafonnée au prix hors taxes de la prestation ou, pour un abonnement, aux sommes hors taxes des 12 derniers mois, sans pouvoir être inférieure à 5 000 euros. Ce plafond ne s'applique pas en cas de faute lourde ou intentionnelle, ni de dommage corporel. Le détail figure dans nos conditions générales.";

export const VERSION_TEXTES_RUBRIQUES = "code-2026-11-19";
