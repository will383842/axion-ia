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
 * Construit la clé canonique du PDF d'un `DocumentGenere` :
 *   `documents/<année>/<type>/<numéro>.pdf`
 *
 * 🔴 Pourquoi une fonction, pour un gabarit d'une ligne.
 *
 * Cette clé était recopiée à la main dans SEPT fichiers. `getSignedUrlR2(key)`
 * prend une `string`, `pdfUrl` EST une string — et `portail/signer/[token]`
 * appelait donc `getSignedUrlR2(piece.pdfUrl, 900)`, c'est-à-dire signait un
 * objet dont la clé était l'URL pré-signée elle-même. Le typecheck passait, la
 * pré-signature est un calcul hors-ligne qui ne lève jamais (le `try/catch`
 * autour ne se déclenchait pas), l'URL produite était bien formée — et
 * renvoyait `NoSuchKey` au clic. Le signataire ne pouvait pas lire la pièce
 * avant de signer, alors que la mention qu'il accepte affirme le contraire.
 *
 * En prenant le DOCUMENT et non une chaîne, cette signature rend l'erreur
 * inexprimable : on ne peut plus passer une URL là où une clé est attendue.
 *
 * ⚠️ `getFullYear()` (local), PAS `getUTCFullYear()` comme `invoicePdfKey` :
 * l'écriture (`documents-service.ts`) partitionne sur l'année LOCALE. Lire en
 * UTC désignerait un autre dossier pour toute pièce émise le 31 décembre au
 * soir. La règle est de lire exactement comme on a écrit.
 */
export function documentPdfKey(doc: { type: string; numero: string; createdAt: Date }): string {
  return `documents/${doc.createdAt.getFullYear()}/${doc.type}/${doc.numero}.pdf`;
}

/**
 * URL de lecture fraîche pour le PDF d'un `DocumentGenere`.
 *
 * `DocumentGenere.pdfUrl` n'est pas une adresse : c'est une URL pré-signée
 * `X-Amz-Expires=900` figée en base à la génération, donc morte quinze minutes
 * plus tard. Toute surface qui affiche un lien de lecture doit re-signer ICI,
 * au rendu, plutôt que servir la valeur stockée.
 *
 * Fail-soft : `null` si R2 n'est pas configuré. L'appelant décide s'il retombe
 * sur `pdfUrl` (mieux que rien pour une pièce récente) ou s'il masque le lien.
 *
 * @param ttlSeconds — durée de vie. Court pour une pièce contractuelle exposée
 *   publiquement (lecture avant signature), plus long pour un espace authentifié.
 */
export async function signedDocumentPdfUrl(
  doc: { type: string; numero: string; createdAt: Date },
  ttlSeconds: number,
): Promise<string | null> {
  if (!isR2Configured()) return null;
  return getSignedUrlR2(documentPdfKey(doc), ttlSeconds);
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
