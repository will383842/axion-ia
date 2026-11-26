/**
 * Budgets de sortie (max_tokens) du chemin blog Claude, source unique partagée par les
 * générateurs ET l'estimation du pire cas de l'essai.
 *
 * Pourquoi si grands : sur claude-sonnet-5-5 la réflexion (adaptative, active quand on
 * n'envoie pas `thinking`) compte dans max_tokens même si son texte n'est pas renvoyé.
 * Avec 2 600 jetons, tout le budget partait en réflexion : aucun texte, l'article échouait.
 * La limite de sortie du modèle est de 128 000 jetons ; l'appel est en flux, donc sans
 * garde-fou « streaming requis ».
 */
export const MAX_TOKENS_PLAN_CLAUDE = 12_000;
export const MAX_TOKENS_EXPANSION_CLAUDE = 16_000;
