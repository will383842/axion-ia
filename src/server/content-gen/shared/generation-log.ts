/**
 * Content Generator — Audit trail immuable (Pass B fix P0-8 + audit B5 P1-1).
 *
 * Helper centralisé pour écrire dans `GenerationLog` (table Prisma définie
 * schema.prisma:2808). L'audit interne du 14-mai avait noté la table comme
 * définie mais le Pass B a constaté qu'elle n'était **jamais écrite** par
 * le code (`prisma.generationLog.create` introuvable dans src/).
 *
 * **Doctrine § 0.5 master prompt + RGPD article 30** :
 * - Trace immuable de quel LLM (provider + model) a produit quel contenu
 * - Step granularité : `kb_retrieve` | `llm_call` | `image_search` |
 *   `validation` | `publish` | `quality_check` | `plagiarism_check` |
 *   `doctrine_check` | `kill_switch_check` | `dedup_check` | `error`
 * - Append-only : jamais UPDATE/DELETE (la table n'expose pas ces ops via
 *   l'API helper). Suppression OK uniquement via cascade ContentGenJob ou
 *   purge RGPD explicite.
 * - Metadata Json : duration_ms, tokens_used, cost_usd, kb_chunk_ids, etc.
 *
 * **PII redaction filet (audit B5 P1-1)** : tout `metadata` passe par
 * `redactGenerationMetadata()` avant insert DB. Whitelist + redaction des
 * champs PII connus (`email`, `name`, `phone` etc.). Sans cost runtime
 * significatif (Object.entries sur ~20 clés). Filet de sécurité :
 * l'appelant reste responsable de ne pas y mettre du PII en clair.
 *
 * **Erreurs swallowées** : le log audit ne doit JAMAIS faire échouer la
 * pipeline de génération (si Prisma down ou table absente, on log console
 * et continue). C'est observable, pas critique.
 */

import { prisma } from "@/lib/prisma";
import { redactGenerationMetadata } from "@/server/content-gen/lib/pii-safe";

export type GenerationLogLevel = "debug" | "info" | "warn" | "error";

export type GenerationLogStep =
  | "kb_retrieve"
  | "llm_call"
  | "image_search"
  | "validation"
  | "publish"
  | "quality_check"
  | "plagiarism_check"
  | "intent_check"
  | "doctrine_check"
  | "kill_switch_check"
  | "dedup_check"
  | "seo_score"
  | "readability"
  | "indexnow_ping"
  | "google_indexing_ping"
  | "rss_fetch"
  | "qa_extract"
  | "json_ld_news_article"
  | "json_ld_qa_page"
  | "fact_check_enqueue"
  | "revalidate_path"
  | "article_insert"
  | "translation_insert"
  | "faq_upsert"
  | "web_vital_sample"
  | "web_vital_alert"
  | "cost_cap_check"
  | "auto_kill_switch"
  | "error";

export interface LogGenerationArgs {
  readonly jobId: string;
  readonly level: GenerationLogLevel;
  readonly step: GenerationLogStep;
  readonly message: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Trace une étape de génération content-gen dans GenerationLog.
 * Append-only, swallow errors (observable pas critique).
 */
export async function logGeneration(args: LogGenerationArgs): Promise<void> {
  // Audit B5 P1-1 — PII redaction filet : tout metadata passe par
  // redactGenerationMetadata() avant insert DB. Cheap (whitelist Object.entries)
  // et idempotent : si l'appelant n'a pas mis de PII, le résultat est identique.
  const safeMetadata =
    args.metadata !== undefined ? redactGenerationMetadata(args.metadata) : undefined;
  try {
    await prisma.generationLog.create({
      data: {
        jobId: args.jobId,
        level: args.level,
        step: args.step,
        message: args.message.slice(0, 5000), // hard cap message size
        ...(safeMetadata !== undefined ? { metadata: safeMetadata as never } : {}),
      },
    });
  } catch (err) {
    // Audit trail non-critique : si Prisma down ou table absente, on console
    // log et continue. Évite de casser le pipeline de génération pour un
    // problème d'observabilité.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[generation-log] failed to write audit trail", err);
    }
  }
}

/** Helper raccourci pour logger un step info. */
export async function logStep(
  jobId: string,
  step: GenerationLogStep,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  return logGeneration({
    jobId,
    level: "info",
    step,
    message,
    ...(metadata !== undefined ? { metadata } : {}),
  });
}

/** Helper raccourci pour logger une erreur step. */
export async function logStepError(
  jobId: string,
  step: GenerationLogStep,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  return logGeneration({
    jobId,
    level: "error",
    step,
    message,
    ...(metadata !== undefined ? { metadata } : {}),
  });
}
