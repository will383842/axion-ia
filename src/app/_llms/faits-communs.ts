// Faits communs de `llms.txt` et `llms-full.txt` (audit GEO du 2026-11-11). Dossier privé
// `_llms` (non routé) : il lit la navigation (`components/nav`), ce que `src/content` ne peut pas.
//
// Les deux fichiers se contredisaient : hébergement « Nuremberg » d'un côté,
// « Frankfurt CPX32 » de l'autre ; langue EN « désactivée » ici, « miroir » là ;
// audit « en 5 jours » contre « 2 à 4 h ». Un moteur de réponse qui recoupe deux
// sources officielles divergentes n'en cite aucune. Chaque fait partagé vit donc
// ICI, une seule fois, et les deux routes l'importent.
//
// 🔑 Règle de vérité : un fait n'entre ici que s'il se prouve dans le code.
//  - Hébergement : Hetzner, dans l'Union européenne. Le centre de données varie
//    selon les sources du dépôt (« Nuremberg » dans la console infra, « Frankfurt »
//    dans des textes publics) : la ville n'est donc PAS publiée.
//  - Langue EN : lue au rendu dans `EN_LOCALE_ENABLED`, par le même prédicat que
//    le proxy qui émet les 301 (`isEnLocaleDisabled`).
//  - Audit IA : la description du niveau d'entrée de `AUDIT_TIERS`, celle que sert
//    la page /audit. Les « 2 à 4 h » appartiennent à La Journée IA, pas au module.
//
// Aucun montant ici : le seul prix public (La Journée IA) passe par son jeton.

import { AI_ACT_NAV, PRESTATIONS_NAV } from "@/components/nav/prestations-nav";
import { AUDIT_TIERS, getTierById } from "@/content/pricing";
import { isEnLocaleDisabled } from "@/lib/i18n/en-to-fr-redirect";

/**
 * Libellé public du module « sites web » : celui de l'en-tête. Le nom officiel
 * (`SERVICE_BY_ID.sitesWeb.officialFr`) porte « SaaS », mot que la charte proscrit
 * dans les textes publics ; on lit donc le libellé déjà validé pour la navigation.
 */
export const LIBELLE_SITES_WEB_FR =
  PRESTATIONS_NAV.find((p) => p.id === "sitesWeb")?.labelFr ?? "Sites web IA";

/** Le module Audit IA, tel que le décrit son niveau d'entrée. */
export const DESCRIPTION_AUDIT_LLMS = getTierById(AUDIT_TIERS, "audit-flash").descriptionFr;

/** Hébergement : seul le fait prouvé (prestataire + Union européenne). */
export const HEBERGEMENT_LLMS = "Hetzner, dans l’Union européenne";

/** Facturation et engagement. */
export const FACTURATION_LLMS =
  "Facturation en euros, régime de TVA de l’Union européenne, virement SEPA ou SWIFT. Devis fixe, sans mensualité ni engagement.";

/** Langues servies, lues au rendu (même prédicat que le proxy des 301). */
export function languesLlms(): string {
  return isEnLocaleDisabled()
    ? "français. La version anglaise est désactivée : ses adresses redirigent (301) vers l’équivalent français."
    : "français (version de référence) et anglais.";
}

/** Vrai quand la version anglaise est servie (sitemaps et exclusions EN). */
export function anglaisServi(): boolean {
  return !isEnLocaleDisabled();
}

/** Accessibilité : l'objectif, et le fait qu'aucun audit n'a encore eu lieu. */
export function accessibiliteLlms(siteUrl: string): string {
  return `Accessibilité : objectif WCAG 2.2 AA, pas encore audité. Déclaration : ${siteUrl}/fr/accessibilite.`;
}

/** Les lignes d'en-tête communes (préfixées « > » par chaque route). */
export function enteteFaitsLlms(): string[] {
  return [`Langues : ${languesLlms()}`, `Hébergement : ${HEBERGEMENT_LLMS}.`];
}

/** La section « Faits pratiques », identique dans les deux fichiers. */
export function sectionFaitsPratiquesLlms(siteUrl: string): string {
  return [
    "## Faits pratiques",
    "",
    `- Hébergement : ${HEBERGEMENT_LLMS}.`,
    `- ${FACTURATION_LLMS}`,
    `- ${accessibiliteLlms(siteUrl)}`,
  ].join("\n");
}

/** Les pages d'entrée à lire en premier (vérifiées : accueil, à propos, AI Act). */
export function pagesEssentiellesLlms(siteUrl: string): string {
  return [
    "## Pages essentielles",
    "",
    `- [Accueil](${siteUrl}/fr) — qui nous sommes, La Journée IA et nos cinq prestations, en une page.`,
    `- [À propos](${siteUrl}/fr/a-propos) — Axion-IA, sa fondation et sa façon de travailler.`,
    `- [${AI_ACT_NAV.labelFr}](${siteUrl}/fr${AI_ACT_NAV.href}) — ${AI_ACT_NAV.descriptionFr}`,
  ].join("\n");
}

/**
 * Les mots que la charte proscrit dans les textes publics, appliqués au texte SERVI par
 * `llms.txt` et `llms-full.txt` (hors section Tour France IA, décision en attente).
 *
 * `llms-full.txt` rend aussi la FAQ partagée (`transversal.ts`), hors de ce périmètre : les
 * entrées qui portent un de ces mots sont écartées du fichier tant que leur texte source
 * n'est pas réécrit (elles restent servies par /fr/faq). Les tests lisent ce même motif.
 */
export const MOTS_INTERDITS_LLMS =
  /\bSaaS\b|no-code|conform|\bETI\b|financé|financement|certifi|qualiopi|\bCPF\b|\bOPCO\b|amende|offert|Grenoble|TPE\s?\/\s?PME/i;
