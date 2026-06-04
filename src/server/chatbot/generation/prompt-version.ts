// Prompt système versionné + rollback (T-20, REQ-040/077) — backend.
//
// Le system-prompt par défaut est codé dans system-prompt.ts (fallback). Un tenant
// peut publier des versions de prompt dans chat_prompt_versions ; UNE seule est
// `actif` à la fois. assembleSystemPrompt utilise le contenu actif s'il existe.
// Activer une version antérieure = rollback en 1 appel (admin console, à venir).

import { prisma } from "@/lib/prisma";

export interface PromptVersionSummary {
  readonly version: number;
  readonly actif: boolean;
  readonly note: string | null;
  readonly createdAt: Date;
}

/** Contenu du prompt actif d'un tenant, ou null (→ fallback codé). */
export async function getActivePromptContent(tenantId: string): Promise<string | null> {
  const row = await prisma.chatPromptVersion.findFirst({
    where: { tenantId, actif: true },
    orderBy: { version: "desc" },
    select: { contenu: true },
  });
  return row?.contenu ?? null;
}

/** Crée une nouvelle version (inactive par défaut). Retourne son numéro. */
export async function createPromptVersion(
  tenantId: string,
  contenu: string,
  note?: string,
): Promise<{ version: number }> {
  const last = await prisma.chatPromptVersion.findFirst({
    where: { tenantId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;
  await prisma.chatPromptVersion.create({
    data: { tenantId, contenu, version, actif: false, ...(note ? { note } : {}) },
  });
  return { version };
}

/**
 * Active une version (rollback/forward). Désactive l'actuelle dans la même
 * transaction → invariant « une seule version active par tenant ».
 */
export async function activatePromptVersion(tenantId: string, version: number): Promise<void> {
  await prisma.$transaction([
    prisma.chatPromptVersion.updateMany({
      where: { tenantId, actif: true },
      data: { actif: false },
    }),
    prisma.chatPromptVersion.updateMany({
      where: { tenantId, version },
      data: { actif: true },
    }),
  ]);
}

/** Liste les versions d'un tenant (récentes d'abord) — pour la console admin. */
export async function listPromptVersions(tenantId: string): Promise<PromptVersionSummary[]> {
  return prisma.chatPromptVersion.findMany({
    where: { tenantId },
    orderBy: { version: "desc" },
    select: { version: true, actif: true, note: true, createdAt: true },
  });
}
