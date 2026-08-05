/**
 * Qualiopi — Pont Formation ↔ kit documentaire de la bibliothèque (module PUR).
 *
 * La jointure Formation ↔ InterventionDocument n'existe QUE par convention :
 * `Formation.slug === InterventionDocument.interventionSlug`, valable pour les
 * formations importées du catalogue (catalog-import écrit slug = slugFr).
 * AUCUNE FK, aucun code de jointure ailleurs : une formation dupliquée
 * (`slug-copie`) ou sur-mesure n'a PAS de kit dans la bibliothèque.
 *
 * Ce module rend la convention EXPLICITE et fail-visible : on résout le slug
 * contre la liste réelle du catalogue, on ne devine jamais. Un `null` signifie
 * « pas de kit » et l'appelant doit le DIRE à l'écran (encart explicite), pas
 * afficher une section vide.
 *
 * Zéro Prisma, zéro I/O — importable par l'évaluateur d'alertes, les pages RSC
 * et les tests sans mock.
 */

import type { SupportType } from "../../../../prisma/generated/client";
import { getInterventionsByFamille } from "@/content/intervention-documents-catalog";

/**
 * Slug de kit d'une formation, ou `null` si la formation n'a pas de kit.
 *
 * Deux sources, dans cet ordre :
 *
 *  1. `slugsDeposes` — les slugs qui portent RÉELLEMENT des documents en base.
 *     🔴 Vérification en production le 2026-08-05 : l'écran « Tout pour
 *     animer » annonçait « pas de kit » sur 34 des 56 formations publiées, qui
 *     en avaient pourtant un (diaporamas déposés en juin). La refonte de
 *     l'offre (juillet 2026) a renommé les slugs du catalogue, sans toucher
 *     ni aux formations importées ni aux dépôts : le catalogue seul ne
 *     reconnaît plus l'existant. Un kit déposé fait foi — refuser de
 *     l'afficher parce qu'un fichier statique a changé cache au formateur le
 *     .pptx qu'il doit projeter.
 *  2. le catalogue « formation » — pour les prestations de l'offre courante
 *     dont le kit n'est pas encore déposé (l'écran doit alors dire ce qui
 *     manque, pas prétendre qu'aucun kit n'est attendu).
 *
 * Sans `slugsDeposes`, la résolution reste STRICTEMENT celle du catalogue :
 * un appelant qui ne peut pas lire la base (module pur, test) garde le
 * comportement d'origine. Une formation dupliquée (`slug-copie`) ou
 * sur-mesure retourne `null` dans les deux cas — jamais un slug deviné.
 */
export function resolveInterventionSlugForFormation(
  formation: { slug: string },
  slugsDeposes?: ReadonlySet<string>,
): string | null {
  // Un slug vide n'est jamais un kit — garde explicite : un Set mal construit
  // (chaîne vide issue d'une ligne orpheline) ne doit pas ouvrir la porte.
  if (formation.slug === "") return null;
  if (slugsDeposes?.has(formation.slug) === true) return formation.slug;
  const kits = getInterventionsByFamille("formation");
  return kits.some((i) => i.slug === formation.slug) ? formation.slug : null;
}

/**
 * Correspondance SupportType (PDF GÉNÉRÉ par le Formation Engine) → slot du kit
 * (fichier UPLOADÉ dans la bibliothèque) couvrant le MÊME usage.
 *
 * Ce ne sont pas les mêmes objets : la correspondance sert uniquement à
 * afficher côte à côte « généré » et « déposé » pour un même besoin (l'écran
 * « Tout pour animer »). `null` = pas d'équivalent dans le kit.
 *
 * ⚠️ `slides_formateur` ne mappe PAS vers le slot `diaporama` : le diaporama
 * est LE .pptx projeté en salle (gold-standard du kit), le `slides_formateur`
 * généré n'en est pas un substitut — le laisser passer pour tel inviterait à ne
 * jamais déposer le .pptx. Le diaporama est traité à part (section « Projeté en
 * salle », alerte `diaporama_manquant_session`).
 *
 * `memo` ne mappe pas vers `memo_methode` : ce slot est le « Mémo méthode
 * AXION », un actif PARTAGÉ entre formations — pas le mémo récapitulatif propre
 * à la formation.
 */
export const SUPPORT_TYPE_TO_SLOT: Record<SupportType, string | null> = {
  slides_formateur: null,
  slides_stagiaire: null,
  livret_stagiaire: "livret_apprenant",
  memo: null,
  guide_animation: "guide_animation",
  exercices: "cahier_exercices",
  grille_eval: "evaluation_acquis",
};

/**
 * Les 7 types de supports — dérivés du Record ci-dessus, que TypeScript force
 * à couvrir TOUT l'enum : une valeur ajoutée à `SupportType` casse la
 * compilation ici tant que sa correspondance (même `null`) n'est pas déclarée.
 */
export const SUPPORT_TYPES: ReadonlyArray<SupportType> = Object.keys(
  SUPPORT_TYPE_TO_SLOT,
) as SupportType[];

/**
 * Slots du kit projetés/consultés EN SALLE : le .pptx projeté et son déroulé
 * minuté. C'est la section « Projeté en salle » de l'écran « Tout pour
 * animer » — et le premier (`diaporama`) porte l'alerte de session imminente.
 */
export const SLOTS_PROJETES_EN_SALLE = ["diaporama", "scenario_pedagogique"] as const;
