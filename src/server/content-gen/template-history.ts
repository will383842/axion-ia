/**
 * ContentTemplateHistory — snapshot append-only des prompts d'un ContentTemplate.
 *
 * Câblage : `upsertTemplate()` (cf src/server/actions/content-gen/templates.ts)
 * appelle `recordTemplateHistory()` AVANT le `prisma.contentTemplate.update()`
 * pour figer les valeurs PRE-édition (systemPrompt / userPromptTemplate /
 * outputSchemaZod / model / température / maxTokens). Cela permet un rollback /
 * diff éditorial des prompts content-gen depuis la console admin.
 *
 * Versioning : la `version` de l'historique est PROPRE à la table history
 * (séquence par templateId), distincte de `ContentTemplate.version`. On prend
 * `max(version existant) + 1`, premier snapshot = 1. La contrainte unique
 * [templateId, version] protège contre les doublons.
 *
 * Fail-open (best-effort) : un échec d'écriture history NE DOIT JAMAIS bloquer
 * l'édition du template. On warn (dev) / Sentry (prod via instrumentation) et on
 * laisse l'update principal continuer. Une race sur [templateId, version] (deux
 * édits concurrents) est traitée comme un échec fail-open : l'historique peut
 * perdre un snapshot, l'édition reste cohérente.
 */

import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";

export interface TemplateHistorySnapshot {
  readonly templateId: string;
  readonly systemPrompt?: string | null;
  readonly userPromptTemplate?: string | null;
  readonly outputSchemaZod?: string | null;
  readonly model?: string | null;
  /** Décimal (3,2) — passé en string/number, Prisma cast. */
  readonly defaultTemperature?: string | number | null;
  readonly defaultMaxTokens?: number | null;
  readonly changedBy?: string | null;
}

/**
 * Écrit un snapshot de l'état PRE-édition des prompts d'un template.
 *
 * Best-effort : ne throw jamais. L'appelant peut ignorer le retour ; en cas
 * d'échec (race unique, DB indispo, stub build-time) on capture côté Sentry et
 * on warn en dev, puis on retourne sans propager.
 */
export async function recordTemplateHistory(snapshot: TemplateHistorySnapshot): Promise<void> {
  try {
    const last = await prisma.contentTemplateHistory.findFirst({
      where: { templateId: snapshot.templateId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (last?.version ?? 0) + 1;

    await prisma.contentTemplateHistory.create({
      data: {
        templateId: snapshot.templateId,
        version: nextVersion,
        systemPrompt: snapshot.systemPrompt ?? null,
        userPromptTemplate: snapshot.userPromptTemplate ?? null,
        outputSchemaZod: snapshot.outputSchemaZod ?? null,
        model: snapshot.model ?? null,
        defaultTemperature: snapshot.defaultTemperature ?? null,
        defaultMaxTokens: snapshot.defaultMaxTokens ?? null,
        changedBy: snapshot.changedBy ?? null,
      },
    });
  } catch (err) {
    // Fail-open : l'édition du template DOIT réussir même si le snapshot échoue
    // (race sur [templateId, version], DB indispo, Proxy stub build-time…).
    Sentry.captureException(err, {
      tags: { area: "content-gen", action: "recordTemplateHistory" },
    });
    if (process.env["NODE_ENV"] !== "production") {
      console.warn("[template-history] failed to snapshot template prompts", err);
    }
  }
}
