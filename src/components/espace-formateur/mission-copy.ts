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
