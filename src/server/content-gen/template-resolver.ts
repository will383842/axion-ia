/**
 * Template resolver — branche les `ContentTemplate` (DB, éditables console) au
 * pipeline de génération. 2026-06-15.
 *
 * Avant : les prompts vivaient UNIQUEMENT en dur dans les générateurs ; l'UI
 * admin /content-gen/templates était CRUD-dormante (jamais lue à la génération).
 *
 * Désormais : pour un `contentType` donné, on cherche un `ContentTemplate` ACTIF
 * (le plus récent). S'il existe, son `systemPrompt` / `temperature` / `maxTokens`
 * OVERRIDE les valeurs en dur du générateur. Sinon → fallback intégral sur le
 * prompt code (zéro régression). La voix de marque (doctrine) est TOUJOURS
 * ré-appliquée par-dessus un prompt de template (non négociable).
 *
 * Fail-soft : DB stub (build) / aucune ligne / erreur → null → fallback code.
 */

import { prisma } from "@/lib/prisma";
import type { ContentType } from "../../../prisma/generated/client";
import { injectBrandVoiceForType } from "@/server/content-gen/brand/brand-voice";

export interface TemplateOverride {
  readonly templateId: string;
  /** Prompt système éditable console (remplace celui en dur du générateur). */
  readonly systemPrompt?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

/**
 * Retourne l'override du template ACTIF pour ce contentType (+ variante
 * optionnelle), ou null si aucun / DB indisponible (fallback code).
 */
export async function resolveTemplateOverride(
  contentType: ContentType,
  variant?: string,
): Promise<TemplateOverride | null> {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return null;
  try {
    const tpl = await prisma.contentTemplate.findFirst({
      where: {
        contentType,
        isActive: true,
        ...(variant ? { variant } : {}),
      },
      orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        systemPrompt: true,
        defaultTemperature: true,
        defaultMaxTokens: true,
      },
    });
    if (!tpl) return null;
    const sp = tpl.systemPrompt?.trim();
    return {
      templateId: tpl.id,
      ...(sp ? { systemPrompt: sp } : {}),
      ...(tpl.defaultTemperature != null ? { temperature: Number(tpl.defaultTemperature) } : {}),
      ...(tpl.defaultMaxTokens != null ? { maxTokens: tpl.defaultMaxTokens } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Applique l'override de prompt système : si le template fournit un systemPrompt,
 * il REMPLACE le prompt code, mais la voix de marque (doctrine) est ré-appliquée
 * par-dessus. Sinon → prompt code inchangé.
 */
export function applySystemPromptOverride(
  codeSystemPrompt: string,
  override: TemplateOverride | undefined,
  contentType: string,
): string {
  if (!override?.systemPrompt) return codeSystemPrompt;
  return injectBrandVoiceForType(override.systemPrompt, contentType);
}
