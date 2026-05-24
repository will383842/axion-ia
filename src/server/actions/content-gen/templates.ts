/**
 * Content Generator — CRUD ContentTemplate (admin /templates).
 *
 * § 12.1 master prompt — V1 = liste 9 ContentType × N variantes. Édition
 * système prompt + user template Tiptap + Zod schema + variant + expansionMode
 * + defaultModel override + Perplexity per-template toggle.
 */

"use server";

import * as Sentry from "@sentry/nextjs";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { ContentType, ExpansionMode } from "../../../../prisma/generated/client";
import { requireAdmin } from "./_auth";

// Sprint Final P1-3 — Zod runtime validation des inputs Server Actions.
const TemplateIdSchema = z.string().min(1).max(64);
const ContentTypeSchema = z.enum([
  "landing_ville",
  "blog_article",
  "blog_from_rss",
  "blog_from_keywords",
  "blog_from_title",
  "comparison",
  "guide_pilier",
  "qa_derived",
  "faq_standalone",
]);
// P0-NEW-1 — Aligner avec les 8 vraies valeurs DB enum ExpansionMode (schema.prisma:2568).
// Les valeurs précédentes (per_ville, per_keyword, all_departements, all_keywords…) étaient
// inexistantes en DB et causaient des erreurs Prisma silencieuses au upsert.
const ExpansionModeSchema = z.enum([
  "manual",
  "all_villes",
  "all_regions",
  "custom_villes",
  "from_keywords",
  "from_questions",
  "from_rss_items",
  "from_csv",
]);
const ListTemplatesFiltersSchema = z
  .object({
    contentType: ContentTypeSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
const UpsertTemplateInputSchema = z
  .object({
    id: TemplateIdSchema.optional(),
    slug: z.string().min(2).max(120),
    contentType: ContentTypeSchema,
    variant: z.string().min(1).max(120).optional(),
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    systemPrompt: z.string().min(30).max(100_000),
    userPromptTemplate: z.string().min(5).max(100_000),
    outputSchemaZod: z.string().max(50_000),
    variables: z.unknown(),
    expansionMode: ExpansionModeSchema,
    defaultModel: z.string().min(1).max(200).optional(),
    defaultTemperature: z.number().min(0).max(2).optional(),
    defaultMaxTokens: z.number().int().min(1).max(200_000).optional(),
    isActive: z.boolean(),
  })
  .strict();

function adminBase(): string {
  return `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/templates`;
}

export interface TemplateRow {
  readonly id: string;
  readonly slug: string;
  readonly contentType: ContentType;
  readonly variant: string | null;
  readonly version: number;
  readonly isActive: boolean;
  readonly name: string;
  readonly description: string | null;
  readonly expansionMode: ExpansionMode;
  readonly totalItems: number;
  readonly generatedItems: number;
  readonly publishedItems: number;
  readonly failedItems: number;
  readonly defaultModel: string | null;
  readonly estimatedCostUsd: string | null;
  readonly updatedAt: Date;
}

export interface TemplateDetail extends TemplateRow {
  readonly systemPrompt: string;
  readonly userPromptTemplate: string;
  readonly outputSchemaZod: string;
  readonly variables: unknown;
  readonly expansionValues: unknown;
  readonly defaultTemperature: string | null;
  readonly defaultMaxTokens: number | null;
}

export async function listTemplates(filters?: {
  contentType?: ContentType;
  isActive?: boolean;
}): Promise<ReadonlyArray<TemplateRow>> {
  // Sprint Final P1-3 — Zod runtime validation.
  if (filters !== undefined) ListTemplatesFiltersSchema.parse(filters);
  const rows = await prisma.contentTemplate.findMany({
    where: {
      ...(filters?.contentType ? { contentType: filters.contentType } : {}),
      ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
    },
    orderBy: [{ contentType: "asc" }, { variant: "asc" }, { version: "desc" }],
  });
  return rows.map(toRow);
}

export async function getTemplate(id: string): Promise<TemplateDetail | null> {
  // Sprint Final P1-3 — Zod runtime validation.
  TemplateIdSchema.parse(id);
  const r = await prisma.contentTemplate.findUnique({ where: { id } });
  if (!r) return null;
  return {
    ...toRow(r),
    systemPrompt: r.systemPrompt,
    userPromptTemplate: r.userPromptTemplate,
    outputSchemaZod: r.outputSchemaZod,
    variables: r.variables,
    expansionValues: r.expansionValues,
    defaultTemperature: r.defaultTemperature ? r.defaultTemperature.toString() : null,
    defaultMaxTokens: r.defaultMaxTokens,
  };
}

function toRow(r: {
  id: string;
  slug: string;
  contentType: ContentType;
  variant: string | null;
  version: number;
  isActive: boolean;
  name: string;
  description: string | null;
  expansionMode: ExpansionMode;
  totalItems: number;
  generatedItems: number;
  publishedItems: number;
  failedItems: number;
  defaultModel: string | null;
  estimatedCostUsd: unknown;
  updatedAt: Date;
}): TemplateRow {
  return {
    id: r.id,
    slug: r.slug,
    contentType: r.contentType,
    variant: r.variant,
    version: r.version,
    isActive: r.isActive,
    name: r.name,
    description: r.description,
    expansionMode: r.expansionMode,
    totalItems: r.totalItems,
    generatedItems: r.generatedItems,
    publishedItems: r.publishedItems,
    failedItems: r.failedItems,
    defaultModel: r.defaultModel,
    estimatedCostUsd: r.estimatedCostUsd ? String(r.estimatedCostUsd) : null,
    updatedAt: r.updatedAt,
  };
}

export interface UpsertTemplateInput {
  readonly id?: string;
  readonly slug: string;
  readonly contentType: ContentType;
  readonly variant?: string;
  readonly name: string;
  readonly description?: string;
  readonly systemPrompt: string;
  readonly userPromptTemplate: string;
  readonly outputSchemaZod: string;
  readonly variables: unknown;
  readonly expansionMode: ExpansionMode;
  readonly defaultModel?: string;
  readonly defaultTemperature?: number;
  readonly defaultMaxTokens?: number;
  readonly isActive: boolean;
}

export async function upsertTemplate(input: UpsertTemplateInput): Promise<string> {
  const session = await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation (structurel) avant checks métier.
  UpsertTemplateInputSchema.parse(input);
  if (input.slug.length < 2) throw new Error("slug_too_short");
  if (input.systemPrompt.length < 30) throw new Error("system_prompt_too_short");
  if (input.userPromptTemplate.length < 5) throw new Error("user_template_too_short");
  try {
    const data = {
      slug: input.slug,
      contentType: input.contentType,
      variant: input.variant ?? null,
      name: input.name,
      description: input.description ?? null,
      systemPrompt: input.systemPrompt,
      userPromptTemplate: input.userPromptTemplate,
      outputSchemaZod: input.outputSchemaZod,
      variables: input.variables as never,
      expansionMode: input.expansionMode,
      defaultModel: input.defaultModel ?? null,
      defaultTemperature: input.defaultTemperature ?? null,
      defaultMaxTokens: input.defaultMaxTokens ?? null,
      isActive: input.isActive,
    };
    let resultId: string;
    if (input.id) {
      const existing = await prisma.contentTemplate.findUnique({ where: { id: input.id } });
      const nextVersion = (existing?.version ?? 0) + 1;
      const r = await prisma.contentTemplate.update({
        where: { id: input.id },
        data: { ...data, version: nextVersion },
      });
      resultId = r.id;
    } else {
      const r = await prisma.contentTemplate.create({
        data: { ...data, version: 1, createdBy: session.userId },
      });
      resultId = r.id;
    }
    revalidatePath(adminBase());
    revalidatePath(`${adminBase()}/${resultId}`);
    return resultId;
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "upsertTemplate" } });
    throw e;
  }
}

export async function toggleTemplate(id: string, isActive: boolean): Promise<void> {
  await requireAdmin();
  // Sprint Final P1-3 — Zod runtime validation.
  TemplateIdSchema.parse(id);
  z.boolean().parse(isActive);
  try {
    await prisma.contentTemplate.update({ where: { id }, data: { isActive } });
    revalidatePath(adminBase());
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "toggleTemplate" } });
    throw e;
  }
}
