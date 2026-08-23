/**
 * Console éditoriale — gardes RBAC des Server Actions (§4 du plan).
 *
 * Pattern aligné sur `src/server/actions/backups/_guards.ts`, avec une
 * différence essentielle : la console éditoriale a **sa propre** matrice de
 * rôles, portée par `ed_membres`, et non le `AdminUser.role` du reste de la
 * console. Un `editor` de l'administration n'est pas un `stratege` éditorial.
 *
 * La décision d'autorisation elle-même vit dans `@/server/editorial/permissions`
 * — module PUR, testé cellule par cellule. Ici on ne fait que : identifier,
 * résoudre le membre, appliquer, journaliser.
 */

"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  peut,
  messageRefus,
  roleDeduitDepuisAdmin,
  type ActionEditoriale,
  type RoleEditorial,
} from "@/server/editorial/permissions";
import type { Prisma } from "../../../../prisma/generated/client";

export interface MembreEditorial {
  /** `AdminUser.id` — toujours présent, c'est l'identité authentifiée. */
  readonly userId: string;
  /**
   * `EdMembre.id` — `null` tant qu'aucun membre n'est déclaré pour ce
   * compte. C'est le cas NORMAL d'une console à un seul utilisateur, pas
   * une anomalie : voir `auteurUserId` sur `EdJournal` pour la trace.
   */
  readonly membreId: string | null;
  readonly role: RoleEditorial;
  readonly nom: string;
}

/**
 * Identifie l'utilisateur et résout son rôle ÉDITORIAL.
 *
 * Deux cas, dans cet ordre :
 *
 * 1. Un `EdMembre` est rattaché à ce `AdminUser` → **c'est lui qui fait foi**,
 *    quel que soit le rôle d'administration.
 * 2. Aucun `EdMembre` → rôle déduit du rôle d'administration, et seulement
 *    `super_admin`/`admin` obtiennent `admin` éditorial. C'est l'amorçage
 *    prévu par le §1 ter (« un seul utilisateur au départ »), pas une porte
 *    dérobée : voir `roleDeduitDepuisAdmin`.
 */
export async function requireMembreEditorial(): Promise<MembreEditorial> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("unauthorized");

  const membre = await prisma.edMembre.findUnique({
    where: { userId },
    select: { id: true, role: true, nom: true, actif: true },
  });

  if (membre) {
    // Un membre désactivé n'est pas un membre : il retombe en lecture, sans
    // perdre son identité (le journal doit continuer à savoir qui agit).
    return {
      userId,
      membreId: membre.id,
      role: membre.actif ? (membre.role as RoleEditorial) : "lecture",
      nom: membre.nom,
    };
  }

  const roleAdmin = (session.user as { role?: string }).role;
  return {
    userId,
    membreId: null,
    role: roleDeduitDepuisAdmin(roleAdmin),
    nom: session.user.name ?? session.user.email ?? "inconnu",
  };
}

/**
 * Identifie ET exige une permission précise.
 *
 * Le refus **cite la règle** — « un refus silencieux est un échec »
 * (passe 4 du protocole). Le message nomme l'action, le rôle, et les rôles
 * qui auraient eu le droit.
 */
export async function requirePermission(action: ActionEditoriale): Promise<MembreEditorial> {
  const membre = await requireMembreEditorial();
  if (!peut(membre.role, action)) {
    throw new Error(messageRefus(membre.role, action));
  }
  return membre;
}

/**
 * Journalise une mutation dans `EdJournal`.
 *
 * ⚠️ **Best-effort, jamais bloquant.** Un journal qui tombe ne doit pas
 * annuler une écriture déjà faite — mais il crie dans les logs, parce qu'un
 * journal muet qui échoue en silence ne vaut rien non plus.
 *
 * Passer `tx` quand l'écriture est dans une transaction : le journal entre
 * alors ou sort avec elle.
 */
export async function journaliser(
  input: {
    entite: string;
    entiteId: string;
    action: string;
    membreId?: string | null;
    avant?: unknown;
    apres?: unknown;
  },
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? prisma;

  // 🔴 L'auteur est résolu ICI, et pas passé par l'appelant.
  //
  // Défaut trouvé par les passes 2 et 5 du protocole, séparément : toutes
  // les entrées portaient `membre_id = NULL`, parce que la clé étrangère
  // vise `ed_membres` et qu'une console « à un seul utilisateur au départ »
  // n'a aucun membre déclaré. Le critère 3 du lot 4 — « toute mutation au
  // journal AVEC SON AUTEUR » — n'était donc jamais tenu, y compris pour
  // les 74 entrées de l'import.
  //
  // Résoudre ici plutôt qu'à l'appel garantit qu'aucun chemin ne l'oublie :
  // 26 appels à `journaliser` existent, et il suffisait d'en manquer un.
  let auteur: { userId: string; nom: string } | null = null;
  try {
    const session = await auth();
    const uid = session?.user?.id;
    if (uid) {
      auteur = { userId: uid, nom: session?.user?.name ?? session?.user?.email ?? uid };
    }
  } catch {
    // Hors requête — un script d'amorçage, un import en ligne de commande.
    // L'absence d'auteur est alors la VÉRITÉ, et l'inventer serait pire.
  }

  try {
    // Les clés `avant`/`apres` ne sont posées QUE si elles ont une valeur :
    // sous `exactOptionalPropertyTypes`, une clé présente valant `undefined`
    // n'est pas la même chose qu'une clé absente, et Prisma refuse la première.
    await client.edJournal.create({
      data: {
        entite: input.entite,
        entiteId: input.entiteId,
        action: input.action,
        membreId: input.membreId ?? null,
        auteurUserId: auteur?.userId ?? null,
        auteurNom: auteur?.nom ?? null,
        ...(input.avant !== undefined ? { avant: input.avant as Prisma.InputJsonValue } : {}),
        ...(input.apres !== undefined ? { apres: input.apres as Prisma.InputJsonValue } : {}),
      },
    });
  } catch (e) {
    console.error(
      `[editorial] journalisation échouée pour ${input.entite}/${input.entiteId} ` +
        `(${input.action}) :`,
      e,
    );
  }
}
