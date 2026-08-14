import { createHmac } from "node:crypto";

import { prisma } from "@/lib/prisma";

import {
  CRM_SYNC_MAX_ATTEMPTS,
  CRM_SYNC_TIMEOUT_MS,
  crmSyncSecret,
  crmSyncUrl,
  isCrmSyncEnabled,
  nextAttemptDelayMs,
} from "./config";
import type { CrmIngestResponse } from "./types";

/**
 * ÉMISSION d'une ligne d'outbox vers le CRM.
 *
 * Signature : HMAC-SHA256 de « <horodatage>.<corps exact> », en-têtes
 * `X-Site-Timestamp` / `X-Site-Signature`. L'horodatage est DANS la signature :
 * sans lui, une requête légitime interceptée resterait rejouable pour
 * l'éternité (le CRM refuse au-delà de sa fenêtre de tolérance).
 *
 * Le corps signé est la chaîne EXACTE envoyée — jamais un objet re-sérialisé
 * de l'autre côté, sinon la moindre différence d'ordre de clés invaliderait la
 * signature.
 */

/**
 * Le dépôt tourne en `exactOptionalPropertyTypes` : `httpStatus?: number` y
 * REFUSE `undefined` comme valeur explicite. Or ces trois champs sont
 * naturellement « inconnus » (pas de réponse HTTP quand le réseau tombe, pas de
 * corps JSON quand le CRM répond en texte). On les déclare donc
 * `?: T | undefined` — le champ reste optionnel ET peut porter `undefined`,
 * plutôt que de construire les objets par accumulation conditionnelle.
 */
export interface EmitResult {
  status: "sent" | "failed" | "gave_up" | "skipped";
  httpStatus?: number | undefined;
  crmResult?: string | undefined;
  error?: string | undefined;
}

export function signBody(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export async function emitOutboxRow(outboxId: string): Promise<EmitResult> {
  if (!isCrmSyncEnabled()) return { status: "skipped" };

  const row = await prisma.crmSyncOutbox.findUnique({ where: { id: outboxId } });
  if (!row) return { status: "skipped" };
  if (row.status === "sent" || row.status === "gave_up") return { status: "skipped" };

  const url = crmSyncUrl();
  const secret = crmSyncSecret();
  if (!url || !secret) {
    // Configuration incomplète : la ligne RESTE en attente. On ne la solde
    // pas — le jour où le secret est posé, le balayage la rattrape.
    await markFailed(
      outboxId,
      row.attempts,
      "configuration incomplète (URL ou secret absent)",
      false,
    );
    return { status: "failed", error: "config" };
  }

  const body = JSON.stringify(row.payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  let httpStatus: number | undefined;
  let parsed: CrmIngestResponse | undefined;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Site-Timestamp": timestamp,
        "X-Site-Signature": signBody(secret, timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(CRM_SYNC_TIMEOUT_MS),
    });

    httpStatus = response.status;
    parsed = (await response.json().catch(() => undefined)) as CrmIngestResponse | undefined;

    if (response.ok) {
      await prisma.crmSyncOutbox.update({
        where: { id: outboxId },
        data: {
          status: "sent",
          attempts: row.attempts + 1,
          lastAttemptAt: new Date(),
          nextAttemptAt: null,
          sentAt: new Date(),
          responseStatus: httpStatus,
          crmResult: parsed?.result?.status ?? null,
          lastError: null,
        },
      });
      return { status: "sent", httpStatus, crmResult: parsed?.result?.status };
    }

    // 422 = refus DÉFINITIF (contrat, consentement, taxonomie). Rejouer un
    // message que le contrat refuse ne le rendra jamais valide : on abandonne
    // tout de suite et la ligne reste visible pour traitement humain.
    if (httpStatus === 422) {
      await prisma.crmSyncOutbox.update({
        where: { id: outboxId },
        data: {
          status: "gave_up",
          attempts: row.attempts + 1,
          lastAttemptAt: new Date(),
          nextAttemptAt: null,
          responseStatus: httpStatus,
          lastError: truncate(parsed?.error ?? "refus définitif du CRM"),
        },
      });
      return { status: "gave_up", httpStatus, error: parsed?.error };
    }

    // 503 = le CRM refuse TEMPORAIREMENT (drapeau d'ingestion à OFF, ou flux
    // candidats fermé). Ce n'est pas un échec : c'est l'état normal tant que
    // la bascule finale n'a pas eu lieu. La tentative ne compte donc PAS dans
    // le plafond d'abandon — sinon toutes les lignes accumulées pendant la
    // phase inerte seraient abandonnées avant même l'ouverture.
    const counts = httpStatus !== 503;
    await markFailed(
      outboxId,
      row.attempts,
      truncate(parsed?.error ?? `HTTP ${httpStatus}`),
      counts,
      httpStatus,
    );
    return { status: "failed", httpStatus, error: parsed?.error };
  } catch (error) {
    await markFailed(
      outboxId,
      row.attempts,
      truncate(error instanceof Error ? error.message : String(error)),
      true,
      httpStatus,
    );
    return { status: "failed", httpStatus, error: "network" };
  }
}

async function markFailed(
  outboxId: string,
  attempts: number,
  message: string,
  countsTowardGiveUp: boolean,
  httpStatus?: number,
): Promise<void> {
  const nextAttempts = countsTowardGiveUp ? attempts + 1 : attempts;
  const exhausted = countsTowardGiveUp && nextAttempts >= CRM_SYNC_MAX_ATTEMPTS;

  await prisma.crmSyncOutbox.update({
    where: { id: outboxId },
    data: {
      status: exhausted ? "gave_up" : "failed",
      attempts: nextAttempts,
      lastAttemptAt: new Date(),
      nextAttemptAt: exhausted
        ? null
        : new Date(Date.now() + nextAttemptDelayMs(Math.max(1, nextAttempts))),
      responseStatus: httpStatus ?? null,
      lastError: message,
    },
  });
}

function truncate(message: string): string {
  return message.length > 480 ? `${message.slice(0, 480)}…` : message;
}
