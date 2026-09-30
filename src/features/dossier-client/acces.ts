/**
 * Qui peut lire les ÉCHANGES du dossier client — décision A2 de Will
 * (28/09) : « seuls Will et les administrateurs lisent les comptes rendus,
 * transcriptions et phrases exactes ».
 *
 * ## Ce que couvre la liste
 *
 * Les onglets Synthèse, Projets, Échanges et Personnes de la fiche client, la
 * page d'un projet, « Préparer », et toute action qui écrit ces données. Ils
 * portent ce que le client a DIT (besoins, budget, objections, personnes
 * citées) : ce n'est pas de la donnée de production courante.
 *
 * ## Deux régimes (même modèle que `admin-calendly/acces.ts`)
 *
 *   · FILTRE — `peutVoirLesEchanges()` : la fiche client reste ouverte à tous
 *     les rôles de la console (Qualiopi en a besoin : pièces, facturation) ;
 *     les quatre onglets ne sont NI RENDUS NI REQUÊTÉS hors de la liste, et un
 *     message NOMME la raison.
 *   · REFUS — `gardeLectureEchanges()` : les pages dédiées (projet, préparer)
 *     sont refusées entières, garde en PREMIÈRE instruction, avant tout accès
 *     à la base.
 *
 * ⚠️ LA LISTE vit dans `./roles-echanges.ts` (module pur, lu aussi par le
 * worker de l'enregistreur) et n'est ré-exportée qu'ici. Les pages et les actions la consomment ;
 * personne ne la recopie. Garde dérivée :
 * `src/features/admin-calendly/__tests__/la-lecture-est-gardee-comme-l-ecriture.spec.ts`.
 */

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LIBELLE_ROLE, type ResultatAcces } from "@/server/auth/garde-page";
import { peutConsulter, type RoleAdmin } from "@/server/auth/habilitations";
import { peutVoirLesEchanges } from "./roles-echanges";

export { peutVoirLesEchanges, ROLES_DOSSIER_ECHANGES } from "./roles-echanges";

/**
 * Refus d'accès d'une action (session expirée, rôle hors de la liste A2). Son
 * message est écrit pour Will : il peut revenir dans l'URL (`?erreur=`), à la
 * différence d'une erreur technique (`message-affichable.ts`).
 */
export class AccesRefuse extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccesRefuse";
  }
}

/** Le message montré à un rôle qui n'a pas accès : il NOMME le rôle et la raison. */
export function motifSansAccesAuxEchanges(role: string | null | undefined): string {
  const libelle =
    role !== null && role !== undefined && role in LIBELLE_ROLE
      ? LIBELLE_ROLE[role as RoleAdmin]
      : "inconnu";
  return (
    `La synthèse, les projets, les échanges et les personnes du client portent ce que ` +
    `le client a dit en rendez-vous. Ils sont réservés à Williams et aux administrateurs ` +
    `(votre rôle : ${libelle}).`
  );
}

/**
 * Garde les pages dédiées du dossier client (régime REFUS).
 *
 * 🔴 À APPELER EN PREMIÈRE INSTRUCTION, avant tout accès Prisma : un
 * `notFound()` émis avant la garde renseignerait un visiteur non habilité sur
 * l'existence d'un projet.
 *
 * `motif` : le texte du refus pour une page qui n'est pas du dossier client
 * (l'Enregistreur, PR 5) — même liste, autre explication.
 */
export async function gardeLectureEchanges(
  destinationLogin: string,
  motif: (role: string | null | undefined) => string = motifSansAccesAuxEchanges,
): Promise<ResultatAcces> {
  const session = await auth();
  if (!session?.user) redirect(destinationLogin);
  const role = ((session.user as { role?: string | null }).role ?? null) as RoleAdmin | null;

  if (!peutConsulter(role)) {
    return {
      autorise: false,
      role,
      motif:
        "Votre compte n'a pas de rôle reconnu pour la console. Demandez à un " +
        "administrateur de vous en attribuer un.",
    };
  }
  if (!peutVoirLesEchanges(role)) {
    return { autorise: false, role, motif: motif(role) };
  }
  return { autorise: true, role: role as RoleAdmin, peutEcrire: true };
}

/**
 * Pour les actions serveur : rend l'identifiant de l'administrateur, ou lève
 * une erreur lisible. Une action s'appelle directement : masquer un bouton
 * n'est pas interdire.
 */
export async function exigerAccesEchanges(
  motif: (role: string | null | undefined) => string = motifSansAccesAuxEchanges,
): Promise<{ userId: string; role: RoleAdmin }> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string | null } | undefined;
  if (!user?.id) throw new AccesRefuse("Session expirée : reconnectez-vous.");
  const role = (user.role ?? null) as RoleAdmin | null;
  if (!peutVoirLesEchanges(role)) throw new AccesRefuse(motif(role));
  return { userId: user.id, role: role as RoleAdmin };
}
