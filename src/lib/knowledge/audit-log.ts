/**
 * KB V4 (Sprint KB-17) — Journal d'audit immuable hash-chainé.
 *
 * Pattern hash-chain :
 *  selfHash = SHA-256(prevHash + JSON.canonical(payload))
 *
 * Bénéfices :
 *  - Détection de toute modification a posteriori (un single byte → chain cassé)
 *  - Forensique RGPD/legal — preuve d'intégrité du log
 *
 * Limitations V1 :
 *  - Enforcement append-only = code-side seulement (pas de policy DB)
 *  - V2 : créer rôle DB dédié + REVOKE UPDATE,DELETE
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../prisma/generated/client";

export type AuditEventKind =
  | "ingest_accepted"
  | "ingest_rejected"
  | "ingest_duplicate"
  | "publish"
  | "unpublish"
  | "edit"
  | "delete"
  | "kill_switch_engaged"
  | "kill_switch_released"
  | "manual_review_approved"
  | "manual_review_rejected"
  | "factory_circuit_open"
  | "factory_circuit_close";

export interface AuditAppendInput {
  readonly eventKind: AuditEventKind;
  readonly entryId?: string | null;
  readonly actor: string; // factoryId | userId | "system"
  readonly payload: Record<string, unknown>;
}

/**
 * Sérialise canoniquement un objet pour hash reproductible (clés triées).
 */
function canonicalStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(canonicalStringify).join(",")}]`;
  const entries = Object.entries(obj as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalStringify(v)}`).join(",")}}`;
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Append un événement d'audit. Retourne l'ID + hash.
 * Lit le précédent selfHash pour chaîner.
 */
export async function appendAudit(
  input: AuditAppendInput,
): Promise<{ id: bigint; selfHash: string }> {
  const last = await prisma.knowledgeAuditLog.findFirst({
    orderBy: { id: "desc" },
    select: { selfHash: true },
  });
  const prevHash = last?.selfHash ?? null;

  const canonical = canonicalStringify({
    eventKind: input.eventKind,
    entryId: input.entryId ?? null,
    actor: input.actor,
    payload: input.payload,
  });

  const selfHash = sha256Hex(`${prevHash ?? ""}|${canonical}`);

  const created = await prisma.knowledgeAuditLog.create({
    data: {
      eventKind: input.eventKind,
      entryId: input.entryId ?? null,
      actor: input.actor,
      payloadJson: input.payload as Prisma.InputJsonValue,
      prevHash,
      selfHash,
    },
    select: { id: true, selfHash: true },
  });

  return created;
}

/**
 * Vérifie l'intégrité du chain depuis l'ID donné (ou depuis le début).
 * Retourne { valid: true } ou { valid: false, brokenAtId, reason }.
 *
 * Usage forensique : `pnpm tsx scripts/kb-verify-audit-chain.ts`.
 */
export async function verifyAuditChain(
  fromId?: bigint,
): Promise<
  { valid: true; checked: number } | { valid: false; brokenAtId: bigint; reason: string }
> {
  const start = fromId ?? 0n;
  const entries = await prisma.knowledgeAuditLog.findMany({
    where: { id: { gte: start } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      eventKind: true,
      entryId: true,
      actor: true,
      payloadJson: true,
      prevHash: true,
      selfHash: true,
    },
  });
  if (entries.length === 0) return { valid: true, checked: 0 };

  let prev: string | null = entries[0]!.prevHash;
  let checked = 0;
  for (const e of entries) {
    if (e.prevHash !== prev) {
      return { valid: false, brokenAtId: e.id, reason: "prev_hash mismatch with previous entry" };
    }
    const canonical = canonicalStringify({
      eventKind: e.eventKind,
      entryId: e.entryId,
      actor: e.actor,
      payload: e.payloadJson,
    });
    const expected = sha256Hex(`${prev ?? ""}|${canonical}`);
    if (expected !== e.selfHash) {
      return {
        valid: false,
        brokenAtId: e.id,
        reason: "selfHash recomputation does not match stored",
      };
    }
    prev = e.selfHash;
    checked += 1;
  }
  return { valid: true, checked };
}
