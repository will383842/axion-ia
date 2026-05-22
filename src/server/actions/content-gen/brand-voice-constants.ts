/**
 * Brand Voice — Constantes partagées entre worker et Server Actions.
 * Isolées pour éviter les dépendances circulaires worker ↔ actions.
 */

/** Clé ContentGenConfig pour l'embedding de référence brand voice (JSON array de nombres). */
export const BRAND_VOICE_CONFIG_KEY = "brand_voice_reference_embedding" as const;
