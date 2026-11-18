// DocuSeal — réception des webhooks (anciens devis uniquement).
//
// Depuis le 30/07/2026 la signature des devis est MAISON (portail/signer/[token]) :
// DocuSeal n'émet plus rien. Ne subsiste que la vérification + le parsing du webhook
// pour les devis historiques. Les appels sortants (createSubmission, getSubmission,
// archiveSubmission…) ont été supprimés (code mort, durcissement sécurité).
//
// SÉCURITÉ :
//   - Webhook : header `X-Docuseal-Signature` au SEUL format v2 `<timestamp_unix>.<hex64>`,
//     message signé = `"<timestamp>.<corps_brut>"`, fenêtre ±5 min, comparaison
//     timing-safe. Le format v1 (sans horodatage, rejouable) et le secret en clair
//     (`X-Docuseal-Secret`) ont été retirés.
//   - `DOCUSEAL_WEBHOOK_SECRET` distinct de toute autre clé (rotatable séparément)
//
// 🔴 HISTORIQUE À NE PAS RÉPÉTER (constat F4, 2026-07-26) : 401 puis 400 au retour
// (format de signature v1 attendu alors que la prod parle v2, et `event_id` exigé
// alors que DocuSeal ne l'envoie pas). Toute évolution ici se valide contre le
// conteneur RÉEL, pas contre la doc.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// ============================================================
// Configuration & gates
// ============================================================

/** True si DocuSeal est configuré (URL + API key présents). Conservé : simple lecture d'env. */
export function isDocusealConfigured(): boolean {
  return Boolean(process.env["DOCUSEAL_BASE_URL"] && process.env["DOCUSEAL_API_KEY"]);
}

/** True si la vérification webhook est configurée (secret présent). */
export function isDocusealWebhookConfigured(): boolean {
  return Boolean(process.env["DOCUSEAL_WEBHOOK_SECRET"]);
}

function getWebhookSecret(): string {
  const s = process.env["DOCUSEAL_WEBHOOK_SECRET"];
  if (!s) {
    throw new Error(
      "DOCUSEAL_WEBHOOK_SECRET manquant. Configurer via Coolify env vars (HMAC secret).",
    );
  }
  return s;
}

// ============================================================
// Webhook utilities
// ============================================================

/**
 * Fenêtre d'acceptation du timestamp signé — identique à celle que DocuSeal
 * s'applique à lui-même (`WebhookUrls::Signatures::TOLERANCE = 5 * 60`).
 *
 * 🔴 NE PAS l'élargir « au cas où un retry rejouerait l'ancien header » : ce cas
 * n'existe pas. `Signatures.sign(secret, body:, timestamp: Time.current.to_i)`
 * réévalue l'horodatage À CHAQUE appel, et `send_webhook_request.rb` rappelle
 * `sign` à l'intérieur du bloc Faraday, donc à chaque tentative. Émetteur et
 * récepteur tournent sur la même machine : aucune dérive d'horloge à absorber.
 */
const DOCUSEAL_SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Vérifie la signature du header `X-Docuseal-Signature`.
 *
 * Seul le format v2.x est accepté (le conteneur de prod est en 2.5.3) :
 * `<timestamp_unix>.<hex64>`, message signé `"<timestamp>.<corps_brut>"`, fenêtre ±5 min.
 * Le format v1 `<hex64>` nu (sans horodatage, donc rejouable à l'infini) et le
 * secret en clair `X-Docuseal-Secret` sont REFUSÉS (durcissement 2026-11).
 *
 * @param rawBody Corps brut de la requête — NE PAS reparser puis re-sérialiser.
 * @param signatureHeader Valeur du header.
 * @returns true si la signature est valide.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;

  const dot = signatureHeader.indexOf(".");
  if (dot > 0) {
    // ── Format v2.x : "<timestamp>.<hex64>" ────────────────────────────────
    const ts = signatureHeader.slice(0, dot);
    const received = signatureHeader.slice(dot + 1);
    if (!/^\d+$/.test(ts)) return false;
    if (!/^[0-9a-fA-F]{64}$/.test(received)) return false;
    if (Math.abs(Date.now() / 1000 - Number(ts)) > DOCUSEAL_SIGNATURE_TOLERANCE_SECONDS) {
      return false;
    }
    const expected = createHmac("sha256", getWebhookSecret())
      .update(`${ts}.${rawBody}`, "utf8")
      .digest("hex");
    return timingSafeHexEqual(received, expected);
  }

  // Tout autre format (dont le v1 nu, sans horodatage) est refusé.
  return false;
}

/**
 * Comparaison timing-safe de deux digests hexadécimaux.
 * `Buffer.from("zzz…", "hex")` rend un buffer VIDE au lieu de throw : sans le
 * garde sur la longueur, deux digests non-hex se compareraient « égaux ».
 */
function timingSafeHexEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length === 0 || bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/** Event types DocuSeal qu'on traite (V1). */
export type DocusealEventType =
  | "form.viewed" // signataire ouvre l'embed
  | "form.started" // signataire a commencé à remplir
  | "form.completed" // toutes signatures OK → quote_signed
  | "form.declined" // refus → quote_declined
  | "submission.completed" // tous les signataires ont signé
  | "submission.expired"; // délai expiration atteint

export interface DocusealWebhookPayload {
  /** Identifiant unique de l'event (idempotence DB via `docusealEventId`). */
  eventId: string;
  eventType: DocusealEventType;
  submissionId: string;
  /** Timestamp ISO 8601 de l'event côté DocuSeal. */
  timestamp: string;
  /** Metadata propagée depuis `createSubmission({ metadata })`. */
  metadata: Record<string, string>;
  /** Raw payload (stocké dans DB pour audit + reprocessing). */
  raw: Record<string, unknown>;
}

/**
 * Parse un payload webhook DocuSeal en `DocusealWebhookPayload` typé.
 * Throw si `event_type` est absent (payload inexploitable).
 *
 * 🔴 IDEMPOTENCE (constat F4) : l'ancien code exigeait `data.event_id` et la
 * route répondait 400 sinon. Or le corps émis par DocuSeal 2.5.3 est exactement
 * `{ event_type, timestamp, data }` (`lib/send_webhook_request.rb`) : il n'y a
 * PAS d'`event_id`. Chaque callback authentique repartait donc en 400. On dérive
 * désormais une clé déterministe — voir `deriveWebhookEventId`.
 */
export function parseWebhookPayload(rawJson: string): DocusealWebhookPayload {
  const data = JSON.parse(rawJson) as Record<string, unknown>;
  const eventType = data["event_type"] as DocusealEventType | undefined;
  const timestamp = data["timestamp"] as string | undefined;

  if (!eventType) {
    throw new Error("[docuseal-webhook] missing event_type");
  }

  // Submission ID peut être dans data.data.submission_id ou data.submission_id selon event.
  const dataField = (data["data"] as Record<string, unknown> | undefined) ?? {};
  const submissionId =
    (dataField["submission_id"] as string | number | undefined) ??
    (dataField["id"] as string | number | undefined) ??
    (data["submission_id"] as string | number | undefined) ??
    "";

  // `event_id` reste prioritaire s'il existe (DocuSeal v1.x, versions futures).
  const explicitEventId = data["event_id"];
  const eventId =
    typeof explicitEventId === "string" && explicitEventId.trim() !== ""
      ? explicitEventId.trim()
      : deriveWebhookEventId(eventType, data["timestamp"], dataField);

  return {
    eventId,
    eventType,
    submissionId: String(submissionId),
    timestamp: timestamp ?? new Date().toISOString(),
    metadata: (dataField["metadata"] as Record<string, string> | undefined) ?? {},
    raw: data,
  };
}

/**
 * Clé d'idempotence synthétique quand DocuSeal n'envoie pas d'`event_id`.
 *
 * 🔴 N'AGRÈGE QUE DES SCALAIRES STABLES. Hacher le bloc `data` entier serait un
 * piège : `Submitters::SerializeForWebhook` le RE-SÉRIALISE à chaque tentative
 * avec `expires_at: Accounts.link_expires_at(...)` = `40.minutes.from_now`,
 * recalculé à l'appel — `documents[].url`, `audit_log_url` et
 * `combined_document_url` portent donc une signature DIFFÉRENTE à chaque retry
 * (et `updated_at` bouge aussi). La clé changerait à chaque tentative et la
 * contrainte UNIQUE `docuseal_webhook_events.docuseal_event_id` ne
 * dédupliquerait plus rien.
 *
 * Les trois composantes retenues sont stables entre tentatives :
 *   - `event_type` ;
 *   - le `timestamp` de PREMIER NIVEAU, qui vaut `webhook_event.created_at`
 *     (`find_or_create_by!(webhook_url:, uuid: event_uuid)`) : figé pour un
 *     événement donné — c'est le HEADER, lui, qui est re-signé à chaque essai ;
 *   - `data.id` + `data.submission_id` (`SERIALIZE_PARAMS`), immuables.
 *
 * Deux signataires du même document donnent deux `data.id` distincts : deux
 * clés, deux événements traités séparément — c'est voulu.
 *
 * Colonne `VarChar(120)` : `sha256:` + 64 hex = 71 caractères.
 */
function deriveWebhookEventId(
  eventType: string,
  timestamp: unknown,
  dataField: Record<string, unknown>,
): string {
  const parts = [
    eventType,
    typeof timestamp === "string" || typeof timestamp === "number" ? String(timestamp) : "",
    dataField["id"] !== undefined ? String(dataField["id"]) : "",
    dataField["submission_id"] !== undefined ? String(dataField["submission_id"]) : "",
  ];
  return `sha256:${createHash("sha256").update(parts.join("|"), "utf8").digest("hex")}`;
}
