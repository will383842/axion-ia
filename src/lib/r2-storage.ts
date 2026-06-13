// Cloudflare R2 storage helper (Sprint B — Booking V1).
//
// R2 = S3-compatible object storage (Cloudflare). Utilisé pour archiver
// les PDFs factures + devis + contrats signés (10 ans légal RGPD art. 28
// + CGI 242 nonies A FR).
//
// Configuration env :
//   R2_ACCOUNT_ID         (Cloudflare account id — sert d'endpoint hostname)
//   R2_ACCESS_KEY_ID      (S3 access key)
//   R2_SECRET_ACCESS_KEY  (S3 secret)
//   R2_BUCKET_NAME        (nom du bucket — défaut "axion-ia-backups")
//   R2_PUBLIC_BASE_URL    (optionnel — URL custom public si activée)
//
// Doctrine
//   - PDF persistant dans bucket avec clé `invoices/2026/AXION-2026-NNNN.pdf`
//   - URL signée 90 jours pour distribution client (revue chaque accès admin)
//   - Hash SHA-256 stocké en DB pour intégrité — vérifié re-download
//   - Mode dégradé : si R2 non configuré → upload no-op, retourne null
//     (le route handler /pdf continue à générer à la volée)

import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ====================================================================
// Configuration & gate
// ====================================================================

export function isR2Configured(): boolean {
  return Boolean(
    process.env["R2_ACCOUNT_ID"] &&
    process.env["R2_ACCESS_KEY_ID"] &&
    process.env["R2_SECRET_ACCESS_KEY"] &&
    process.env["R2_BUCKET_NAME"],
  );
}

function getR2Endpoint(): string {
  const accountId = process.env["R2_ACCOUNT_ID"];
  if (!accountId) throw new Error("R2_ACCOUNT_ID missing");
  // R2 S3 endpoint : https://<account-id>.r2.cloudflarestorage.com
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function getBucketName(): string {
  const bucket = process.env["R2_BUCKET_NAME"];
  if (!bucket) throw new Error("R2_BUCKET_NAME missing");
  return bucket;
}

// Singleton client (réutilise la connexion HTTPS).
let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;
  const accessKeyId = process.env["R2_ACCESS_KEY_ID"];
  const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"];
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY missing");
  }
  _client = new S3Client({
    region: "auto", // R2 ignore la region mais le SDK l'exige
    endpoint: getR2Endpoint(),
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // R2 requiert le path-style sur l'endpoint historique account-id.r2.cloudflarestorage.com
    forcePathStyle: false,
  });
  return _client;
}

// ====================================================================
// API publique
// ====================================================================

export interface UploadResult {
  /** Clé objet R2 (à stocker dans `Invoice.pdfUrl` après transform en URL signée). */
  key: string;
  /** ETag retourné par R2 (utile pour cache-busting). */
  etag: string | null;
  /** Taille uploadée bytes. */
  sizeBytes: number;
}

/**
 * Upload un buffer (typiquement un PDF) dans R2 avec clé déterministe.
 *
 * @param key — clé d'objet (ex: `invoices/2026/AXION-2026-0042.pdf`)
 * @param buffer — contenu binaire
 * @param contentType — mime type (default `application/pdf`)
 * @param metadata — métadata custom (ex: hashSha256, invoiceId)
 *
 * Idempotent : si la clé existe déjà avec le même contenu, l'upload écrase
 * mais le résultat reste identique côté DB grâce au hash.
 */
export async function uploadToR2(
  key: string,
  buffer: Buffer | Uint8Array,
  contentType: string = "application/pdf",
  metadata?: Record<string, string>,
): Promise<UploadResult> {
  const client = getClient();
  const Body = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const result = await client.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body,
      ContentType: contentType,
      ...(metadata ? { Metadata: metadata } : {}),
    }),
  );
  return {
    key,
    etag: result.ETag ?? null,
    sizeBytes: Body.byteLength,
  };
}

