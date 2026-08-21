/**
 * 🔴 `D6-2-M1` — LA liste des rôles attribuables, et rien d'autre.
 *
 * ## Le défaut que ce module ferme
 *
 * `responsable_qualite` et `secretaire` ont été créés le 2026-08-15 : l'enum
 * Prisma les porte, `ROLES_ECRITURE` les reconnaît, la matrice d'habilitation
 * leur donne des droits, leurs tests passent. Mais **aucun chemin du produit ne
 * permettait de les attribuer** : les deux schémas `zod` de gestion de comptes,
 * les deux `<select>` de la console, le filtre de la liste, les deux tables de
 * libellés et la table de tonalité des badges portaient chacun leur propre
 * recopie de la liste — **six recopies**, toutes restées à quatre rôles.
 *
 * Le seul moyen de créer un compte « secrétaire » était une commande SQL à la
 * main. Et un tel compte, s'il avait existé, se serait affiché dans la console
 * sous l'étiquette brute `secretaire`, badge gris, invisible au filtre.
 *
 * 🔑 C'est la seconde moitié, jamais traitée, du défaut du 15-17/08. La
 * première — les gardes d'écriture qui ne reconnaissaient pas ces rôles — a été
 * corrigée le 17. Celle-ci est restée, et pour la même raison : *un prédicat
 * recopié diverge, et c'est toujours la copie qu'on a oublié de mettre à jour
 * qui sert.*
 *
 * ## Pourquoi un `Record<RoleAdmin, …>` et pas un `Record<string, …>`
 *
 * ⚠️ C'est tout l'intérêt du module. Les six recopies étaient typées
 * `Record<string, string>` : ajouter un rôle à l'enum ne cassait donc **rien**,
 * et le trou n'apparaissait qu'au moment d'attribuer le rôle — cinq jours plus
 * tard, ou jamais.
 *
 * Ici, le type se dérive du tuple `ROLES_ADMIN` (SSOT, dans `habilitations.ts`).
 * Ajouter un septième rôle **casse la compilation de ce fichier** tant qu'il n'a
 * pas reçu son libellé, sa description et sa tonalité. La garde n'est pas un
 * test qu'on peut oublier d'écrire : c'est `tsc`.
 */

import { ROLES_ADMIN, type RoleAdmin } from "@/server/auth/habilitations";

export { ROLES_ADMIN, type RoleAdmin };

/** Le libellé court — badges, tableaux, `<option>` du filtre. */
export const LIBELLES_ROLE: Record<RoleAdmin, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  responsable_qualite: "Responsable qualité",
  secretaire: "Secrétaire",
  editor: "Éditeur",
  reader: "Lecteur",
};

/**
 * Ce que le rôle permet, en une ligne, à qui doit choisir.
 *
 * 🔑 Formulé en actes, pas en périmètre technique. « CRUD contenu » ne dit pas à
 * une personne qui crée un compte ce que le titulaire pourra ou ne pourra pas
 * engager ; « n'engage pas l'organisme » le dit.
 */
export const DESCRIPTIONS_ROLE: Record<RoleAdmin, string> = {
  super_admin: "tout, y compris la gestion des comptes",
  admin: "tout, sauf la gestion des comptes",
  responsable_qualite: "atteste, valide les évaluations, habilite les formateurs",
  secretaire: "saisie, classement et suivi Qualiopi ; n'engage pas l'organisme",
  editor: "édite les contenus ; n'engage pas l'organisme",
  reader: "consultation seule",
};

/** La tonalité du badge : `info` pour les rôles qui engagent l'organisme. */
export const TONALITE_ROLE: Record<RoleAdmin, "info" | "neutral"> = {
  super_admin: "info",
  admin: "info",
  responsable_qualite: "info",
  secretaire: "neutral",
  editor: "neutral",
  reader: "neutral",
};

/** Le libellé d'un rôle lu en base — qui peut porter une valeur inattendue. */
export function libelleRole(role: string): string {
  return LIBELLES_ROLE[role as RoleAdmin] ?? role;
}

/** La tonalité d'un rôle lu en base. */
export function tonaliteRole(role: string): "info" | "neutral" {
  return TONALITE_ROLE[role as RoleAdmin] ?? "neutral";
}
