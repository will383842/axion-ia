// Un rendez-vous Calendly n'est pas toujours un CLIENT (2026-09-19).
//
// ── Le défaut que ce module ferme ─────────────────────────────────────────
// La découverte (`discover.ts`) relève TOUS les rendez-vous du compte Calendly,
// quel que soit leur type, et les traitait tous comme un appel de découverte
// client : e-mails « votre appel de découverte » (confirmation, J-1, H-1), et
// fiche poussée au CRM dans l'univers des ventes (`calendly_booked`).
//
// Le jour où l'échange de 15 minutes proposé aux candidats apporteurs vit sur
// le même compte, chaque candidat qui réserve reçoit les e-mails d'un prospect
// et entre au CRM comme un prospect. Or un apporteur n'est pas un client — et
// le faire apparaître dans le pipeline commercial fausserait les chiffres.
//
// ── La règle ──────────────────────────────────────────────────────────────
// Un rendez-vous dont le TYPE (le nom de l'événement dans Calendly) contient
// « apporteur » est un échange avec un candidat apporteur. Il reste enregistré
// et visible dans la console, l'alerte part (elle affiche le type) ; mais :
//   · aucun e-mail « appel de découverte » (Calendly envoie sa propre
//     confirmation à l'invité) ;
//   · rien ne part au CRM des ventes.
//
// ⚠️ La règle repose sur le NOM donné à l'événement dans Calendly. Il doit
// contenir « apporteur » — p. ex. « Échange apporteur d'affaires (15 min) ».
// Un `scheduled_event` ne porte ni le slug ni l'URL de réservation de son type,
// seulement son nom : c'est la seule clé disponible sans appel d'API de plus.

/** Le mot qui, dans le nom du type d'événement Calendly, désigne un échange apporteur. */
export const MOT_CLE_TYPE_APPEL_APPORTEUR = "apporteur";

/** Vrai si ce type d'événement Calendly est un échange avec un candidat apporteur. */
export function estAppelApporteur(nomTypeEvenement: string | null | undefined): boolean {
  if (!nomTypeEvenement) return false;
  return nomTypeEvenement
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .includes(MOT_CLE_TYPE_APPEL_APPORTEUR);
}

/**
 * Le même filtre, en clause Prisma : « tout SAUF les échanges apporteur ».
 *
 * `mode: "insensitive"` couvre la casse ; « apporteur » ne porte pas d'accent,
 * donc la normalisation de `estAppelApporteur` n'a pas d'équivalent à chercher
 * côté base.
 */
export const HORS_APPELS_APPORTEUR = {
  NOT: { eventTypeName: { contains: MOT_CLE_TYPE_APPEL_APPORTEUR, mode: "insensitive" as const } },
};

/**
 * Le filtre INVERSE : « SEULEMENT les echanges apporteur ».
 *
 * 🔑 Ecrit en positif, jamais comme une negation de `HORS_APPELS_APPORTEUR`.
 * `eventTypeName` est NON NULLABLE en base (`schema.prisma`), donc le piege du
 * `NOT` sur une valeur absente ne s'applique pas ici — mais deriver un filtre
 * d'un autre le rendrait faux le jour ou cette colonne deviendrait facultative.
 * Deux clauses explicites coutent une ligne et ne mentent jamais.
 *
 * Ajoute le 2026-09-21 pour que les trois messages de l'echange apporteur
 * (`apporteur-echange.tsx`) ciblent exactement la population que les messages
 * clients excluent : ensemble, les deux filtres couvrent tout, sans recouvrement.
 */
export const SEULS_APPELS_APPORTEUR = {
  eventTypeName: { contains: MOT_CLE_TYPE_APPEL_APPORTEUR, mode: "insensitive" as const },
};
