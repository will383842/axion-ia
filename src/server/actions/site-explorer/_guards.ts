/**
 * RBAC guards pour les server actions Site Explorer / « Toutes les URLs ».
 * Pattern aligné sur src/server/actions/backups/_guards.ts.
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
