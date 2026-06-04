// Server actions — console admin chatbot (T-19/21/25, ADR-CB-07).
//
// Lecture : stats dashboard, escalades, conversations, versions de prompt.
// Mutations : résoudre une escalade, activer une version de prompt (rollback).
// RBAC : lecture = requireAdminRead ; mutations = requireAdminWrite. Chaque
// mutation trace un ActivityLog (forensique art. 30) + revalidatePath.
// FR-only (interface admin). Toutes les routes /chatbot/** sont dynamiques.

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { adminPath } from "@/lib/admin-path";
import { requireAdminRead, requireAdminWrite } from "@/server/actions/knowledge/_guards";
import {
  activatePromptVersion,
  createPromptVersion,
  listPromptVersions,
} from "@/server/chatbot/generation/prompt-version";

const PAGE_SIZE = 25;

// ── Dashboard ───────────────────────────────────────────────────────────────

export interface ChatbotDashboardStats {
  readonly conversations: number;
  readonly messages: number;
  readonly escalationsOpen: number;
  readonly escalationsTotal: number;
  readonly cacheHits: number;
  readonly costUsd: number;
}

export async function getChatbotDashboardStats(): Promise<ChatbotDashboardStats> {
  await requireAdminRead();
  const [conversations, messages, escalationsOpen, escalationsTotal, cacheHits, cost] =
    await Promise.all([
      prisma.chatConversation.count(),
      prisma.chatMessage.count(),
      prisma.chatEscalation.count({ where: { statut: "ouverte" } }),
      prisma.chatEscalation.count(),
      prisma.chatMessage.count({ where: { servedFromCache: true } }),
      prisma.chatMessage.aggregate({ _sum: { coutEstime: true } }),
    ]);
  return {
    conversations,
    messages,
    escalationsOpen,
    escalationsTotal,
    cacheHits,
    costUsd: Number(cost._sum.coutEstime ?? 0),
  };
}

// ── Escalades ─────────────────────────────────────────────────────────────────

export interface EscalationRow {
  readonly id: string;
  readonly question: string;
  readonly contactEmail: string | null;
  readonly statut: string;
  readonly emailEnvoye: boolean;
  readonly createdAt: Date;
}

export interface EscalationListResult {
  readonly items: ReadonlyArray<EscalationRow>;
  readonly total: number;
  readonly page: number;
  readonly totalPages: number;
}

export async function listEscalations(opts: {
  statut?: string;
  page?: number;
}): Promise<EscalationListResult> {
  await requireAdminRead();
  const page = Math.max(1, opts.page ?? 1);
  const where = opts.statut ? { statut: opts.statut } : {};
  const [items, total] = await Promise.all([
    prisma.chatEscalation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        question: true,
        contactEmail: true,
        statut: true,
        emailEnvoye: true,
        createdAt: true,
      },
    }),
    prisma.chatEscalation.count({ where }),
  ]);
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type ResolveEscalationState = { ok: true } | { ok: false; error: string };

const resolveSchema = z.object({ id: z.string().uuid() });

export async function resolveEscalationAction(
  _prev: ResolveEscalationState,
  formData: FormData,
): Promise<ResolveEscalationState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const parsed = resolveSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Identifiant invalide." };

  try {
    await prisma.chatEscalation.update({
      where: { id: parsed.data.id },
      data: { statut: "resolue" },
    });
    await prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "chatbot.escalation.resolved",
        targetType: "chat_escalation",
        targetId: parsed.data.id,
        ipAddress: await getClientIp(),
      },
    });
    revalidatePath(adminPath("fr", "chatbot/escalades"));
    revalidatePath(adminPath("fr", "chatbot"));
    return { ok: true };
  } catch {
    return { ok: false, error: "Erreur interne." };
  }
}

// ── Conversations ─────────────────────────────────────────────────────────────

export interface ConversationRow {
  readonly id: string;
  readonly sessionUuid: string;
  readonly statut: string;
  readonly messageCount: number;
  readonly hasLead: boolean;
  readonly createdAt: Date;
}

