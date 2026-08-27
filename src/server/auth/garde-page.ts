/**
 * La garde d'accès des PAGES de la console — un seul endroit.
 *
 * ## Le défaut que ce module ferme
 *
 * Mesuré le 2026-08-27 : **64 pages** de la console portaient chacune leur
 * propre test de rôle écrit en dur, **0** passait par le SSOT
 * (`@/server/auth/habilitations`). Le déménagement fait le 2026-08-17 pour
 * `requireAdminWrite` — « une liste de rôles écrite dans la garde est invisible
 * depuis la matrice » — n'avait jamais été propagé aux pages.
 *
 * ## Deux niveaux, parce que le produit en a deux
 *
 * · `consultation` — regarder. Ouvert à tous les rôles admin, `reader` compris.
 * · `ecriture` — les écrans qui CRÉENT ou MODIFIENT (`/new`, `/edit`). Ouverts
 *   aux rôles de `ROLES_ECRITURE`, donc fermés au seul `reader`.
 *
 * Les actes ENGAGEANTS ne sont pas gardés ici : ils le sont là où ils
 * s'exécutent, par `requireHabilitation`. C'est volontaire — une garde d'écran
 * ne doit jamais devenir le seul rempart d'un acte, sinon une action appelée par
 * un autre chemin passe.
 *
 * ## Ce que ce module rend, et pourquoi pas une redirection
 *
 * 🔴 P7 posait la question : « un écran vide pour cause de droits DIT-il que
 * c'est une question de droits ? » La réponse était non — les pages
 * redirigeaient vers `/login`, sans un mot. Une secrétaire à qui l'on demande
 * « où en est ce devis ? » se retrouvait sur un écran de connexion alors
 * qu'elle ÉTAIT connectée, et ne pouvait pas savoir si elle s'était trompée
 * d'adresse, si la fiche n'existait plus, ou si on lui refusait l'accès.
 *
 * D'où : redirection vers `/login` UNIQUEMENT quand il n'y a pas de session
 * (c'est alors la bonne réponse), et un REFUS NOMMÉ quand la session existe
 * mais que le rôle ne suffit pas.
 */
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { peutConsulter, peutEcrire, type RoleAdmin } from "@/server/auth/habilitations";

export type NiveauAcces = "consultation" | "ecriture";

export interface AccesAutorise {
  autorise: true;
  role: RoleAdmin;
  /** Raccourci d'affichage : faut-il masquer les boutons d'écriture ? */
  peutEcrire: boolean;
}

export interface AccesRefuse {
  autorise: false;
  role: RoleAdmin | null;
  /** Phrase destinée à l'écran — elle NOMME le rôle et ce qui manque. */
  motif: string;
}

export type ResultatAcces = AccesAutorise | AccesRefuse;

const LIBELLE_ROLE: Readonly<Record<RoleAdmin, string>> = {
  super_admin: "super-administrateur",
  admin: "administrateur",
  responsable_qualite: "responsable qualité",
  secretaire: "secrétaire",
  editor: "rédacteur",
  reader: "lecteur",
};

/**
 * Garde une page de la console.
 *
 * Redirige vers la connexion s'il n'y a pas de session ; rend un refus NOMMÉ si
 * la session existe mais que le rôle ne suffit pas.
 */
export async function gardePage(
  niveau: NiveauAcces,
  destinationLogin: string,
): Promise<ResultatAcces> {
  const session = await auth();
  const user = session?.user as { role?: string | null } | undefined;

  // Pas de session : la page de connexion EST la bonne réponse.
  if (!session?.user) redirect(destinationLogin);

  const role = (user?.role ?? null) as RoleAdmin | null;

  if (!peutConsulter(role)) {
    return {
      autorise: false,
      role,
      motif:
        "Votre compte n'a pas de rôle reconnu pour la console. Demandez à un " +
        "administrateur de vous en attribuer un.",
    };
  }

  if (niveau === "ecriture" && !peutEcrire(role)) {
    const libelle = role !== null ? LIBELLE_ROLE[role] : "inconnu";
    return {
      autorise: false,
      role,
      motif:
        `Cet écran crée ou modifie des données, et votre rôle (${libelle}) est un ` +
        `rôle de consultation. Vous pouvez consulter cet espace, mais pas y écrire.`,
    };
  }

  return { autorise: true, role: role as RoleAdmin, peutEcrire: peutEcrire(role) };
}
