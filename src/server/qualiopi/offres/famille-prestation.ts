/**
 * Qualiopi — FAMILLE d'une offre : formation collective ou accompagnement
 * individuel (module PUR, aucun accès Prisma).
 *
 * ## Pourquoi ce module existe
 *
 * 🔴 Vérification en production le 2026-08-05. Une formation collective et un
 * accompagnement 1-to-1 ne sont PAS la même prestation : le site public le sait
 * depuis toujours — deux entrées de menu (« Formations IA » / « Coaching IA »),
 * deux pages, deux discours. La console, elle, les mélangeait :
 *
 *   - le wizard « Nouvelle vente » proposait les 4 offres individuelles au même
 *     titre que les collectives, puis se bloquait à l'étape 2 (aucune formation
 *     publiée ne leur est rattachée — et il ne peut pas y en avoir) ;
 *   - l'écran Offres annonçait pour elles une page `/formations/<slug>` qui
 *     répond **404** : ces prestations n'ont pas de fiche individuelle, elles
 *     vivent toutes sur `/un-a-un`.
 *
 * Le critère existait pourtant déjà en base : `OffreSite.formatPedagogique`
 * (enum non nul). Il n'était lu QUE pour afficher une colonne. Ce module en
 * fait le point de décision unique — plus aucun écran ne redevine la famille
 * à partir d'un slug ou d'un libellé.
 *
 * ## Ce qui rend ce découpage sûr
 *
 * Le `Record` ci-dessous force TypeScript à couvrir tout l'enum : ajouter une
 * valeur à `OffreFormatPedagogique` casse la compilation tant que sa famille
 * n'est pas déclarée. Impossible d'introduire un format qui retomberait
 * silencieusement du mauvais côté.
 */

import type { OffreFormatPedagogique } from "../../../../prisma/generated/client";

/**
 * Famille commerciale d'une offre.
 *
 * `sur_devis` est sa PROPRE famille, et non un 1-to-1 par défaut : « Sur
 * demande » couvre aussi bien un collectif atypique qu'un accompagnement. La
 * ranger d'office d'un côté enverrait l'admin sur un mauvais parcours ; on
 * préfère le dire et lui laisser le choix.
 */
export type FamillePrestation = "collectif" | "un_a_un" | "sur_devis";

const FAMILLE_PAR_FORMAT: Record<OffreFormatPedagogique, FamillePrestation> = {
  collectif_4h: "collectif",
  collectif_1jour: "collectif",
  collectif_2jours: "collectif",
  collectif_3jours: "collectif",
  // Une conférence est collective : un intervenant, une salle, un groupe.
  conference: "collectif",
  dirigeant_1to1: "un_a_un",
  individuel: "un_a_un",
  sur_devis: "sur_devis",
};

/** Famille d'une offre, dérivée de son format pédagogique. */
export function famillePrestation(format: OffreFormatPedagogique): FamillePrestation {
  return FAMILLE_PAR_FORMAT[format];
}

/**
 * L'offre est-elle un accompagnement INDIVIDUEL ?
 *
 * Vrai ⇒ aucune formation du catalogue ne lui sera jamais rattachée : la vente
 * passe par un parcours de séances (`coaching/parcours/new`), pas par une
 * session collective. `sur_devis` rend `false` — on ne présume pas.
 */
export function estOffreUnAUn(format: OffreFormatPedagogique): boolean {
  return famillePrestation(format) === "un_a_un";
}

/**
 * Chemin PUBLIC réel d'une offre (site vitrine), ou `null` si elle n'a pas de
 * page dédiée.
 *
 * 🔴 L'écran Offres composait `/formations/${slug}` pour TOUTES les offres.
 * Vérifié en prod : `/fr/formations/dirigeants`, `/fr/formations/membre-equipe`,
 * `/fr/formations/vision-ia-strategique` et `/fr/formations/sur-demande`
 * répondent 404. Les prestations individuelles n'ont pas de fiche : elles sont
 * présentées ensemble sur `/un-a-un`. Un lien mort dans la console est pire
 * qu'une absence de lien — il fait douter de la donnée, pas de l'affichage.
 */
export function cheminPublicOffre(format: OffreFormatPedagogique, slug: string): string | null {
  switch (famillePrestation(format)) {
    case "collectif":
      return slug === "" ? null : `/formations/${slug}`;
    case "un_a_un":
      // Page unique, sans fiche par prestation.
      return "/un-a-un";
    case "sur_devis":
      // « Sur demande » n'est pas une prestation vitrine : pas de page à citer.
      return null;
  }
}
