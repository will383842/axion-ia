/**
 * Textes des rubriques « délais », « garantie » et « plafonds » de l'assistant de devis.
 * Validés par le fondateur, issus des CGV v3. Ils vivent dans le code (la table
 * `devis_textes_bibliotheque` n'a pas de colonne de rubrique) et s'appliquent aux
 * NOUVEAUX brouillons et à tout brouillon d'assistant rouvert puis sauvegardé ; un devis déjà
 * émis ne change pas. Le devis signé prime sur les CGV (art. 4.1) : chaque texte dit exactement
 * ce que disent les CGV (art. 12.2, 15, 26.5, 28, 29, 38), jamais plus.
 */
import {
  CONDITION_GARANTIE,
  DELAI_RAPPORT_JOURS_OUVRES,
  GARANTIE_PHRASE,
} from "@/content/journee-ia-commun";

export const TEXTE_DELAIS =
  "Les délais indiqués sont des estimations, pas des dates garanties. Ils commencent quand nous avons reçu les éléments prévus au devis (accès, informations, contenus) et, si le devis prévoit un acompte, cet acompte. Ils s'allongent de la durée de tout retard de votre part, d'une suspension prévue aux conditions générales, d'un changement de périmètre, d'un cas de force majeure ou de la défaillance d'un service extérieur.";

export const TEXTE_GARANTIE =
  "Pendant la durée de garantie indiquée, à compter de la réception de la livraison finale, nous corrigeons gratuitement, dans les limites prévues aux conditions générales, les anomalies que vous nous signalez par écrit et qui rendent le livrable non conforme au devis. La garantie ne couvre pas : une modification faite par vous ou par un tiers, un usage non prévu, la panne ou le changement d'un service extérieur ou d'un fournisseur d'IA, une demande nouvelle, ni une erreur isolée dans une réponse produite par l'IA.";

/** Sans point final : imprimé au milieu de « Frais à confirmer : {texte} — plafond X HT ». */
export const TEXTE_PLAFOND_FRAIS =
  "services extérieurs découverts en cours de projet, souscrits à votre nom après notification écrite, selon l'article 29 des conditions générales";

export const TEXTE_PLAFOND_RESPONSABILITE =
  "Notre responsabilité, engagée pour faute prouvée, ne couvre que les dommages directs. Elle est plafonnée au prix hors taxes de la prestation ou, pour un abonnement, un hébergement ou une maintenance, au montant hors taxes payé ou dû au cours des 12 mois précédant le fait générateur, sans pouvoir être inférieure à 5 000 euros. Ces limites ne s'appliquent pas en cas de faute lourde ou intentionnelle, ni de dommage corporel. Le détail figure dans nos conditions générales.";

/**
 * Paragraphe imprimé sur un devis (conditions particulières) et sur la convention quand la case
 * « Journée IA » est cochée. ASSEMBLÉ depuis le socle commun de la Journée IA : la phrase de
 * remboursement et sa condition ne sont jamais réécrites ici. Aucun montant, aucune déclaration
 * demandée au client ; renvoi à l'article 47.10 des conditions générales de vente, en tête et en pied.
 */
const FIN_GARANTIE_JOURNEE_IA =
  "La demande se fait par écrit dans les 30 jours suivant la remise du rapport. La garantie s’applique une seule fois par entreprise et ne se cumule pas avec la déduction du prix de la journée prévue à l’article 47.7. Elle s’applique dans les conditions et limites de l’article 47.10 des conditions générales de vente.";

export const TEXTE_GARANTIE_JOURNEE_IA = `Garantie de remboursement de la Journée IA (article 47.10 des conditions générales). Le rapport vous est remis sous ${DELAI_RAPPORT_JOURS_OUVRES} jours ouvrés après la journée. ${GARANTIE_PHRASE} ${CONDITION_GARANTIE} ${FIN_GARANTIE_JOURNEE_IA}`;

export const VERSION_TEXTES_RUBRIQUES = "code-2026-11-19";
