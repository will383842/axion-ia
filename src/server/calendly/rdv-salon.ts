// Un rendez-vous Calendly pris POUR UN SALON n'est pas un appel (2026-09-29).
//
// ── Le défaut que ce module ferme ─────────────────────────────────────────
// Tout rendez-vous dont le nom ne contient pas « apporteur » recevait les
// messages « votre appel de découverte » (`rappels-appel.ts`) : un lien de
// visio ou un numéro de téléphone, un rappel une heure avant. Pour une
// rencontre en personne sur un salon (GOFAB, Saint-Chamond, 13/10/2026), ces
// messages seraient FAUX : il faut dire où venir, pas comment se connecter.
//
// ── La règle ──────────────────────────────────────────────────────────────
// Un rendez-vous dont le TYPE (nom de l'événement dans Calendly) contient
// « salon » est une rencontre sur un salon — p. ex. « Rencontre au salon
// GOFAB — 13 octobre ». Il reçoit ses propres messages (`rdv-salon.tsx`) :
// confirmation, rappel J-2, rappel J-1. Jamais ceux d'un appel.
//
// ⚠️ Même limite que `appel-apporteur.ts` : la règle repose sur le NOM donné à
// l'événement dans Calendly, seule clé portée par un `scheduled_event`.
//
// 🔑 Priorité : un nom qui contiendrait À LA FOIS « apporteur » et « salon »
// reste un échange apporteur. Les trois populations (client, apporteur, salon)
// se partagent tout le compte, sans recouvrement — voir `PASSAGES`.

import { MOT_CLE_TYPE_APPEL_APPORTEUR } from "@/server/calendly/appel-apporteur";

/** Le mot qui, dans le nom du type d'événement Calendly, désigne un rendez-vous sur un salon. */
export const MOT_CLE_TYPE_RDV_SALON = "salon";

/** Les salons connus : la clé transmise au gabarit, qui porte le lieu et l'accès. */
export type CleSalon = "gofab";

const normaliser = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Vrai si ce type d'événement Calendly est une rencontre sur un salon (et pas un échange apporteur). */
export function estRdvSalon(nomTypeEvenement: string | null | undefined): boolean {
  if (!nomTypeEvenement) return false;
  const n = normaliser(nomTypeEvenement);
  return n.includes(MOT_CLE_TYPE_RDV_SALON) && !n.includes(MOT_CLE_TYPE_APPEL_APPORTEUR);
}

/** Le salon désigné par le nom, ou `null` si aucun salon connu n'y figure. */
export function salonDuNom(nomTypeEvenement: string | null | undefined): CleSalon | null {
  if (!nomTypeEvenement) return null;
  return normaliser(nomTypeEvenement).includes("gofab") ? "gofab" : null;
}

/** Clause Prisma : « SEULEMENT les rendez-vous salon ». Écrite en positif. */
export const SEULS_RDV_SALON = {
  eventTypeName: { contains: MOT_CLE_TYPE_RDV_SALON, mode: "insensitive" as const },
};

/** Clause Prisma : « tout SAUF les rendez-vous salon ». Écrite explicitement, jamais dérivée. */
export const HORS_RDV_SALON = {
  NOT: { eventTypeName: { contains: MOT_CLE_TYPE_RDV_SALON, mode: "insensitive" as const } },
};
