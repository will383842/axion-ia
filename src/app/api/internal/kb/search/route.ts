/**
 * KB-7 — Endpoint REST interne /api/internal/kb/search.
 *
 * Public (audience=public uniquement par défaut) — rate limit appliqué Sprint KB-12.
 * Locale FR par défaut, EN via ?locale=en.
 *
 * Query params :
 * - q (required) : query string
 * - locale=fr|en (default fr)
 * - type=article,case_study,... (CSV, optional)
 * - limit=N (default 25, max 100)
 * - offset=N (default 0)
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { searchKnowledge } from "@/lib/knowledge/search-fts";
import type { KbType, Locale } from "../../../../../../prisma/generated/client";
import { KB_TYPES } from "@/content/knowledge/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({
  q: z.string().min(1).max(200),
  locale: z.enum(["fr", "en"]).default("fr"),
  type: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!params.success) {
    return NextResponse.json(
      { error: "validation", fieldErrors: params.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const types = params.data.type
    ? (params.data.type
        .split(",")
        .map((t) => t.trim())
        .filter((t) => (KB_TYPES as readonly string[]).includes(t)) as KbType[])
    : undefined;

  const result = await searchKnowledge({
    query: params.data.q,
    locale: params.data.locale as Locale,
    ...(types && types.length > 0 ? { types } : {}),
    audiences: ["public"],
    limit: params.data.limit,
    offset: params.data.offset,
  });

  return NextResponse.json(result, {
    status: 200,
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=600" },
  });
}
