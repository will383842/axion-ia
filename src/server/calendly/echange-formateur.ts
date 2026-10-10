// Un échange avec un formateur indépendant n'est pas un CLIENT (2026-10-09).
//
// Chantier « formateurs freelance », lot F-CAL-1. Le compte Calendly porte un
// type « Échange formateur indépendant (20 min) ». Avant ce lot, tout type qui
// n'était ni apporteur ni salon tombait dans la famille CLIENT : e-mails
// « appel de découverte » (confirmation, J-1, H-1), envoi au CRM des ventes,
// entrée au dossier client et à la visio enregistrée.
//
// ── La règle ──────────────────────────────────────────────────────────────
// Même clé que l'apporteur (`appel-apporteur.ts`) : le NOM du type, normalisé
// (NFD, sans accents, minuscules), contient « formateur ». « Formation IA – … »
// ne le contient pas : un client en formation reste un client.
//
// ⚠️ L'enum Prisma `TypeRendezVous` porte la valeur « formateur » depuis le
// schéma n° 1 (2026-10-10), mais aucun classement ne l'écrit encore : la colonne
// d'un échange formateur vaut `autre` (ou NULL). La branche
// `typeRendezVous === "formateur"` sert aux lectures en mémoire et au jour où
// le classement l'écrira. Le NOM est le verrou réel.
//
// Le prédicat commun (apporteur OU formateur) et les clauses Prisma vivent à
// côté de ceux de l'apporteur (`estEchangeHorsClients`,
// `HORS_ECHANGES_HORS_CLIENTS`) : ce module est une FEUILLE, sans import, pour
// que `appel-apporteur.ts` puisse le lire sans cycle.

/** Le mot qui, dans le nom du type d'événement Calendly, désigne un échange formateur. */
export const MOT_CLE_TYPE_ECHANGE_FORMATEUR = "formateur";

/** Vrai si ce type d'événement Calendly est un échange avec un formateur indépendant. */
export function estEchangeFormateurParNom(nomTypeEvenement: string | null | undefined): boolean {
  if (!nomTypeEvenement) return false;
  return nomTypeEvenement
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .includes(MOT_CLE_TYPE_ECHANGE_FORMATEUR);
}

/** Vrai si ce rendez-vous est un échange formateur : classé « formateur » OU nommé formateur. */
export function estEchangeFormateur(rdv: {
  readonly typeRendezVous?: string | null | undefined;
  readonly eventTypeName?: string | null | undefined;
}): boolean {
  return rdv.typeRendezVous === "formateur" || estEchangeFormateurParNom(rdv.eventTypeName);
}

/**
 * Clause Prisma, nom seul : « le nom ne dit pas formateur ».
 *
 * `mode: "insensitive"` couvre la casse ; « formateur » ne porte pas d'accent.
 * Seule une saisie accentuée À TORT (« formatéur ») échapperait à la base et
 * serait rattrapée en mémoire — cas jugé négligeable, noté ici pour mémoire.
 */
export const NOM_HORS_ECHANGE_FORMATEUR = {
  NOT: {
    eventTypeName: { contains: MOT_CLE_TYPE_ECHANGE_FORMATEUR, mode: "insensitive" as const },
  },
};
