/**
 * Garde de la page « Enregistreur » de la console (PR 5), régime REFUS : la
 * page ne sert que les jetons de l'appareil qui enregistre les rendez-vous,
 * elle est réservée aux rôles de `ROLES_ENREGISTREUR` (décision A2).
 *
 * Même contrat que `gardePage` et `gardeLectureAppels` : redirection vers la
 * connexion sans session, refus NOMMÉ sinon. À appeler en PREMIÈRE instruction,
 * avant tout accès à la base.
 */

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { ResultatAcces } from "@/server/auth/garde-page";
import { peutConsulter, type RoleAdmin } from "@/server/auth/habilitations";
import { roleAutoriseEnregistreur } from "@/server/visio/roles-enregistreur";

export const MOTIF_SANS_ACCES_ENREGISTREUR =
  "L'enregistreur des rendez-vous est réservé à Williams et aux administrateurs : " +
  "il donne accès au son des échanges avec les clients.";

export async function gardeLectureEnregistreur(destinationLogin: string): Promise<ResultatAcces> {
  const session = await auth();
  if (!session?.user) redirect(destinationLogin);
  const role = ((session.user as { role?: string | null }).role ?? null) as RoleAdmin | null;
  if (!peutConsulter(role) || !roleAutoriseEnregistreur(role)) {
    return { autorise: false, role, motif: MOTIF_SANS_ACCES_ENREGISTREUR };
  }
  return { autorise: true, role: role as RoleAdmin, peutEcrire: true };
}

/** Pour les actions serveur : l'identifiant de l'administrateur, ou une erreur lisible. */
export async function exigerAccesEnregistreur(): Promise<{ readonly userId: string }> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string | null } | undefined;
  if (!user?.id) throw new Error("Session expirée : reconnectez-vous.");
  if (!roleAutoriseEnregistreur(user.role ?? null)) throw new Error(MOTIF_SANS_ACCES_ENREGISTREUR);
  return { userId: user.id };
}
