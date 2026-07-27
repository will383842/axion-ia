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
//   - Webhook : header `X-Docuseal-Signature`, DEUX formats supportés
//       · v2.x (celui qui tourne en prod) : `<timestamp_unix>.<hex64>`,
//         message signé = `"<timestamp>.<corps_brut>"`
//       · v1.x legacy : `<hex64>` nu, message signé = corps brut
//     → comparaison timing-safe via `crypto.timingSafeEqual`
//   - `DOCUSEAL_WEBHOOK_SECRET` distinct de l'API key (rotatable séparément)
//
// 🔴 HISTORIQUE À NE PAS RÉPÉTER (constat F4, 2026-07-26) : ce fichier a fait
// échouer la signature électronique dans les DEUX sens sans qu'aucune alerte ne
// parte — 422 à l'aller (champs pré-remplis attachés à TOUS les submitters),
// 401 puis 400 au retour (format de signature v1 attendu alors que la prod
// parle v2, et `event_id` exigé alors que DocuSeal ne l'envoie pas). Toute
// évolution ici se valide contre le conteneur RÉEL, pas contre la doc.
//
// MODE DÉGRADÉ :
//   - Si `DOCUSEAL_BASE_URL` ou `DOCUSEAL_API_KEY` absent → `isDocusealConfigured()`
//     retourne false. Les Server Actions doivent fallback en mode hybride
//     manuel (admin upload PDF signé physiquement — ADR 0014 §3).

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

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
  /**
   * Rôle DocuSeal — DOIT matcher un rôle déclaré dans le template
   * (`Signer`, `Client`, `Axion-IA`, etc.). Sert d'ancrage pour placer
   * les champs signature au bon endroit dans le PDF.
   */
  role?: string;
  /** Phone E.164 (`+33...`) — facultatif (SMS notification DocuSeal). */
  phone?: string;
  /**
   * Champs pré-remplis PROPRES à ce signataire.
   *
   * 🔴 DocuSeal valide les noms de champs RÔLE PAR RÔLE : `fields[].default_value`
   * est reversé dans `values` (`Submissions::NormalizeParamUtils`), puis
   * `Submitters::NormalizeValues` est appelé avec `throw_errors: true` et les
   * SEULS champs du rôle traité — un nom étranger à ce rôle lève
   * `Unknown field: <nom>` et le contrôleur répond 422. La soumission ENTIÈRE
   * est refusée, y compris la partie client pourtant valide : ce n'est pas une
   * erreur partielle.
   *
   * Non renseigné : le signataire d'index 0 hérite de
   * `CreateSubmissionOptions.fields`.
   */
  fields?: DocusealField[];
}

/**
 * Ordre de signature séquentiel (B2B pattern client → Axion-IA contre-signe).
 *
 * - `"preserved"` (recommandé contrats B2B) : DocuSeal envoie au signer 1 ;
 *   après sa signature, envoie au signer 2 ; etc. Status `pending` jusqu'à
 *   ce que TOUS aient signé.
 * - `"random"` (legacy V1 unilatéral) : tous les signers reçoivent l'email
 *   en même temps, peuvent signer dans n'importe quel ordre.
 *
 * Default V1 : `"preserved"` pour matcher le pattern juridique B2B standard
 * (le client engage le prestataire en signant en 1er, le prestataire
 * contre-signe pour acter l'acceptation).
 */
export type DocusealSignOrder = "preserved" | "random";

/** Field DocuSeal — valeur pré-remplie passée au template. */
export interface DocusealField {
  name: string;
  default_value?: string | number | boolean;
  /**
   * Rend le champ NON MODIFIABLE par le signataire : il est rendu en statique
   * au lieu d'un input pré-rempli (`submit_form/show.html.erb` ne saute du rendu
   * statique que les champs NON readonly du submitter courant).
   *
   * 🔴 À poser sur tout champ qui porte un engagement chiffré (numéro de pièce,
   * montant, date de validité) : sans lui le signataire peut RÉÉCRIRE la valeur
   * avant de signer, et le document signé cesse de correspondre à la pièce
   * émise. Le paramètre est accepté par l'API (`fields: [… :readonly …]` dans
   * `api/submissions_controller.rb`) et appliqué par `assign_field_attrs`.
   */
  readonly?: boolean;
}

/** Options pour `createSubmission`. */
export interface CreateSubmissionOptions {
  /** ID du `ContractTemplate.providerId` côté DocuSeal (récupéré après upload UI). */
  templateId: number | string;
  /**
   * Liste ordonnée des signataires. L'ordre du tableau dicte l'ordre de
   * signature quand `signOrder === "preserved"` (signer[0] → signer[1] → …).
   */
  signers: DocusealSigner[];
  /**
   * Ordre de signature DocuSeal. Default `"preserved"` (séquentiel) — convient
   * au pattern contrat B2B client puis Axion-IA contre-signe.
   *
   * Si `"random"` : tous les signers reçoivent leur lien en parallèle.
   */
  signOrder?: DocusealSignOrder;
  /**
   * Champs pré-remplis du PREMIER signataire (`signers[0]`) — jamais des suivants.
   *
   * 🔴 Les noms doivent exister sur le rôle de `signers[0]` dans le template :
   * un nom inconnu de ce rôle fait répondre 422 et la soumission entière est
   * perdue. Pour pré-remplir un autre signataire, utiliser `signers[i].fields`.
   */
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

