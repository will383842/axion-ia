/**
 * Ce qui se passe APRÈS la réponse à une proposition de mission, dit au
 * formateur — en un seul endroit.
 *
 * ## Le défaut que ce module ferme (recette du 2026-09-03)
 *
 * Ces deux phrases vivaient dans `MissionReponseForm`, et ne s'affichaient
 * JAMAIS. Le formulaire les rend bien après le clic, puis `router.refresh()`
 * re-rend le Server Component ; celui-ci constate que la mission n'est plus
 * `en_attente`, cesse de rendre le formulaire — et sa confirmation avec. Le
 * formateur qui venait d'accepter lisait « Cette proposition n'attend plus de
 * réponse : acceptée. », un constat écrit pour quelqu'un qui rouvre un vieux
 * lien, à la place de la seule information qu'il attend : et maintenant ?
 *
 * ## Module SANS "use client" ni JSX, et c'est nécessaire
 *
 * Il est importé à la fois par le composant client et par la page serveur.
 * Le sortir du fichier `"use client"` n'est pas un rangement : dans l'App
 * Router, TOUT export d'un module `"use client"` devient une référence client,
 * et un Server Component qui lit `SUITE_APRES_REPONSE["acceptee"].titre` y
 * trouve `undefined` — écran 500. Mesuré, puis corrigé ici. Même patron que
 * `components/admin/qualiopi/lieu-values.ts`.
 */

import type { MissionFormateurStatut } from "../../../prisma/generated/client";

/** Les deux réponses qu'un formateur peut donner. */
export type ReponseDonnee = "acceptee" | "refusee";

export const SUITE_APRES_REPONSE: Record<ReponseDonnee, { titre: string; suite: string }> = {
  acceptee: {
    titre: "Mission acceptée.",
    suite:
      "Les informations pratiques (adresse, salle, contact sur place, consignes d'accès) vous parviendront une semaine avant le démarrage, et restent consultables dans votre espace.",
  },
  refusee: {
    titre: "Refus enregistré.",
    suite:
      "L'organisme est prévenu et va confier la session à un autre intervenant. Merci d'avoir répondu vite.",
  },
};

/**
 * Lot S2 (S-UX-6) — refus d'un formateur INDÉPENDANT : aucun motif exigé, et
 * aucune phrase qui en fasse un service rendu. Une seule ligne.
 */
export const REPONSE_ENREGISTREE = "Réponse enregistrée. Merci.";

/** La question du refus libre, et ses quatre réponses possibles (toutes facultatives). */
export const QUESTION_REFUS_LIBRE = "Voulez-vous nous dire pourquoi ?";
export const CHOIX_MOTIF_REFUS_LIBRE = [
  "Dates impossibles",
  "Trop loin",
  "Sujet hors de mes formations",
  "Autre",
] as const;

/** La phrase de liberté, au-dessus des deux boutons. */
export const PHRASE_LIBERTE = "Vous êtes libre d'accepter ou de refuser, sans aucune conséquence.";

/**
 * Lot L11b-ux (S-UX-5) — ce que la page d'une mission dit au formateur, par
 * statut : POURQUOI elle en est là, et QUOI faire. `Record` exhaustif sur
 * l'énumération : un statut ajouté sans son texte ne compile pas.
 */
export const TEXTE_STATUT_MISSION: Record<
  MissionFormateurStatut,
  { readonly pourquoi: string; readonly quoiFaire: string }
> = {
  en_attente: {
    pourquoi: "Une mission vous est proposée.",
    quoiFaire: "Répondez avant la date indiquée.",
  },
  acceptee: {
    pourquoi: "Vous avez accepté cette mission.",
    quoiFaire: "Votre lettre de mission vous parviendra dès que le client aura signé.",
  },
  accord_hors_outil: {
    pourquoi: "Votre accord a été noté par notre équipe.",
    quoiFaire: "Votre lettre de mission vous parviendra dès que le client aura signé.",
  },
  refusee: {
    pourquoi: "Vous n'étiez pas disponible pour cette mission.",
    quoiFaire: "Rien à faire. D'autres missions pourront vous être proposées.",
  },
  retiree: {
    pourquoi: "Cette mission ne vous est plus confiée.",
    quoiFaire: "Rien à faire de votre part.",
  },
  expiree: {
    pourquoi: "La formation a commencé sans réponse de votre part.",
    quoiFaire: "Rien à faire de votre part.",
  },
  sans_reponse: {
    pourquoi: "La date limite de réponse est passée.",
    quoiFaire: "Rien à faire. D'autres missions pourront vous être proposées.",
  },
  desistee: {
    pourquoi: "Votre désistement est enregistré.",
    quoiFaire: "Rien d'autre à faire de votre part.",
  },
};

/** L11h (F-15) — le désistement, sans pénalité, motif facultatif. */
export const DESISTEMENT = {
  bouton: "Je ne peux plus assurer cette mission",
  question: "Voulez-vous nous dire pourquoi ?",
  remplacant: "Un remplaçant à proposer ?",
  envoyer: "Envoyer",
  fait: "C'est noté, nous sommes prévenus. Rien d'autre à faire.",
} as const;
