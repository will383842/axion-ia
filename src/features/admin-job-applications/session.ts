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

/**
 * Écrire sur un dossier de candidature. Lève `unauthorized` / `forbidden`.
 *
 * 🔴 LOT 6 — CETTE GARDE AUTORISAIT UN RÔLE QUI NE PEUT PAS OUVRIR LE DOSSIER.
 *
 * Elle testait `super_admin | admin | editor`, une liste écrite en dur. Or
 * `ROLES_DOSSIER_CANDIDAT` vaut `super_admin | admin | responsable_qualite |
 * secretaire` : les deux ensembles ne se recouvrent que sur les deux premiers.
 * Ses deux appelants sont `updateApplicationStatusAction` et
 * `changerStatutEnMasseAction` — c'est-à-dire **la décision**, à l'unité et en
 * masse. Il en découlait deux torts symétriques :
 *
 * - `editor` pouvait **écarter, embaucher et traiter cinquante dossiers d'un
 *   coup** sans avoir le droit d'en lire l'identité, le CV ni le journal. Il
 *   décidait à l'aveugle — et le lot 3 venait de rendre le motif obligatoire,
 *   donc il motivait aussi à l'aveugle.
 * - `secretaire` et `responsable_qualite`, les deux rôles que le SSOT désigne
 *   comme ceux qui **traitent** le dossier, pouvaient consigner au journal,
 *   répondre au candidat et planifier un entretien, mais **pas enregistrer la
 *   décision** à laquelle tout cela mène.
 *
 * 🔑 La règle était déjà écrite dans ce dépôt, en toutes lettres, dans
 * `reply-actions.ts` : **« quiconque peut écrire doit pouvoir lire »** — et ce
 * commentaire renvoyait explicitement l'alignement du reste au lot 6. C'est
 * fait ici. La garde ne porte plus de liste : elle appelle le prédicat, donc
 * un rôle ajouté au SSOT n'a plus besoin d'être ajouté ici.
 *
 * ⚠️ Ce que ça retire à `editor` n'était pas un droit utilisable : il ne
 * pouvait déjà ni ouvrir le dossier, ni voir le nom de la personne sur laquelle
 * il tranchait. Ce que ça donne à `secretaire` est le geste qui manquait au
 * parcours qu'il mène déjà de bout en bout.
 */
export async function requireAdminWrite(): Promise<SessionEcriture> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (!peutOuvrirDossierCandidat(role)) {
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
