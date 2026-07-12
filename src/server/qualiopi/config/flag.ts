/**
 * Qualiopi — Drapeau de divulgation publique (déploiement phasé).
 *
 * Décision Will (2026-06-03, cf. skill `reference/04` §1) : l'organisme de
 * formation est construit ENTIÈREMENT mais reste INVISIBLE au public tant
 * qu'Axion-IA n'a pas obtenu NDA + Qualiopi. Afficher « Qualiopi / éligible
 * CPF / finançable OPCO » avant la certification est ILLÉGAL.
 *
 * - Phase A (défaut) : `OF_PUBLIC_DISCLOSURE_ENABLED` absent / ≠ "true"
 *   → aucune fiche formation publique, aucune mention financement/Qualiopi.
 * - Phase B : `OF_PUBLIC_DISCLOSURE_ENABLED=true` (réglé côté Coolify, run scope,
 *   redémarrage container) → fiches `/formations/[slug]` actives + mentions OF.
 *
 * Convention (ADDENDUM A6, tranchée) : lecture **raw `process.env`** (miroir
 * exact de `EN_LOCALE_ENABLED` / `isEnLocaleDisabled()`), PAS de déclaration
 * dans le schéma `src/env.ts` t3-env — pour ne pas toucher la validation Zod
 * des secrets prod (build GH Actions). Défaut sécurisé : `false`.
 *
 * Garde PRIMAIRE de la Phase A. Le filtre `checkTranslationBannedWords()` n'est
 * qu'un filet secondaire (regex poreux). Toute surface publique OF doit gater
 * sur ce helper (`notFound()` / `generateStaticParams` vide quand `false`).
 */

/**
 * `true` uniquement si `OF_PUBLIC_DISCLOSURE_ENABLED === "true"`.
 * Toute autre valeur (absente, "false", "1", "yes", …) → `false` (sécurisé).
 */
export function isQualiopiPublicDisclosureEnabled(): boolean {
  return process.env.OF_PUBLIC_DISCLOSURE_ENABLED === "true";
}

/**
 * Hub facturation unifié (5 activités) — rollout progressif, même convention
 * raw `process.env` (hors schéma t3-env). `FACTURATION_HUB_ENABLED=true` côté
 * Coolify (run scope) + restart pour activer l'écran. Défaut sécurisé : false
 * (la page renvoie notFound(), l'entrée de nav reste visible en admin car
 * inoffensive — c'est la PAGE qui gate).
 */
export function isFacturationHubEnabled(): boolean {
  return process.env.FACTURATION_HUB_ENABLED === "true";
}
