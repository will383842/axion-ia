// Documents interventions — RBAC guards pour les server actions.
// Pattern aligné sur `src/server/actions/knowledge/_guards.ts` et `admin-blog`.
// read = tout admin connecté ; write = editor+ ; publish/delete = admin+.

"use server";

import { auth } from "@/auth";

export interface AdminSession {
  readonly userId: string;
  readonly email: string;
  readonly role: string;
}

export async function requireAdminRead(): Promise<AdminSession> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const user = session.user as { id: string; email?: string | null; role?: string };
  return { userId: user.id, email: user.email ?? "", role: user.role ?? "reader" };
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
