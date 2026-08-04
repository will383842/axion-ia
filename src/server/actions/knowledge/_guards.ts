/**
 * Knowledge Base — RBAC guards pour les server actions.
 *
 * Pattern aligné sur `src/features/admin-blog/actions.ts` (`requireAdminWrite`/
 * `requireAdminRead`) + extension pour le rôle KB `REVIEWER` (mappé via metadata
 * Setting, Sprint KB-17 / Agent 9).
 *
 * V1 (KB-3) : 4 guards (read/write/publish/delete). Extensions KB-9 + KB-17.
 */

"use server";

import { auth } from "@/auth";

export interface AdminSession {
  readonly userId: string;
  readonly role: string;
}

export async function requireAdminRead(): Promise<AdminSession> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role ?? "reader";
  return { userId: session.user.id, role };
}

export async function requireAdminWrite(): Promise<AdminSession> {
  const session = await requireAdminRead();
  if (session.role !== "super_admin" && session.role !== "admin" && session.role !== "editor") {
    throw new Error("forbidden");
  }
  return session;
}

export async function requireAdminPublish(): Promise<AdminSession> {
  const session = await requireAdminRead();
  if (session.role !== "super_admin" && session.role !== "admin") {
    throw new Error("forbidden");
  }
  return session;
}

export async function requireAdminDelete(): Promise<AdminSession> {
  const session = await requireAdminRead();
  if (session.role !== "super_admin") {
    throw new Error("forbidden");
  }
  return session;
}

/**
 * Réservé au super-administrateur, pour une raison qui n'est PAS la suppression.
 *
 * `requireAdminDelete` impose déjà exactement le même rôle, et on aurait pu s'en
 * servir. On ne l'a pas fait : une garde se lit sur son nom, et faire dépendre
 * la lecture d'une donnée de santé d'une garde appelée « delete » aurait rendu
 * l'intention illisible — puis fragile le jour où quelqu'un assouplirait la
 * suppression sans penser à ce qu'elle protège d'autre.
 *
 * Premier appelant : la lecture du besoin d'adaptation déclaré par un
 * bénéficiaire (donnée de santé, RGPD art. 9).
 */
export async function requireSuperAdmin(): Promise<AdminSession> {
  const session = await requireAdminRead();
  if (session.role !== "super_admin") {
    throw new Error("forbidden");
  }
  return session;
}
