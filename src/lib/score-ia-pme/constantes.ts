// Score IA TPE-PME (code : `score-ia-pme`) — constantes partagées serveur / client.
// Nom PUBLIC : « Score IA TPE-PME » (décision de Williams, 20/11/2026).
// Plan : geo/PLAN-V2-10-SCORE-IA-PME.md (axion-plans-prive), §3, §4, §5.

/** Version de la formule. Toute modification de poids/barème crée `v2` + une nouvelle clé. */
export const SCORE_VERSION = "score-ia-pme-v1";

/**
 * Version du texte de consentement affiché (preuve : quel texte, quel jour).
 * Toute retouche du texte, même d'une virgule, crée `obs-score-v2`.
 */
export const CONSENT_VERSION = "obs-score-v1";

/**
 * Texte EXACT de la case de consentement (décision de Williams, 20/11/2026), version `obs-score-v1`.
 * Toute retouche, même d'une virgule, impose `obs-score-v2`.
 */
export const TEXTE_CONSENTEMENT =
  "J'accepte que mes réponses, sans nom ni e-mail, rejoignent l'Observatoire de l'IA dans les PME d'Axion-IA. Je peux les retirer avec mon code.";

/**
 * Version des LIBELLÉS du questionnaire (I6), écrite dans `raw_answers._questionnaire` :
 * sans elle, on ne saurait plus quelle formulation a produit quelle ligne.
 */
export const QUESTIONNAIRE_VERSION = "q-score-v1";

/** Valeur de `barometer_responses.source` pour les réponses données au Score. */
export const SOURCE_SCORE = "score-ia-pme";

/**
 * Effectif minimal d'un segment pour afficher une comparaison (sens statistique).
 * Valeur prudente par défaut (Williams n'a pas tranché, 20/11/2026) : facile à changer ici.
 */
export const N_MIN_COMPARAISON = 30;

/**
 * Plancher de TOUTE statistique publiée (protection des personnes) : jamais de pourcentage
 * sur moins de 5 réponses, quel que soit le segment.
 */
export const N_MIN_STATISTIQUE = 5;

/**
 * Durée de conservation (années) des réponses ajoutées depuis le Score.
 * Valeur prudente par défaut ; la purge n'est PAS codée dans V2-10 (lot à part).
 */
export const DUREE_CONSERVATION_ANS = 5;

/** Clé `BarometerSnapshot` du Score (distincte de `"latest"` : exports inchangés). */
export const SNAPSHOT_KEY_SCORE = SCORE_VERSION;

/** Préfixe de la clé de limite de débit (suivi de l'empreinte d'IP, jamais l'IP). */
export const RATE_LIMIT_PREFIX = "score-obs";
