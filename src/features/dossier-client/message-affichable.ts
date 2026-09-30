/**
 * Ce qu'une action du dossier client peut écrire dans `?erreur=` (S4,
 * vérification finale du chantier visio, 30/09).
 *
 * L'URL part dans l'historique du navigateur, les journaux d'accès et Sentry :
 * seuls les messages MÉTIER — écrits pour Will, sans donnée technique — y
 * vont. Toute autre erreur (Prisma, réseau, bogue) devient un texte générique,
 * et son détail va au journal serveur. Test
 * `__tests__/une-erreur-prisma-ne-sort-pas-dans-l-url.spec.ts`.
 *
 * Une erreur métier nouvelle s'ajoute à `ERREURS_METIER` ; un message écrit
 * dans l'action elle-même passe par `MessagePourWill`.
 */

import { z } from "zod";

import { GesteRefuse } from "@/server/visio/gestes-compte-rendu";
import { AccesRefuse } from "./acces";
import { ErreurCreerProspect } from "./creer-prospect";
import { ErreurCreationRencontre } from "./creer-rencontre";
import { ErreurDefaireFusion } from "./defaire-fusion";
import { ErreurDeplacement } from "./deplacer";
import { ErreurFusion } from "./fusionner";
import { ErreurNote } from "./note-manuelle";
import { ErreurRattachement } from "./rattacher";
import { ErreurSuivi } from "./suivi";
import { ErreurValidation } from "./valider";

/** Un message écrit pour Will par l'action elle-même (« Choisissez la fiche client. »). */
export class MessagePourWill extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MessagePourWill";
  }
}

export const MESSAGE_ERREUR_GENERIQUE = "L'opération a échoué. Réessayez.";

const ERREURS_METIER: ReadonlyArray<abstract new (...args: never[]) => Error> = [
  MessagePourWill,
  AccesRefuse,
  GesteRefuse,
  ErreurCreerProspect,
  ErreurCreationRencontre,
  ErreurDefaireFusion,
  ErreurDeplacement,
  ErreurFusion,
  ErreurNote,
  ErreurRattachement,
  ErreurSuivi,
  ErreurValidation,
];

/** Le texte à montrer à Will pour cette erreur ; jamais un message technique. */
export function messageAffichable(e: unknown): string {
  if (e instanceof z.ZodError) return "Demande incomplète.";
  if (e instanceof Error && e.message !== "" && ERREURS_METIER.some((C) => e instanceof C)) {
    return e.message;
  }
  console.error("[dossier-client] action en échec :", e);
  return MESSAGE_ERREUR_GENERIQUE;
}
