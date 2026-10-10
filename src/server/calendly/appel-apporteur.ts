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

import {
  estEchangeFormateur,
  estEchangeFormateurParNom,
  NOM_HORS_ECHANGE_FORMATEUR,
} from "./echange-formateur";

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

// ── Les clauses Prisma (2026-10-04 : le TYPE classé d'abord) ──────────────
//
// Depuis le lot L1 du chantier « Types de rendez-vous », chaque ligne porte
// `typeRendezVous`, classé à l'écriture par l'URI du type Calendly (renommer un
// type ne le fait plus changer de monde). La colonne est NULLABLE : les lignes
// écrites pendant la fenêtre de déploiement n'en ont pas. D'où deux familles :
//
//   · `…_PAR_NOM` : les clauses historiques, sur le nom seul. Gardées pour le
//     repli du worker, qui tourne le nouveau code ~50 min AVANT la migration
//     (AGENTS.md) : une requête qui cite une colonne absente échoue, il la
//     rejoue alors sur le nom (`rappels-appel.ts`, `reconcile.ts`).
//   · les clauses courantes : la colonne d'abord.
//
// 🔑 DOUBLE VERROU pour l'apporteur, comme la garde CRM (`crm-sync/index.ts`) :
// est apporteur ce que la colonne classe « apporteur » OU dont le nom contient
// « apporteur ». Tout ce qui était apporteur hier le reste donc, quel que soit
// le classement — un candidat ne reçoit jamais un e-mail client, n'entre jamais
// au CRM des ventes. La colonne ne fait qu'AJOUTER : un type apporteur renommé
// sans le mot-clé reste reconnu.

/** Les quatre types qui ne sont pas un échange apporteur (miroir de l'enum Prisma). */
const TYPES_HORS_APPORTEUR = ["diagnostic", "echange_projet", "salon", "autre"] as const;

/** Clause historique, nom seul : « SEULEMENT les échanges apporteur ». */
export const SEULS_APPELS_APPORTEUR_PAR_NOM = {
  eventTypeName: { contains: MOT_CLE_TYPE_APPEL_APPORTEUR, mode: "insensitive" as const },
};

/**
 * « SEULEMENT les échanges apporteur » : classés apporteur, OU nommés apporteur.
 *
 * 🔑 Écrit en positif, jamais comme une négation de `HORS_ECHANGES_HORS_CLIENTS`.
 * Ensemble, les deux filtres couvrent tout le compte SAUF les échanges
 * formateur (2026-10-09), sans recouvrement
 * (`un-type-classe-garde-les-memes-populations.spec.ts` le prouve sur toutes
 * les combinaisons type × nom ; `un-echange-formateur-n-est-jamais-un-client.spec.ts`
 * pour le formateur).
 */
export const SEULS_APPELS_APPORTEUR = {
  OR: [{ typeRendezVous: "apporteur" as const }, SEULS_APPELS_APPORTEUR_PAR_NOM],
};

/**
 * Vrai si ce rendez-vous est un échange apporteur — même double verrou que les
 * clauses, pour les filtres en mémoire (console, rattachement).
 */
export function estRendezVousApporteur(rdv: {
  readonly typeRendezVous?: string | null | undefined;
  readonly eventTypeName?: string | null | undefined;
}): boolean {
  return rdv.typeRendezVous === "apporteur" || estAppelApporteur(rdv.eventTypeName);
}

// ── Les échanges HORS CLIENTS : apporteur OU formateur (2026-10-09) ────────
//
// Lot F-CAL-1 du chantier « formateurs freelance ». Un échange avec un
// formateur indépendant (`echange-formateur.ts`) n'est pas plus un client
// qu'un échange apporteur. Toute EXCLUSION des familles client — e-mails
// « appel de découverte », CRM des ventes, dossier client, visio enregistrée —
// lit désormais ce prédicat commun ; les prédicats « apporteur » seuls ne
// servent plus qu'à SÉLECTIONNER les apporteurs (fiche, rattachement,
// invitation, classement). Inventaire figé par
// `__tests__/inventaire-des-gardes-hors-clients.spec.ts`.
//
// 🔑 Un nom qui contient les deux mots reste « apporteur » : `SEULS_APPELS_APPORTEUR`
// et `estRendezVousApporteur` n'ont pas bougé, il reçoit donc toujours les
// messages apporteur — et toujours rien des familles client.

