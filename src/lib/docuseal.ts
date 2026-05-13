// DocuSeal client (Sprint X.3 — Booking V1)
//
// Wrapper minimal autour de l'API DocuSeal self-hosted (ADR 0014).
// Fournit : createSubmission, getSubmission, archiveSubmission + helpers
// webhook (vérification HMAC-SHA256, parsing event typé).
//
// SOURCE :
//   - ADR 0014 : DocuSeal self-hosted vs Yousign
//   - 03-ARCHITECTURE-CIBLE §5.6 (intégration contrat)
//   - 04-PLAN-EXECUTION Sprint X.3
//   - DocuSeal API docs : https://www.docuseal.com/docs/api
//
// SÉCURITÉ :
//   - `DOCUSEAL_API_KEY` server-only (jamais exposée client)
//   - Webhook : HMAC-SHA256 hex en header `X-Docuseal-Signature`
//     → comparaison timing-safe via `crypto.timingSafeEqual`
//   - `DOCUSEAL_WEBHOOK_SECRET` distinct de l'API key (rotatable séparément)
//
// MODE DÉGRADÉ :
//   - Si `DOCUSEAL_BASE_URL` ou `DOCUSEAL_API_KEY` absent → `isDocusealConfigured()`
//     retourne false. Les Server Actions doivent fallback en mode hybride
//     manuel (admin upload PDF signé physiquement — ADR 0014 §3).

import { createHmac, timingSafeEqual } from "node:crypto";

// ============================================================
// Configuration & gates
// ============================================================

/** True si DocuSeal est configuré (URL + API key présents). */
export function isDocusealConfigured(): boolean {
  return Boolean(process.env["DOCUSEAL_BASE_URL"] && process.env["DOCUSEAL_API_KEY"]);
}

/** True si la vérification webhook est configurée (secret présent). */
export function isDocusealWebhookConfigured(): boolean {
  return Boolean(process.env["DOCUSEAL_WEBHOOK_SECRET"]);
}

function getBaseUrl(): string {
  const url = process.env["DOCUSEAL_BASE_URL"];
  if (!url) {
    throw new Error(
      "DOCUSEAL_BASE_URL manquant. Configurer via .env (dev) ou Coolify env vars (prod).",
    );
  }
  return url.replace(/\/$/, "");
}