/**
 * Génère une URL signée temporaire (download direct par le client) pour un
 * objet R2. Par défaut TTL 90 jours — adapté pour les factures qui restent
 * accessibles ~3 mois après émission, puis signature renouvelée à la demande
 * via /api/admin/invoices/[id]/pdf qui retourne une nouvelle URL signed.
 */
export async function getSignedUrlR2(
  key: string,
  expiresInSeconds: number = 90 * 24 * 3600,
): Promise<string> {
  const client = getClient();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: getBucketName(), Key: key }), {
    expiresIn: expiresInSeconds,
  });
}

/**
 * Génère une URL signée temporaire pour un UPLOAD direct navigateur → R2
 * (HTTP PUT). Permet de déposer de gros fichiers (.pptx 30-50 Mo) sans les
 * faire transiter par le serveur Next (limite bodySizeLimit). Le navigateur
 * fait `fetch(url, { method: "PUT", body: file })`.
 *
 * ⚠️ Côté plateforme : le bucket R2 doit autoriser le CORS PUT depuis l'origine
 * admin (AllowedMethods PUT, AllowedHeaders content-type, AllowedOrigins).
 *
 * @param key — clé d'objet R2 (ex: `interventions/ia-express/livret_apprenant/v2/source.docx`)
 * @param contentType — mime type exact que le client enverra (doit matcher le PUT)
 * @param expiresInSeconds — TTL de l'URL signée (défaut 15 min)
 */
export async function getSignedUploadUrlR2(
  key: string,
  contentType: string,
  expiresInSeconds: number = 15 * 60,
): Promise<string> {
  const client = getClient();
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: getBucketName(), Key: key, ContentType: contentType }),
    { expiresIn: expiresInSeconds },
  );
}

/** True si l'objet existe (utilisé pour idempotence upload). */
export async function existsInR2(key: string): Promise<boolean> {
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: getBucketName(), Key: key }));
    return true;
  } catch (err) {
    if ((err as { name?: string })?.name === "NotFound") return false;
    if ((err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode === 404)
      return false;
    throw err;
  }
}

/** Supprime un objet (V1.5+ — archivage 10 ans atteint, purge légale). */
export async function deleteFromR2(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: getBucketName(), Key: key }));
}

/**
 * Construit la clé canonique pour un PDF facture :
 *   `invoices/<year>/<invoice-number>.pdf`
 *
 * Permet partition par année dans R2 (facilite lifecycle rules + analytics).
 */
export function invoicePdfKey(invoiceNumber: string, issuedAt: Date): string {
  const year = issuedAt.getUTCFullYear();
  return `invoices/${year}/${invoiceNumber}.pdf`;
}

/**
 * Télécharge un objet R2 et retourne son contenu sous forme de Buffer.
 *
 * Fail-soft : retourne `null` si R2 n'est pas configuré, si l'objet est
 * absent (404) ou si une erreur survient (réseau, permissions…).
 * Ne throw jamais — utilisé dans des pipelines de génération de ZIP où un
 * PDF manquant ne doit pas bloquer l'ensemble du dossier.
 *
 * @param key — clé d'objet R2 (ex: `documents/2026/attestation/AXI-ATT-2026-0042.pdf`)
 */
export async function getObjectBufferR2(key: string): Promise<Buffer | null> {
  if (!isR2Configured()) return null;
  try {
    const client = getClient();
    const response = await client.send(new GetObjectCommand({ Bucket: getBucketName(), Key: key }));
    const body = response.Body;
    if (!body) return null;

    // Le SDK AWS retourne un ReadableStream (Node.js Readable) — on le consomme
    // en accumulant les chunks dans un Buffer.
    const chunks: Uint8Array[] = [];
    // `body` implémente AsyncIterable<Uint8Array> dans le SDK v3 Node.js
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch {
    // Absorbe les erreurs (404, réseau, permissions) — fail-soft intentionnel.
    return null;
  }
}