export interface ConversationListResult {
  readonly items: ReadonlyArray<ConversationRow>;
  readonly total: number;
  readonly page: number;
  readonly totalPages: number;
}

export async function listConversations(opts: { page?: number }): Promise<ConversationListResult> {
  await requireAdminRead();
  const page = Math.max(1, opts.page ?? 1);
  const [rows, total] = await Promise.all([
    prisma.chatConversation.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        sessionUuid: true,
        statut: true,
        submissionId: true,
        createdAt: true,
        _count: { select: { messages: true } },
      },
    }),
    prisma.chatConversation.count(),
  ]);
  const items = rows.map((r) => ({
    id: r.id,
    sessionUuid: r.sessionUuid,
    statut: r.statut,
    messageCount: r._count.messages,
    hasLead: r.submissionId !== null,
    createdAt: r.createdAt,
  }));
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export interface ConversationMessageRow {
  readonly id: string;
  readonly role: string;
  readonly contenu: string;
  readonly servedFromCache: boolean;
  readonly createdAt: Date;
}

export interface ConversationDetail {
  readonly id: string;
  readonly sessionUuid: string;
  readonly statut: string;
  readonly resume: string | null;
  readonly createdAt: Date;
  readonly messages: ReadonlyArray<ConversationMessageRow>;
}

export async function getConversationDetail(id: string): Promise<ConversationDetail | null> {
  await requireAdminRead();
  return prisma.chatConversation.findUnique({
    where: { id },
    select: {
      id: true,
      sessionUuid: true,
      statut: true,
      resume: true,
      createdAt: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, contenu: true, servedFromCache: true, createdAt: true },
      },
    },
  });
}

// ── Prompt versionné (rollback) ───────────────────────────────────────────────

export async function listChatbotPromptVersions(tenantId: string) {
  await requireAdminRead();
  return listPromptVersions(tenantId);
}

export type CreatePromptState = { ok: true; version: number } | { ok: false; error: string };

const createSchema = z.object({
  tenantId: z.string().uuid(),
  contenu: z.string().min(20).max(20000),
  note: z.string().max(200).optional(),
});

export async function createPromptVersionAction(
  _prev: CreatePromptState,
  formData: FormData,
): Promise<CreatePromptState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const parsed = createSchema.safeParse({
    tenantId: formData.get("tenantId"),
    contenu: formData.get("contenu"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }
  try {
    const { version } = await createPromptVersion(
      parsed.data.tenantId,
      parsed.data.contenu,
      parsed.data.note,
    );
    await prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "chatbot.prompt.created",
        targetType: "chat_prompt_version",
        targetId: `${parsed.data.tenantId}:v${version}`,
        changes: { version },
        ipAddress: await getClientIp(),
      },
    });
    revalidatePath(adminPath("fr", "chatbot/prompt"));
    return { ok: true, version };
  } catch {
    return { ok: false, error: "Erreur interne." };
  }
}

export type ActivatePromptState = { ok: true } | { ok: false; error: string };

const activateSchema = z.object({
  tenantId: z.string().uuid(),
  version: z.coerce.number().int().positive(),
});

export async function activatePromptVersionAction(
  _prev: ActivatePromptState,
  formData: FormData,
): Promise<ActivatePromptState> {
  let session;
  try {
    session = await requireAdminWrite();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }
  const parsed = activateSchema.safeParse({
    tenantId: formData.get("tenantId"),
    version: formData.get("version"),
  });
  if (!parsed.success) return { ok: false, error: "Paramètres invalides." };

  try {
    await activatePromptVersion(parsed.data.tenantId, parsed.data.version);
    await prisma.activityLog.create({
      data: {
        adminUserId: session.userId,
        action: "chatbot.prompt.activated",
        targetType: "chat_prompt_version",
        targetId: `${parsed.data.tenantId}:v${parsed.data.version}`,
        changes: { version: parsed.data.version },
        ipAddress: await getClientIp(),
      },
    });
    revalidatePath(adminPath("fr", "chatbot/prompt"));
    return { ok: true };
  } catch {
    return { ok: false, error: "Erreur interne." };
  }
}