  // signOrder default = "preserved" (client signe d'abord, Axion-IA contre-signe).
  // Le paramètre `submitters_order` côté DocuSeal contrôle l'ordre :
  //   - "preserved" : séquentiel (signer[0] → signer[1] → …)
  //   - "random"    : parallèle (legacy unilatéral)
  // Source : https://www.docuseal.com/docs/api#create-a-submission
  const signOrder: DocusealSignOrder = opts.signOrder ?? "preserved";

  const payload = {
    template_id: opts.templateId,
    send_email: opts.sendEmail ?? false,
    submitters_order: signOrder,
    submitters: opts.signers.map((s, i) => {
      // 🔴 CAUSE RACINE DU 422 (constat F4, corrigé le 2026-07-26).
      // `opts.fields` partait sur TOUS les submitters. Or DocuSeal reverse
      // `fields[].default_value` dans `values`, puis valide RÔLE PAR RÔLE via
      // `Submitters::NormalizeValues(..., throw_errors: true)`. Reproduit sur le
      // conteneur de prod (DocuSeal 2.5.3, template « Devis Axion-IA V1 ») :
      //   role="Client"   → résout devis_number / amount_ht / valid_until
      //   role="Axion-IA" → UnknownFieldName: "Unknown field: devis_number"
      // → HTTP 422, soumission ENTIÈRE refusée. Les champs pré-remplis
      // appartiennent donc au PREMIER signataire, sauf si un signataire porte
      // explicitement les siens.
      const signerFields = s.fields ?? (i === 0 ? opts.fields : undefined);
      return {
        email: s.email,
        ...(s.name ? { name: s.name } : {}),
        ...(s.role ? { role: s.role } : {}),
        ...(s.phone ? { phone: s.phone } : {}),
        // Tableau VIDE ≠ clé absente : on n'émet `fields` que s'il y a
        // réellement quelque chose à pré-remplir.
        ...(signerFields && signerFields.length > 0 ? { fields: signerFields } : {}),
        // metadata reste sur TOUS les submitters : le webhook porte la metadata
        // DU submitter concerné, et le dispatch a besoin de `devisId`/`quoteId`
        // quel que soit celui qui vient de signer.
        ...(opts.metadata ? { metadata: opts.metadata } : {}),
      };
    }),
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

// ============================================================
// Helper haut niveau : signature B2B séquentielle (contrat ou devis)
// ============================================================

/**
 * Rôles canoniques utilisés par tous les templates DocuSeal Axion-IA.
 * MUST matcher les rôles déclarés dans le template DocuSeal côté UI
 * (sinon les champs signature ne se placent pas).
 */
export const DOCUSEAL_ROLES = {
  /** Premier signataire (engage le client en acceptant le contrat). */
  CLIENT: "Client",
  /** Second signataire (Axion-IA contre-signe pour acter l'acceptation). */
  AXIONIA: "Axion-IA",
} as const;

export interface ContractSubmissionInput {
  templateId: number | string;
  /** Client (1er signataire — signe en premier). */
  client: { email: string; name: string; phone?: string };
  /**
   * Contre-signataire Axion-IA (2e signataire — signe après le client).
   * Si omis, lecture depuis env `AXIONIA_CONTRACT_COUNTERSIGNER_EMAIL` ou
   * fallback `contact@axion-ia.com`.
   */
  countersigner?: { email: string; name?: string };
  /**
   * Champs pré-remplis du CLIENT (1er signataire) — jamais du contre-signataire.
   *
   * 🔴 Les noms doivent exister sur le rôle « Client » du template DocuSeal : un
   * nom inconnu du rôle fait répondre 422 et la soumission entière est perdue
   * (cause racine du constat F4). Se vérifie contre le template RÉEL du
   * conteneur, pas contre la documentation.
   */
  fields?: DocusealField[];
  /** Metadata propagée au webhook (typiquement `bookingId`). */
  metadata?: Record<string, string>;
  /** Envoyer l'email DocuSeal auto. Default `true` pour le contrat B2B. */
  sendEmail?: boolean;
  /** Webhook override (sinon webhook global). */
  webhookUrl?: string;
}

/**
 * Résoud l'email du contre-signataire Axion-IA :
 *   1. `countersigner.email` explicite passé en arg
 *   2. env `AXIONIA_CONTRACT_COUNTERSIGNER_EMAIL`
 *   3. fallback `contact@axion-ia.com`
 *
 * Le nom suit le même ordre (env `AXIONIA_CONTRACT_COUNTERSIGNER_NAME` ou
 * fallback `"Axion-IA"`).
 */
function resolveCountersigner(input?: { email: string; name?: string }): {
  email: string;
  name: string;
} {
  if (input?.email) {
    return { email: input.email, name: input.name ?? "Axion-IA" };
  }
  const envEmail = process.env["AXIONIA_CONTRACT_COUNTERSIGNER_EMAIL"];
  const envName = process.env["AXIONIA_CONTRACT_COUNTERSIGNER_NAME"];
  return {
    email: envEmail && envEmail.includes("@") ? envEmail : "contact@axion-ia.com",
    name: envName ?? "Axion-IA",
  };
}

/**
 * Crée une submission DocuSeal pour un contrat B2B avec pattern signature
 * séquentielle client → Axion-IA. C'est le helper canonique à utiliser depuis
 * les Server Actions `sendContractForSignatureAction`, `emitQuoteAction`, etc.
 *
 * Workflow garanti :
 *   1. DocuSeal envoie l'email signature au CLIENT en premier
 *   2. Status reste `pending` tant que le client n'a pas signé
 *   3. Une fois le client signataire → DocuSeal envoie au contre-signataire
 *      Axion-IA (Will / contact@axion-ia.com)
 *   4. Une fois les 2 signatures collectées → webhook `form.completed`
 *      → `Booking.status` peut transiter `contract_pending → contract_signed`
 *
 * Les 2 parties reçoivent le PDF final signé par DocuSeal automatiquement.
 *
 * Le template DocuSeal côté UI DOIT déclarer 2 rôles :
 *   - "Client" (avec champ signature client)
 *   - "Axion-IA" (avec champ signature contre-signature)
 *
 * Cf. `_AUDIT/legal/DOCUSEAL-TEMPLATE-SETUP.md` pour la procédure complète.
 */
export async function createContractSubmission(
  input: ContractSubmissionInput,
): Promise<CreateSubmissionResult> {
  const countersigner = resolveCountersigner(input.countersigner);
  return createSubmission({
    templateId: input.templateId,
    signOrder: "preserved", // client signe d'abord, Axion-IA après
    signers: [
      {
        email: input.client.email,
        name: input.client.name,
        role: DOCUSEAL_ROLES.CLIENT,
        ...(input.client.phone ? { phone: input.client.phone } : {}),
      },
      {
        email: countersigner.email,
        name: countersigner.name,
        role: DOCUSEAL_ROLES.AXIONIA,
      },
    ],
    sendEmail: input.sendEmail ?? true,
    ...(input.fields ? { fields: input.fields } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
    ...(input.webhookUrl ? { webhookUrl: input.webhookUrl } : {}),
  });
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
 * 🔴 DEUX FORMATS — ET LA PROD N'UTILISE PAS CELUI QUI ÉTAIT CODÉ (constat F4) :
 *
 *  - DocuSeal v2.x (le conteneur de prod est en 2.5.3) émet
 *    `<timestamp_unix>.<hex64>` et signe le message `"<timestamp>.<corps_brut>"`,
 *    pas le corps seul. L'ancien code refusait tout header dont la longueur
 *    n'était pas 64 : 100 % des callbacks repartaient en 401 — d'où une table
 *    `docuseal_webhook_events` restée vide alors que le secret, lui, est bon.
 *  - DocuSeal v1.x (legacy, conservé) : `<hex64>` nu, message = corps brut.
 *
 * Le fallback plaintext `X-Docuseal-Secret` ne rattrape rien : en prod
 * `WebhookUrl.secret` vaut `{}`, donc DocuSeal n'émet JAMAIS ce header.
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

  // ── Format v1.x legacy : hex64 nu, message = corps brut ──────────────────
  if (signatureHeader.length !== 64) return false;
  const expected = createHmac("sha256", getWebhookSecret()).update(rawBody, "utf8").digest("hex");
  return timingSafeHexEqual(signatureHeader, expected);
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
 *
 * Sprint Correctif S+1 (P0-S1-5 2026-05-16) — env flag `DOCUSEAL_STRICT_HMAC=true`
 * désactive le fallback plaintext. Audit 2.D : plaintext forgeable si le secret fuit.
 *
 * 🔴 F4 (2026-07-26) : la doctrine « la prod utilise le plaintext v2.x » était
 * FAUSSE. Vérifié sur le conteneur : `WebhookUrl.secret == {}`, donc DocuSeal
 * n'émet AUCUN header `X-Docuseal-Secret` — cette branche est morte-née. Le seul
 * chemin réel est la signature v2 `<ts>.<hex64>` traitée ci-dessus. Ne PAS
 * activer `DOCUSEAL_STRICT_HMAC` dans la foulée de ce correctif : observer
 * d'abord un vrai callback en 200 et une ligne dans `docuseal_webhook_events`,
 * durcir ensuite — sinon on remplace une panne muette par une autre.
 */
export function verifyWebhookAuth(
  rawBody: string,
  headers: { signature: string | null; secret: string | null },
): boolean {
  if (headers.signature && verifyWebhookSignature(rawBody, headers.signature)) return true;
  if (process.env.DOCUSEAL_STRICT_HMAC === "true") return false;
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
