/**
 * Backups & DR (ADR 0032) — ingestion d'un test de restauration (drill).
 *
 * POST /api/internal/backups/drills
 *
 * Auth HMAC `X-Backup-Signature` + idempotency `X-Idempotency-Key` (UUID v4).
 * Émetteurs : restore-*-test*.sh + workflow restore-drill-monthly.yml.
 * Réponses : 202 créé · 409 idempotency · 400 · 401 · 422 · 500.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getBackupIngestSecret, verifyBackupSignature } from "@/lib/backups/hmac";
import { DrillIngestSchema } from "@/server/actions/backups/_zod-schemas";
import { ingestRestoreDrill } from "@/server/actions/backups/ingest-drill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  let secret: string;
  try {
    secret = getBackupIngestSecret();
  } catch (err) {
    return NextResponse.json(
      {
        error: "server_misconfigured",
        detail: err instanceof Error ? err.message : "secret missing",
      },
      { status: 500 },
    );
  }

  const signature = req.headers.get("x-backup-signature");
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
  if (!verifyBackupSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let parsed: z.infer<typeof DrillIngestSchema>;
  try {
    parsed = DrillIngestSchema.parse(JSON.parse(rawBody));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation", fieldErrors: err.flatten().fieldErrors },
        { status: 422 },
      );
    }
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = await ingestRestoreDrill(parsed, idempotencyKey);
  return NextResponse.json(
    { id: result.id, created: result.created },
    { status: result.created ? 202 : 409 },
  );
}
