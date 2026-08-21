// Server Actions admin /utilisateurs (M9 Tier 3 section 3 — ordre §14).
//
// 🔴 `D6-2-M1` (2026-08-20) — ce commentaire annonçait « 4 roles » alors que
// l'enum en portait SIX depuis le 2026-08-15, et c'est en le lisant qu'on
// oubliait `responsable_qualite` et `secretaire`. La liste vit désormais dans
// `ROLES_ADMIN` (`server/auth/habilitations.ts`) et ne se recopie plus nulle
// part : les schémas ci-dessous s'en déduisent.
// Doctrine §15 : super_admin gère les comptes (creation, role-change, reset
// 2FA cross-user, suspension). admin peut suspendre mais pas changer roles.
//
// Reset 2FA cross-user : super_admin uniquement (force twoFactorEnabled=false
// + clear secret). Le user concerne devra refaire le setup 2FA au prochain
// login.

"use server";

import { z } from "zod";
import { ROLES_ADMIN } from "@/server/auth/habilitations";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { hashPassword } from "@/lib/auth-password";
import { checkRateLimit } from "@/lib/rate-limit";
import { adminPath } from "@/lib/admin-path";
import type { AdminRole, AdminStatus } from "../../../prisma/generated/client";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin") throw new Error("forbidden");
  return { userId: session.user.id, role };
}
async function requireAdminRead() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  return session.user.id;
}

// ============================================================
// list / detail
// ============================================================

const listSchema = z.object({
  // ⚠️ `parse` (et non `safeParse`) : un rôle absent de cette liste ferait LEVER
  // la liste des comptes. Elle dérive donc du SSOT — un rôle attribuable est
  // toujours filtrable.
  role: z.enum([...ROLES_ADMIN, "all"]).default("all"),
  status: z.enum(["active", "suspended", "all"]).default("all"),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
});
export type ListUsersInput = z.infer<typeof listSchema>;

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: AdminStatus;
  twoFactorEnabled: boolean;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  createdAt: Date;
}

export async function listAdminUsersAction(input: Partial<ListUsersInput> = {}) {
  await requireAdminRead();
  const parsed = listSchema.parse(input);
  const where: Record<string, unknown> = {};
  if (parsed.role !== "all") where.role = parsed.role;
  if (parsed.status !== "all") where.status = parsed.status;
  if (parsed.search && parsed.search.length >= 2) {
    where.OR = [
      { name: { contains: parsed.search, mode: "insensitive" } },
      { email: { contains: parsed.search, mode: "insensitive" } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.adminUser.count({ where }),
    prisma.adminUser.findMany({
      where,
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      skip: (parsed.page - 1) * parsed.pageSize,
      take: parsed.pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
      },
    }),
  ]);
  return {
    items,
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
  };
}

export async function getAdminUserDetailAction(id: string) {
  await requireAdminRead();
  return prisma.adminUser.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      twoFactorEnabled: true,
      lastLoginAt: true,
      lastLoginIp: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// ============================================================
// create user (super_admin only)
// ============================================================

const createSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  password: z.string().min(12, "Mot de passe min 12 chars (CLAUDE.md §15)."),
  // 🔴 `D6-2-M1` (2026-08-20) — `responsable_qualite` et `secretaire`
  // MANQUAIENT à cette liste depuis leur création (migration du 2026-08-15).
  //
  // Les deux rôles existent dans l'enum Prisma, la matrice d'habilitation les
  // reconnaît, leurs tests passent — mais AUCUN chemin du produit ne permettait
  // de les attribuer. Le seul moyen de créer un tel compte était une commande
  // SQL à la main.
  //
  // 🔑 C'est la seconde moitié, jamais traitée, du défaut du 15-17/08 : la
  // première (les gardes qui ne les reconnaissaient pas) a été corrigée, celle
  // -ci est restée. Un rôle qu'on ne peut pas attribuer est un rôle qui
  // n'existe pas.
  role: z.enum(ROLES_ADMIN),
});
export type CreateUserState = { ok: true; id: string } | { ok: false; error: string };

