/**
 * Consigne de prix des prompts de génération (R7 — ordre de Williams du 08/11/2026 :
 * « il ne faut plus de prix affichés pour les formations, les audits ou autres. La
 * seule chose à mettre en avant est la journée audit à 1 490 €. »).
 *
 * Une seule source pour le brand-voice (hérité par tous les générateurs et par le
 * chatbot) et pour les générateurs qui écrivent leur propre bloc « tarifs ». Le
 * price-gate (`quality/price-gate.ts`) bloque tout montant € autre que celui de la
 * Journée IA dans un contenu à publier.
 */

import { DUREE_RDV } from "@/content/offre";

/** Formule à écrire à la place d'un prix, pour toute offre autre que la Journée IA. */
export const FORMULE_SUR_DEVIS = `sur devis, parlons-en lors du rendez-vous gratuit de ${DUREE_RDV}`;

/** Jeton (résolu au rendu depuis `pricing.ts`) du seul montant citable : la Journée IA. */
export const JETON_PRIX_JOURNEE_IA = "{{price:journee-ia|flat}}";

export const CONSIGNE_PRIX = `PRIX — RÈGLE ABSOLUE : n'écrivez AUCUN montant (ni chiffre suivi de « € »/« EUR »/« euros », ni « à partir de », « dès », fourchette, grille ou tarif journalier). Seule exception : la Journée IA, que vous pouvez citer uniquement par le jeton \`${JETON_PRIX_JOURNEE_IA}\` (résolu automatiquement), jamais en chiffres. Pour toute autre offre (formations, audits, accompagnements, implémentations, sites web…), écrivez « ${FORMULE_SUR_DEVIS} ». Tout montant € écrit en dur sera bloqué par le price-gate.`;