/** Vrai si ce type d'événement Calendly n'est PAS un client : apporteur ou formateur. */
export function estEchangeHorsClientsParNom(nomTypeEvenement: string | null | undefined): boolean {
  return estAppelApporteur(nomTypeEvenement) || estEchangeFormateurParNom(nomTypeEvenement);
}

/** Vrai si ce rendez-vous n'est PAS un client : échange apporteur OU échange formateur. */
export function estEchangeHorsClients(rdv: {
  readonly typeRendezVous?: string | null | undefined;
  readonly eventTypeName?: string | null | undefined;
}): boolean {
  return estRendezVousApporteur(rdv) || estEchangeFormateur(rdv);
}

/**
 * La famille « hors clients » d'un rendez-vous : `apporteur`, `formateur`, ou
 * `null` (un client, un salon). Apporteur D'ABORD : un nom qui contient les
 * deux mots reste un échange apporteur, et garde tout ce qu'un apporteur reçoit.
 */
export function familleHorsClients(rdv: {
  readonly typeRendezVous?: string | null | undefined;
  readonly eventTypeName?: string | null | undefined;
}): "apporteur" | "formateur" | null {
  if (estRendezVousApporteur(rdv)) return "apporteur";
  if (estEchangeFormateur(rdv)) return "formateur";
  return null;
}

/** Nom seul : « le nom ne dit pas apporteur ». */
const NOM_HORS_APPEL_APPORTEUR = {
  NOT: { eventTypeName: { contains: MOT_CLE_TYPE_APPEL_APPORTEUR, mode: "insensitive" as const } },
};

/**
 * Clause historique, nom seul : « ni apporteur, ni formateur » — repli du
 * worker quand la colonne `type_rendez_vous` n'existe pas encore.
 *
 * `mode: "insensitive"` couvre la casse ; aucun des deux mots-clés ne porte
 * d'accent, donc la normalisation des prédicats en mémoire n'a pas
 * d'équivalent à chercher côté base.
 */
export const HORS_ECHANGES_HORS_CLIENTS_PAR_NOM = {
  AND: [NOM_HORS_APPEL_APPORTEUR, NOM_HORS_ECHANGE_FORMATEUR],
};

/**
 * « Ni apporteur, ni formateur » : ni classé apporteur, ni nommé apporteur,
 * ni nommé formateur.
 *
 * 🔑 Écrit EXPLICITEMENT, jamais comme une négation de `SEULS_APPELS_APPORTEUR` :
 * avec lui, il ne couvre plus tout le compte — un échange formateur n'est dans
 * AUCUNE des deux populations, et c'est voulu (aucun e-mail de notre part ;
 * Calendly envoie l'invitation d'agenda).
 *
 * ⚠️ `typeRendezVous: { not: "apporteur" }` serait FAUX : en SQL, `NULL <> x`
 * n'est pas vrai, et les lignes non classées sortiraient de la population
 * client. D'où la liste explicite des autres types, plus `null`.
 */
export const HORS_ECHANGES_HORS_CLIENTS = {
  AND: [
    { OR: [{ typeRendezVous: null }, { typeRendezVous: { in: [...TYPES_HORS_APPORTEUR] } }] },
    NOM_HORS_APPEL_APPORTEUR,
    NOM_HORS_ECHANGE_FORMATEUR,
  ],
};

/**
 * @deprecated Alias de `HORS_ECHANGES_HORS_CLIENTS` (2026-10-09). Le nom ment
 * depuis le lot F-CAL-1 : la clause exclut aussi les échanges formateur.
 * Gardé pour les tests historiques ; aucun code ne doit plus l'importer
 * (`inventaire-des-gardes-hors-clients.spec.ts`).
 */
export const HORS_APPELS_APPORTEUR = HORS_ECHANGES_HORS_CLIENTS;

/** @deprecated Alias de `HORS_ECHANGES_HORS_CLIENTS_PAR_NOM` (2026-10-09). */
export const HORS_APPELS_APPORTEUR_PAR_NOM = HORS_ECHANGES_HORS_CLIENTS_PAR_NOM;
