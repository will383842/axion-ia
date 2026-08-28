/**
 * Qui a le droit de VOIR les appels réservés — et pourquoi c'est plus étroit
 * que le reste de la console.
 *
 * ## Le défaut que ce module ferme
 *
 * Mesuré le 2026-08-27. La fiche d'un appel interrogeait la base AVANT de
 * savoir qui regardait :
 *
 *     const event = await prisma.calendlyEvent.findUnique({ where: { id } });
 *     if (!event) notFound();
 *     const session = await auth();          // ← trop tard, et seulement pour
 *     await markInboxRead(session?.user?.id, …);  //   l'accusé de lecture
 *
 * et la page de liste n'appelait pas `auth()` du tout. Aucun layout ne gardait
 * sur le rôle : `[adminPrefix]/layout.tsx` lit la session pour décider
 * d'AFFICHER la barre latérale, il ne refuse rien.
 *
 * 🔴 CE QUI REND CE CAS PLUS GRAVE QUE LES 241 AUTRES PAGES OUVERTES. Ces
 * fiches portent `cancelUrl` et `rescheduleUrl` — des **URL-capacités**.
 * Quiconque les lit peut annuler ou déplacer le rendez-vous d'un prospect
 * depuis un onglet privé, sans être authentifié nulle part. Une lecture ouverte
 * n'y est donc pas seulement une fuite de coordonnées : c'est un pouvoir
 * d'écriture par recopie, hors de toute garde.
 *
 * ## Pourquoi ce module et pas `gardePage("consultation")`
 *
 * `gardePage` (SSOT du 2026-08-27) porte deux niveaux, et aucun ne convient
 * ici : `consultation` ouvre à TOUS les rôles admin, `ecriture` à tous sauf
 * `reader`. Or l'écriture de ce domaine — `requireAdminWriteSession`,
 * `actions.ts` — est délibérément plus étroite que `ROLES_ECRITURE` : elle
 * exclut aussi `secretaire` et `responsable_qualite`.
 *
 * Décision de Will, 2026-08-27 : **la lecture s'aligne sur l'écriture du
 * domaine**. Un compte qui ne peut pas modifier un appel ne doit pas non plus
 * lire les coordonnées du prospect ni ses liens d'annulation.
 *
 * ⚠️ CE FICHIER EST LA SEULE LISTE. `requireAdminWriteSession` la CONSOMME au
 * lieu de porter la sienne : c'est ce qui garantit que lecture et écriture ne
 * peuvent plus diverger. Le jour où ce périmètre rejoint le SSOT
 * `@/server/auth/habilitations`, il n'y aura qu'un endroit à déplacer.
 *
 * ⚠️ NE PAS recopier cette liste dans une page. Les pages appellent
 * `gardeLectureAppels()`, qui rend le même contrat que `gardePage` — donc le
 * même écran `AccesRefuse`, avec un motif qui NOMME le rôle. Un écran vide pour
 * cause de droits doit dire que c'est une question de droits (P7).
 *
 * ## DEUX RÉGIMES, PARCE QUE LES ÉCRANS NE SE RESSEMBLENT PAS
 *
 * Quatre surfaces de la console servent ces données. Fermer la première en
 * laissant les trois autres ouvertes n'aurait rien fermé — c'est le motif du
 * « jumeau oublié », et quatre agents l'ont relevé indépendamment sur la
 * première version de ce module.
 *
 * · **REFUS** — `gardeLectureAppels()`. Pour les écrans DÉDIÉS aux appels :
 *   `contacts/appels` et `contacts/appels/[id]`. Ils n'ont pas d'autre contenu,
 *   les refuser entièrement ne prive de rien d'autre.
 *
 * · **FILTRE** — `peutVoirLesAppels()`. Pour les écrans MIXTES : `agenda`
 *   (qui porte aussi les rendez-vous personnels de l'exploitant) et `contacts`
 *   (la boîte de réception, qui porte quatre canaux). Les fermer serait une
 *   décision de périmètre que personne n'a prise ; on retire donc les
 *   coordonnées, pas l'écran. Un rôle non habilité voit toujours « occupé de
 *   14 h à 14 h 45 » et « un appel est arrivé » — jamais avec qui.
 *
 * 🔒 Ce qui est intégralement clos dans les deux régimes : `cancelUrl` et
 * `rescheduleUrl`, les URL-capacités. Elles ne sont rendues que par la fiche,
 * qui est en régime REFUS.
 *
 * ⚠️ Toute NOUVELLE surface qui lit ces données doit choisir l'un des deux
 * régimes. `__tests__/la-lecture-est-gardee-comme-l-ecriture.spec.ts` balaie les
 * pages de la console et rougit sur celle qui n'en choisit aucun — il DÉRIVE la
 * liste, il ne l'énumère pas.
 */

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { ResultatAcces } from "@/server/auth/garde-page";
import { peutConsulter, type RoleAdmin } from "@/server/auth/habilitations";

/**
 * Les rôles admis sur le domaine « appels réservés », en lecture comme en
 * écriture.
 *
 * Volontairement écrite ICI et nulle part ailleurs. Elle est plus étroite que
 * `ROLES_ECRITURE` du SSOT, et cet écart est une décision, pas un oubli : les
 * coordonnées d'un prospect et ses liens d'annulation ne sont pas de la donnée
 * de production courante.
 */
export const ROLES_APPELS = [
  "super_admin",
  "admin",
  "editor",
] as const satisfies ReadonlyArray<RoleAdmin>;

export type RoleAppels = (typeof ROLES_APPELS)[number];

/** Ce rôle peut-il voir et modifier les appels réservés ? */
export function peutVoirLesAppels(role: string | null | undefined): boolean {
  return (ROLES_APPELS as ReadonlyArray<string>).includes(role ?? "");
}

/** Libellés destinés au motif de refus — repris de `garde-page.ts`. */
const LIBELLE_ROLE: Readonly<Record<RoleAdmin, string>> = {
  super_admin: "super-administrateur",
  admin: "administrateur",
  responsable_qualite: "responsable qualité",
  secretaire: "secrétaire",
  editor: "rédacteur",
  reader: "lecteur",
};

/**
 * Garde les pages du domaine « appels réservés ».
 *
 * 🔴 À APPELER EN PREMIÈRE INSTRUCTION, avant tout accès Prisma. Interroger la
 * base puis refuser n'est pas seulement inélégant : sur la fiche, un `notFound()`
 * émis avant la garde renseigne un visiteur non habilité sur l'EXISTENCE d'un
 * identifiant. La garde d'abord, la base ensuite.
 *
 * Rend le même contrat que `gardePage` pour que les pages affichent le même
 * `AccesRefuse` : redirection vers la connexion s'il n'y a pas de session (c'est
 * alors la bonne réponse), refus NOMMÉ si la session existe mais que le rôle ne
 * suffit pas.
 */
export async function gardeLectureAppels(destinationLogin: string): Promise<ResultatAcces> {
  const session = await auth();

  // Pas de session : la page de connexion EST la bonne réponse.
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

  if (!peutVoirLesAppels(role)) {
    const libelle = role !== null ? LIBELLE_ROLE[role] : "inconnu";
    return {
      autorise: false,
      role,
      motif:
        `Les appels réservés portent les coordonnées des prospects et les liens ` +
        `permettant d'annuler leur rendez-vous. Votre rôle (${libelle}) n'y donne ` +
        `pas accès. Demandez à un administrateur si vous en avez besoin.`,
    };
  }

  return { autorise: true, role: role as RoleAdmin, peutEcrire: true };
}