export async function createAdminUserAction(
  _prev: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  let session;
  try {
    session = await requireSuperAdmin();
  } catch {
    return { ok: false, error: "Action réservée au super-admin." };
  }

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.adminUser.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash,
          role: parsed.data.role,
          status: "active",
        },
      });
      await tx.activityLog.create({
        data: {
          adminUserId: session.userId,
          action: "user.created",
          targetType: "admin_user",
          targetId: u.id,
          changes: { email: parsed.data.email, role: parsed.data.role },
          ipAddress: await getClientIp(),
        },
      });
      return u;
    });
    revalidatePath(adminPath("fr", "users"));
    return { ok: true, id: user.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "internal";
    if (msg.includes("Unique") || msg.includes("unique")) {
      return { ok: false, error: "Email déjà utilisé." };
    }
    return { ok: false, error: "Erreur interne." };
  }
}

// ============================================================
// update user (super_admin pour role-change ; admin+ pour suspend)
// ============================================================

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(255).optional(),
  role: z.enum(ROLES_ADMIN).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});
export type UpdateUserState = { ok: true } | { ok: false; error: string };

export async function updateAdminUserAction(
  _prev: UpdateUserState,
  formData: FormData,
): Promise<UpdateUserState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Session expirée." };
  const callerRole = (session.user as { role?: string }).role;

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name") || undefined,
    role: formData.get("role") || undefined,
    status: formData.get("status") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  // Role change reservée au super_admin
  if (parsed.data.role && callerRole !== "super_admin") {
    return { ok: false, error: "Changement de rôle réservé au super-admin." };
  }
  // admin peut suspendre mais pas se modifier lui-meme
  if (callerRole !== "super_admin" && callerRole !== "admin") {
    return { ok: false, error: "Permission insuffisante." };
  }
  if (parsed.data.id === session.user.id && parsed.data.status === "suspended") {
    return { ok: false, error: "Impossible de se suspendre soi-même." };
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name) data.name = parsed.data.name;
  if (parsed.data.role) data.role = parsed.data.role;
  if (parsed.data.status) data.status = parsed.data.status;

  await prisma.$transaction([
    prisma.adminUser.update({ where: { id: parsed.data.id }, data }),
    prisma.activityLog.create({
      data: {
        adminUserId: session.user.id,
        action: "user.updated",
        targetType: "admin_user",
        targetId: parsed.data.id,
        changes: data as Record<string, string>,
        ipAddress: await getClientIp(),
      },
    }),
  ]);
  revalidatePath(adminPath("fr", "users"));
  return { ok: true };
}

// ============================================================
// reset 2FA cross-user (super_admin only)
// ============================================================

const reset2FASchema = z.object({ id: z.string().uuid() });
export type Reset2FAState = { ok: true } | { ok: false; error: string };

export async function reset2FACrossUserAction(
  _prev: Reset2FAState,
  formData: FormData,
): Promise<Reset2FAState> {
  let session;
  try {
    session = await requireSuperAdmin();
  } catch {
    return { ok: false, error: "Action réservée au super-admin." };
  }

  // Rate limit anti-abus (Fork 1 W7-1 generalise au reset cross-user)
  const ip = await getClientIp();
  const rl = await checkRateLimit(`auth:reset2fa:${session.userId}`, {
    limit: 5,
    windowSec: 3600,
  });
  if (!rl.allowed) {
    return { ok: false, error: "Trop de resets 2FA. Réessayez dans 1h." };
  }

  const parsed = reset2FASchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "ID invalide." };

  await prisma.$transaction([
    prisma.adminUser.update({
      where: { id: parsed.data.id },
      data: {
        twoFactorEnabled: false,
        twoFactorVerified: false,
        twoFactorSecret: null,
      },
    }),
    prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "user.2fa_reset_cross",
        targetType: "admin_user",
        targetId: parsed.data.id,
        ipAddress: ip,
      },
    }),
  ]);
  revalidatePath(adminPath("fr", "users"));
  return { ok: true };
}

// ============================================================
// reset password cross-user (super_admin only)
// ============================================================

const resetPwdSchema = z.object({
  id: z.string().uuid(),
  newPassword: z.string().min(12),
});
export type ResetPasswordState = { ok: true } | { ok: false; error: string };

export async function resetPasswordCrossUserAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  let session;
  try {
    session = await requireSuperAdmin();
  } catch {
    return { ok: false, error: "Action réservée au super-admin." };
  }
  const parsed = resetPwdSchema.safeParse({
    id: formData.get("id"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.$transaction([
    prisma.adminUser.update({
      where: { id: parsed.data.id },
      data: { passwordHash },
    }),
    prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "user.password_reset_cross",
        targetType: "admin_user",
        targetId: parsed.data.id,
        ipAddress: await getClientIp(),
      },
    }),
  ]);
  revalidatePath(adminPath("fr", "users"));
  return { ok: true };
}