function getApiKey(): string {
  const key = process.env["DOCUSEAL_API_KEY"];
  if (!key) {
    throw new Error(
      "DOCUSEAL_API_KEY manquant. Configurer via Coolify env vars (token X-Auth-Token).",
    );
  }
  return key;
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
// Types DocuSeal API
// ============================================================

/** Signataire passé à `createSubmission`. */
export interface DocusealSigner {
  email: string;
  name?: string;
  role?: string;
  /** Phone E.164 (`+33...`) — facultatif (SMS notification DocuSeal). */
  phone?: string;
}

/** Field DocuSeal — valeur pré-remplie passée au template. */
export interface DocusealField {
  name: string;
  default_value?: string | number | boolean;
}

/** Options pour `createSubmission`. */
export interface CreateSubmissionOptions {
  /** ID du `ContractTemplate.providerId` côté DocuSeal (récupéré après upload UI). */
  templateId: number | string;
  signers: DocusealSigner[];
  /** Fields pré-remplis avec valeurs Booking (raison sociale, montant, etc.). */
  fields?: DocusealField[];
  /** Envoyer l'email automatique DocuSeal au signataire (sinon embed-only). */
  sendEmail?: boolean;
  /** Webhook URL override pour cette submission (sinon webhook global). */
  webhookUrl?: string;
  /** Metadata propagée au webhook (ex: `bookingId`). */
  metadata?: Record<string, string>;
}

/** Résultat de `createSubmission`. */
export interface CreateSubmissionResult {
  /** `submission_id` DocuSeal — à stocker dans `ContractDocument.providerId`. */
  submissionId: string;
  /** URL embed (iframe DocuSeal côté visiteur). */
  embedUrl: string;
  /** URL d'audit (PDF status pour admin). */
  auditUrl?: string;
  /** Status initial DocuSeal (`pending`). */
  status: DocusealSubmissionStatus;
}

/** Status DocuSeal d'une submission. */
export type DocusealSubmissionStatus = "pending" | "completed" | "declined" | "expired";

/** Détail d'une submission DocuSeal. */
export interface DocusealSubmission {
  submissionId: string;
  status: DocusealSubmissionStatus;
  signedAt: string | null;
  declinedAt: string | null;
  /** URL signed PDF (final, stocké DocuSeal storage). */
  signedPdfUrl: string | null;
  /** Audit trail : nom, email, IP, timestamp du dernier événement signature. */
  signerEmail: string | null;
  signerName: string | null;
  signerIp: string | null;
  /** Hash SHA-256 du PDF signé (preuve eIDAS-SES). */
  signedPdfSha256: string | null;
}

// ============================================================
// API calls
// ============================================================

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

async function docusealRequest<T>(
  path: string,
  init: { method: "GET" | "POST" | "DELETE"; body?: unknown },
): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: init.method,
    headers: {
      ...JSON_HEADERS,
      "X-Auth-Token": getApiKey(),
    },
    body: init.body ? JSON.stringify(init.body) : null,
    // DocuSeal SaaS : 10s max. Self-hosted Coolify : peut être plus lent au cold start.
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new DocusealApiError(
      `DocuSeal ${init.method} ${path} → ${res.status}: ${text.slice(0, 500)}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

export class DocusealApiError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "DocusealApiError";
    this.statusCode = statusCode;
  }
}

/**
 * Crée une submission DocuSeal pour un template + signataires.
 * Le caller stocke `submissionId` dans `ContractDocument.providerId`.
 *
 * Embed flow V1 : on présente `embedUrl` dans un iframe sur la page client
 * (Sprint X.7 — `/quote/[token]/sign`). DocuSeal handle le rendu.
 */
export async function createSubmission(
  opts: CreateSubmissionOptions,
): Promise<CreateSubmissionResult> {
  type ApiResponse = Array<{
    id: number;
    submission_id: number;
    embed_src: string;
    email: string;
    name: string | null;
    audit_log_url?: string;
    status: DocusealSubmissionStatus;
  }>;

  const payload = {
    template_id: opts.templateId,
    send_email: opts.sendEmail ?? false,
    submitters: opts.signers.map((s) => ({
      email: s.email,
      ...(s.name ? { name: s.name } : {}),
      ...(s.role ? { role: s.role } : {}),
      ...(s.phone ? { phone: s.phone } : {}),
      ...(opts.fields ? { fields: opts.fields } : {}),
      ...(opts.metadata ? { metadata: opts.metadata } : {}),
    })),
    ...(opts.webhookUrl ? { webhook_url: opts.webhookUrl } : {}),
  };

  const result = await docusealRequest<ApiResponse>("/api/submissions", {
    method: "POST",
    body: payload,
  });

  const first = result[0];
  if (!first) {
    throw new DocusealApiError("DocuSeal returned empty submission array", 500);
  }

  return {
    submissionId: String(first.submission_id),
    embedUrl: first.embed_src,
    ...(first.audit_log_url ? { auditUrl: first.audit_log_url } : {}),
    status: first.status,
  };
}

/**
 * Récupère le détail d'une submission (status, signed PDF URL, audit trail).
 * Utilisé par : (a) le webhook pour récupérer le PDF signé, (b) le polling
 * fallback si webhook perdu (cron Sprint X.12).
 */
export async function getSubmission(submissionId: string): Promise<DocusealSubmission> {
  type ApiResponse = {
    id: number;
    status: DocusealSubmissionStatus;
    completed_at: string | null;
    declined_at: string | null;
    audit_log_url: string | null;
    documents: Array<{ url: string; checksum?: string }>;
    submitters: Array<{
      email: string;
      name: string | null;
      ip: string | null;
      completed_at: string | null;
    }>;
  };

  const data = await docusealRequest<ApiResponse>(`/api/submissions/${submissionId}`, {
    method: "GET",
  });

  // Premier signataire complété → utilisé pour l'audit trail eIDAS-SES.
  const completedSigner = data.submitters.find((s) => s.completed_at) ?? data.submitters[0] ?? null;
  const signedDoc = data.documents[0] ?? null;

  return {
    submissionId: String(data.id),
    status: data.status,
    signedAt: data.completed_at,
    declinedAt: data.declined_at,
    signedPdfUrl: signedDoc?.url ?? null,
    signerEmail: completedSigner?.email ?? null,
    signerName: completedSigner?.name ?? null,
    signerIp: completedSigner?.ip ?? null,
    signedPdfSha256: signedDoc?.checksum ?? null,
  };
}

/**
 * Archive (soft-delete) une submission DocuSeal. Utilisé par
 * `cancelAndReissueContractAction` (D62 — versioning).
 */
export async function archiveSubmission(submissionId: string): Promise<void> {
  await docusealRequest<void>(`/api/submissions/${submissionId}`, { method: "DELETE" });
}

// ============================================================
// Webhook utilities
// ============================================================

/**
 * Vérifie HMAC-SHA256 (format DocuSeal v1.x legacy).
 * Header : `X-Docuseal-Signature: <hex_digest>` (64 chars).
 *
 * @param rawBody Corps brut de la requête (Buffer ou string) — NE PAS reparser.
 * @param signatureHeader Valeur du header (hex SHA-256, longueur 64).
 * @returns true si signature valide.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  if (signatureHeader.length !== 64) return false;
  const expected = createHmac("sha256", getWebhookSecret()).update(rawBody, "utf8").digest("hex");
  // timingSafeEqual exige des Buffer de même longueur (déjà garanti via length check).
  try {
    return timingSafeEqual(Buffer.from(signatureHeader, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/**
 * Vérifie secret en clair (format DocuSeal v2.x — utilisé en prod).
 * Header : `X-Docuseal-Secret: <secret_brut>`.
 */
export function verifyWebhookSecret(secretHeader: string | null): boolean {
  if (!secretHeader) return false;
  const expected = getWebhookSecret();
  if (secretHeader.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(secretHeader, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

/**
 * Auth wrapper dual-mode : tente d'abord HMAC (legacy), puis secret en clair
 * (DocuSeal v2.x). Renvoie true si au moins un des 2 schémas matche.
 */
export function verifyWebhookAuth(
  rawBody: string,
  headers: { signature: string | null; secret: string | null },
): boolean {
  if (headers.signature && verifyWebhookSignature(rawBody, headers.signature)) return true;
  if (headers.secret && verifyWebhookSecret(headers.secret)) return true;
  return false;
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
 * Throw si event_id absent (idempotence impossible) ou type inconnu.
 */
export function parseWebhookPayload(rawJson: string): DocusealWebhookPayload {
  const data = JSON.parse(rawJson) as Record<string, unknown>;
  const eventType = data["event_type"] as DocusealEventType | undefined;
  const eventId = data["event_id"] as string | undefined;
  const timestamp = data["timestamp"] as string | undefined;

  if (!eventId) {
    throw new Error("[docuseal-webhook] missing event_id (idempotence impossible)");
  }
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

  return {
    eventId,
    eventType,
    submissionId: String(submissionId),
    timestamp: timestamp ?? new Date().toISOString(),
    metadata: (dataField["metadata"] as Record<string, string> | undefined) ?? {},
    raw: data,
  };
}
