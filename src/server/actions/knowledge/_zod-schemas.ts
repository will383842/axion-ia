/**
 * Knowledge Base — Zod schemas pour les server actions admin (V1 KB-3).
 *
 * Convention : regroupés ici (pas 1 fichier par schema) pour DRY et lisibilité.
 * Étendus en KB-4 (publish/scheduled), KB-5 (translations bulk), KB-7 (search).
 *
 * Enums runtime : on importe les arrays depuis `src/content/knowledge/*` (SSOT).
 */

import { z } from "zod";
import { KB_AUDIENCES } from "@/content/knowledge/audiences";
import { KB_CONFIDENTIALITIES } from "@/content/knowledge/confidentialities";
import { KB_DOMAINS } from "@/content/knowledge/domains";
import { KB_PIPELINE_STAGES, KB_STATUSES } from "@/content/knowledge/statuses";
import { KB_TYPES } from "@/content/knowledge/types";

// Locale (aligné Prisma)
export const localeSchema = z.enum(["fr", "en"]);

// Slug : kebab-case ASCII, 2-180 chars.
export const slugSchema = z
  .string()
  .min(2)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug doit être en kebab-case ASCII");

// Translation input (1 par locale).
export const translationInputSchema = z.object({
  locale: localeSchema,
  title: z.string().min(2).max(255),
  slug: slugSchema,
  excerpt: z.string().max(500).optional().nullable(),
  body: z.string().default(""),
  bodyJson: z.unknown().optional().nullable(),
  bodyText: z.string().optional().nullable(),
  metaTitle: z.string().max(70).optional().nullable(),
  metaDescription: z.string().max(160).optional().nullable(),
});
export type TranslationInput = z.infer<typeof translationInputSchema>;

// Entry create input (KB-3 V1, no relations/tags/scheduled — KB-4 étend).
export const createEntryInputSchema = z.object({
  type: z.enum(KB_TYPES as readonly [string, ...string[]]),
  domain: z.enum(KB_DOMAINS as readonly [string, ...string[]]),
  audience: z.enum(KB_AUDIENCES as readonly [string, ...string[]]).default("team"),
  confidentiality: z
    .enum(KB_CONFIDENTIALITIES as readonly [string, ...string[]])
    .default("internal"),
  status: z.enum(KB_STATUSES as readonly [string, ...string[]]).default("draft"),
  pipelineStage: z.enum(KB_PIPELINE_STAGES as readonly [string, ...string[]]).default("idea"),
  slug: slugSchema,
  briefMarkdown: z.string().max(5000).optional().nullable(),
  targetWordCount: z.coerce.number().int().min(0).max(50000).optional().nullable(),
  targetKeyword: z.string().max(180).optional().nullable(),
  translations: z.array(translationInputSchema).min(1),
});
export type CreateEntryInput = z.infer<typeof createEntryInputSchema>;

// Entry update input — tous les champs optionnels (PATCH-style).
export const updateEntryInputSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(KB_TYPES as readonly [string, ...string[]]).optional(),
  domain: z.enum(KB_DOMAINS as readonly [string, ...string[]]).optional(),
  audience: z.enum(KB_AUDIENCES as readonly [string, ...string[]]).optional(),
  confidentiality: z.enum(KB_CONFIDENTIALITIES as readonly [string, ...string[]]).optional(),
  status: z.enum(KB_STATUSES as readonly [string, ...string[]]).optional(),
  pipelineStage: z.enum(KB_PIPELINE_STAGES as readonly [string, ...string[]]).optional(),
  slug: slugSchema.optional(),
  briefMarkdown: z.string().max(5000).optional().nullable(),
  targetWordCount: z.coerce.number().int().min(0).max(50000).optional().nullable(),
  targetKeyword: z.string().max(180).optional().nullable(),
});
export type UpdateEntryInput = z.infer<typeof updateEntryInputSchema>;

// Draft save (autosave — body content seulement, throttled côté client).
export const saveDraftInputSchema = z.object({
  entryId: z.string().uuid(),
  locale: localeSchema,
  title: z.string().min(0).max(255),
  body: z.string().optional(),
  bodyJson: z.unknown().optional().nullable(),
  bodyText: z.string().optional(),
  excerpt: z.string().max(500).optional().nullable(),
});
export type SaveDraftInput = z.infer<typeof saveDraftInputSchema>;

// Delete (soft-delete via deletedAt).
export const deleteEntryInputSchema = z.object({
  id: z.string().uuid(),
});
export type DeleteEntryInput = z.infer<typeof deleteEntryInputSchema>;
