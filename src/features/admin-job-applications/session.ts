import "server-only";

/**
 * LES DEUX GARDES DE SESSION DE LA ZONE RECRUTEMENT — écrites une fois.
 *
 * ⚠️ **PAS UN MODULE `"use server"`, ET C'EST TOUT LE POINT.** Dans un fichier
 *    de Server Actions, chaque export devient un point d'entrée réseau : une
 *    garde exportée depuis `actions.ts` serait appelable depuis un navigateur,
 *    ce qui est exactement l'inverse de ce qu'une garde doit être. Même raison
 *    que `reads.ts`, et c'est pour ça qu'elles vivent ici plutôt que là-bas.
 *
 * 🔴 POURQUOI ELLES SORTENT D'`actions.ts` MAINTENANT. Le lot 4 ajoute un
 *    second module d'actions (les gestes en masse). Sans cette extraction, il
 *    aurait fallu recopier `requireAdminWrite` — et deux copies d'une garde de
 *    rôle, c'est la mécanique exacte du constat T5 : le jour où l'une des deux
 *    gagne un rôle, l'autre ne le sait pas, et la divergence ne se voit sur
 *    aucun écran. Ce dépôt vient d'en solder vingt-neuf du prédicat d'écriture.
 */

import { auth } from "@/auth";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";

export interface SessionEcriture {
  readonly userId: string;
  readonly role: string;
  /**
   * Nom FIGÉ dans la frise au moment du geste.
   *
   * Repli sur l'adresse puis sur l'identifiant : un compte renommé ou supprimé
   * plus tard ne doit pas effacer qui a décidé, et une ligne sans auteur se lit
   * comme une ligne dont on a perdu l'auteur.
   */
  readonly nom: string;
}

/** Écrire sur un dossier de candidature. Lève `unauthorized` / `forbidden`. */
export async function requireAdminWrite(): Promise<SessionEcriture> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    throw new Error("forbidden");
  }
  const nom = (session.user as { name?: string }).name ?? session.user.email ?? session.user.id;
  return { userId: session.user.id, role, nom };
}

/**
 * OUVRIR un dossier de candidature — identité comprise.
 *
 * La liste des rôles vit au SSOT (`auth/habilitations.ts`), partagée avec le CV
 * et la photo. Une liste recopiée ici divergerait, et c'est l'identité — pas la
 * pièce jointe — qui serait la moins protégée.
 */
export async function requireAdminRead(): Promise<{
  userId: string;
  email: string;
  role: string;
}> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role ?? "reader";
  if (!peutOuvrirDossierCandidat(role)) throw new Error("forbidden");
  return { userId: session.user.id, email: session.user.email ?? "", role };
}
