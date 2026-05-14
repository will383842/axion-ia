/**
 * Content Generator — Auth guard partagé pour Server Actions admin.
 *
 * Pattern : toute Server Action content-gen DOIT appeler `requireAdmin()`
 * en première ligne. Si la session est absente ou n'a pas le rôle admin,
 * on throw "unauthorized" ou "forbidden" (compat existing knowledge guards).
 *
 * Doctrine § 4.1bis : tout effet de bord côté admin DOIT passer par une
 * Server Action (pas d'appel client → API direct).
 */

"use server";

import { auth } from "@/auth";

export interface AdminSession {
  readonly userId: string;
  readonly email: string;
  readonly role: string;
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role ?? "reader";
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    throw new Error("forbidden");
  }
  return { userId: session.user.id, email: session.user.email, role };
}

export async function requireSuperAdmin(): Promise<AdminSession> {
  const session = await requireAdmin();
  if (session.role !== "super_admin") throw new Error("forbidden");
  return session;
}
