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

/**
 * Cap de longueur raisonnable pour un systemPrompt de template console. Un
 * prompt légitime tient largement dans 8000 caractères ; au-delà, c'est soit
 * une erreur de copier-coller, soit une tentative de noyer le prompt système.
 */
const MAX_SYSTEM_PROMPT_LEN = 8000;

/**
 * Motifs d'injection de prompt classiques (FR + EN, insensible à la casse).
 * Un `systemPrompt` éditable en console admin est une surface d'attaque :
 * un compte admin compromis (ou un éditeur malveillant) pourrait y glisser
 * des instructions visant à faire ignorer la doctrine / les garde-fous.
 */
const PROMPT_INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+(all\s+)?(the\s+)?(previous|prior|above|preceding)/i,
  /disregard\s+(all\s+)?(the\s+)?(previous|prior|above|preceding|instructions)/i,
  /forget\s+(all\s+)?(the\s+)?(previous|prior|above|everything)/i,
  /override\s+(the\s+)?(system\s+)?(instructions|prompt|rules)/i,
  /\bsystem\s*:/i,
  /\b(you\s+are\s+now|act\s+as)\b.*\b(dan|jailbreak|unrestricted)\b/i,
  // FR
  /ignore[rz]?\s+(les\s+|tout(es)?\s+les\s+|toute\s+)?(instructions?|consignes?|précédent|precedent)/i,
  /oublie[rz]?\s+(tout(es)?\s+|les\s+)?(instructions?|consignes?|ce\s+qui\s+précède|ce\s+qui\s+precede)/i,
  /ne\s+tiens?\s+pas\s+compte\s+(des?\s+)?(instructions?|consignes?)/i,
  /remplace[rz]?\s+(les\s+)?(instructions?|consignes?|le\s+prompt)/i,
];

/**
 * Erreur dédiée : un template console a échoué la garde anti-injection.
 * Le caller (générateur) peut la catcher pour fallback sur le prompt code.
 */
export class TemplatePromptRejectedError extends Error {
  constructor(reason: string) {
    super(`ContentTemplate.systemPrompt rejeté: ${reason}`);
    this.name = "TemplatePromptRejectedError";
  }
}

/**
 * Garde anti-prompt-injection sur le `systemPrompt` éditable console.
 *
 * - (a) cap de longueur (`MAX_SYSTEM_PROMPT_LEN`) ;
 * - (b) rejet des motifs d'injection connus (FR + EN, casse-insensible).
 *
 * Comportement : THROW `TemplatePromptRejectedError` si un motif est détecté
 * ou si la longueur dépasse le cap (un log warn est émis). Les templates
 * légitimes passent inchangés (retour de la string trimmée d'origine). Ce
 * choix « throw » (vs strip) garantit qu'un prompt suspect ne fuit JAMAIS
 * partiellement dans le LLM — le générateur fallback sur le prompt code.
 */
export function guardTemplateSystemPrompt(systemPrompt: string): string {
  if (systemPrompt.length > MAX_SYSTEM_PROMPT_LEN) {
    console.warn(
      `[template-resolver] systemPrompt rejeté: longueur ${systemPrompt.length} > ${MAX_SYSTEM_PROMPT_LEN}`,
    );
    throw new TemplatePromptRejectedError(
      `longueur ${systemPrompt.length} > ${MAX_SYSTEM_PROMPT_LEN}`,
    );
  }
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(systemPrompt)) {
      console.warn(
        `[template-resolver] systemPrompt rejeté: motif d'injection détecté (${pattern})`,
      );
      throw new TemplatePromptRejectedError(`motif d'injection détecté (${pattern.source})`);
    }
  }
  return systemPrompt;
}

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
    let sp: string | undefined = tpl.systemPrompt?.trim();
    // Garde anti-injection : un systemPrompt suspect est ÉCARTÉ (sp → undefined)
    // → fallback intégral sur le prompt code (zéro régression, zéro fuite).
    if (sp) {
      try {
        sp = guardTemplateSystemPrompt(sp);
      } catch (err) {
        if (err instanceof TemplatePromptRejectedError) {
          console.warn(
            `[template-resolver] template ${tpl.id} (${contentType}) écarté: ${err.message}`,
          );
          sp = undefined;
        } else {
          throw err;
        }
      }
    }
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
  // Defense-in-depth : re-garde au point d'injection (l'override peut avoir été
  // construit hors resolveTemplateOverride). Si suspect → fallback prompt code.
  try {
    guardTemplateSystemPrompt(override.systemPrompt);
  } catch (err) {
    if (err instanceof TemplatePromptRejectedError) {
      console.warn(`[template-resolver] applySystemPromptOverride écarté: ${err.message}`);
      return codeSystemPrompt;
    }
    throw err;
  }
  return injectBrandVoiceForType(override.systemPrompt, contentType);
}
