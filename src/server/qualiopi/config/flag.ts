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
 * `true` uniquement si la certification Qualiopi est RÉELLEMENT OBTENUE.
 *
 * 🚨 Découplage du 2026-07-25 (audit de certification, F13). Jusqu'ici, un seul
 * drapeau portait deux sens : « les pages publiques de l'OF sont visibles » ET
 * « nous sommes certifiés Qualiopi ». Le second était traité comme un corollaire
 * du premier — le commentaire de `public-identity.ts` disait que basculer en
 * Phase B valait attestation que « NDA + Qualiopi » étaient obtenus.
 *
 * En production, `OF_PUBLIC_DISCLOSURE_ENABLED=true` était posé alors que la
 * certification n'était PAS obtenue (audit initial pas même déclenchable, SIRET
 * et NDA vides). Résultat : le site affirmait publiquement, dans la formulation
 * officielle réservée aux organismes certifiés, « la certification qualité a été
 * délivrée ». C'est précisément ce que l'en-tête de ce fichier qualifie
 * d'ILLÉGAL.
 *
 * Les deux notions sont désormais séparées :
 *   - `isQualiopiPublicDisclosureEnabled()` → les pages OF sont VISIBLES ;
 *   - `isQualiopiCertificationObtenue()`    → on peut AFFIRMER la certification.
 *
 * Le catalogue reste donc public sans qu'aucune mention Qualiopi, CPF ou OPCO
 * ne soit émise. Défaut sécurisé : `false` — le correctif s'applique au
 * déploiement, sans intervention côté Coolify.
 *
 * À passer à `"true"` **le jour où le certificat est délivré**, pas avant, et
 * renseigner alors le numéro, la date et le certificateur dans la configuration.
 */
export function isQualiopiCertificationObtenue(): boolean {
  return process.env.QUALIOPI_CERTIFICATION_OBTENUE === "true";
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
