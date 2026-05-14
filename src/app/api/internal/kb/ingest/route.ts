/**
 * KB V4 (Sprint KB-13) — Endpoint REST factory ingest.
 *
 * POST /api/internal/kb/ingest
 *
 * Auth : HMAC-SHA256 header `X-KB-Signature` (secret env `KB_INGEST_SECRET`).
 * Idempotency : header `X-Idempotency-Key` (UUID v4) obligatoire.
 * Rate limit : V1 simple (Redis bucket Sprint KB-17 V4 raffinera).
 *
 * Réponses :
 * - 202 Accepted : entry queuée/processed avec status (published/team_review)
 * - 400 Bad Request : payload invalide (Zod)
 * - 401 Unauthorized : HMAC manquant/invalide
 * - 409 Conflict : idempotency-key déjà utilisée (renvoie entryId existant)
 * - 422 Unprocessable : quality/PII/banned/dedup gate failed
 * - 500 Internal : erreur serveur
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getKbIngestSecret, verifyKbSignature } from "@/lib/knowledge/hmac";
import { assertKillSwitchInactive, KillSwitchEngagedError } from "@/lib/knowledge/kill-switch";
import { KB_TYPES } from "@/content/knowledge/types";
import { KB_DOMAINS } from "@/content/knowledge/domains";
import { KB_AUDIENCES } from "@/content/knowledge/audiences";
import { KB_CONFIDENTIALITIES } from "@/content/knowledge/confidentialities";
import { ingestEntry, type IngestPayload } from "@/server/actions/knowledge/ingest";
import type {
  KbAudience,
  KbConfidentiality,
  KbDomain,
  KbType,
} from "../../../../../../prisma/generated/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IngestBodySchema = z.object({
  type: z.enum(KB_TYPES as unknown as readonly [string, ...string[]]),
  title: z.string().min(10).max(200),
  body: z.string().min(1),
  bodyJson: z.unknown().optional(),
  bodyText: z.string().optional(),
  excerpt: z.string().min(40).max(300).optional(),
  tags: z.array(z.string().min(2).max(60)).min(0).max(10).optional(),
  domain: z.enum(KB_DOMAINS as unknown as readonly [string, ...string[]]),
  audience: z.enum(KB_AUDIENCES as unknown as readonly [string, ...string[]]).default("public"),
  confidentiality: z
    .enum(KB_CONFIDENTIALITIES as unknown as readonly [string, ...string[]])
    .default("public"),
  language: z.literal("fr"),
  source: z.object({
    factoryId: z.string().min(1).max(80),
    promptId: z.string().min(1).max(120),
    modelUsed: z.string().min(1).max(80),
    cost: z.number().nonnegative(),
    generatedAt: z.string().datetime(),
  }),
});

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  // ----- Kill switch -----
  try {
    assertKillSwitchInactive();
  } catch (err) {
    if (err instanceof KillSwitchEngagedError) {
      return NextResponse.json(
        { error: "kill_switch_engaged", source: err.source, detail: err.message },
        { status: 503, headers: { "Retry-After": "300" } },
      );
    }
    throw err;
  }

  // ----- HMAC auth -----
  let secret: string;
  try {
    secret = getKbIngestSecret();
  } catch (err) {
    return NextResponse.json(
      {
        error: "server_misconfigured",
        detail: err instanceof Error ? err.message : "secret missing",
      },
      { status: 500 },
    );
  }

  const signature = req.headers.get("x-kb-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 401 });
  }

  const idempotencyKey = req.headers.get("x-idempotency-key");
  if (!idempotencyKey || !UUID_V4_REGEX.test(idempotencyKey)) {
    return NextResponse.json(
      {
        error: "missing_or_invalid_idempotency_key",
        detail: "Header X-Idempotency-Key UUID v4 obligatoire",
      },
      { status: 400 },
    );
  }

  const rawBody = await req.text();
  if (!verifyKbSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  // ----- Zod validation -----
  let parsed: z.infer<typeof IngestBodySchema>;
  try {
    parsed = IngestBodySchema.parse(JSON.parse(rawBody));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation", fieldErrors: err.flatten().fieldErrors },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // ----- Ingest pipeline -----
  const payload: IngestPayload = {
    idempotencyKey,
    type: parsed.type as KbType,
    title: parsed.title,
    body: parsed.body,
    ...(parsed.bodyJson !== undefined ? { bodyJson: parsed.bodyJson } : {}),
    ...(parsed.bodyText !== undefined ? { bodyText: parsed.bodyText } : {}),
    ...(parsed.excerpt !== undefined ? { excerpt: parsed.excerpt } : {}),
    ...(parsed.tags !== undefined ? { tags: parsed.tags } : {}),
    domain: parsed.domain as KbDomain,
    audience: parsed.audience as KbAudience,
    confidentiality: parsed.confidentiality as KbConfidentiality,
    language: "fr",
    source: parsed.source,
  };

  const result = await ingestEntry(payload);

  if (!result.accepted) {
    return NextResponse.json(
      {
        accepted: false,
        status: result.status,
        rejectReason: result.rejectReason,
        ...(result.duplicateOfEntryId ? { duplicateOfEntryId: result.duplicateOfEntryId } : {}),
      },
      { status: 422 },
    );
  }

  return NextResponse.json(
    {
      accepted: true,
      entryId: result.entryId,
      status: result.status,
    },
    {
      status: 202,
      headers: result.entryId ? { Location: `/api/internal/kb/${result.entryId}` } : {},
    },
  );
}
