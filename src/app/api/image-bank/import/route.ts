// POST /api/image-bank/import
//
// Import multipart d'une image dans la banque d'images.
// Accepte multipart/form-data :
//   - file        : Blob — image source (JPEG / PNG / WebP / TIFF / HEIF / AVIF)
//   - slug_fr     : string — slug kebab-case FR canonique (ex. "axion-ia-audit-ia-paris")
//   - category    : string — catégorie éditoriale (ex. "interventions")
//   - image_type  : string — type visuel ("banniere" | "photo" | "logo" | ...)
//   - alt_fr      : string — texte alternatif FR (WCAG 2.2)
//   - alt_en      : string optionnel — texte alternatif EN
//
// Flow :
//   1. Auth admin (session NextAuth rôle ≥ editor).
//   2. Parse multipart + validation Zod (≤ 50 MB, formats acceptés).
//   3. Écriture dans /tmp/{uuid} (stockage temporaire sécurisé).
//   4. Enqueue job BullMQ `image-bank-import` (pipeline Sharp variants).
//   5. Réponse immédiate 202 { jobId, slug, status: "queued" }.
//
// Auth : session NextAuth (cookie HttpOnly SameSite=Lax).
// Rate limit : 30 uploads / 5 min / admin (anti-spam bulk).
//
// Note : pour les imports > 5 MB on délègue toujours à BullMQ (cf.
// SYNC_UPLOAD_BYTES_MAX dans constants.ts). Pour les petits fichiers,
// le worker est suffisamment rapide (< 3 s) pour que le caller poll
// le statut du job via /api/image-bank/jobs/[jobId].

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { enqueueImageBankImport } from "@/server/queue/queues";
import { UPLOAD_BYTES_MAX, ACCEPTED_INPUT_FORMATS } from "@/server/image-bank/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Validation ───────────────────────────────────────────────────────────────

const IMAGE_TYPES = [
  "banniere",
  "carre",
  "affiche",
  "infographie",
  "editorial",
  "photo",
  "dataviz",
  "logo",
] as const;

// Mapping dossiers source → module DB + persona optionnelle.
// Correspond exactement à l'arborescence "Images Axion-IA/" de l'opérateur.
const FOLDER_TO_MODULE: Record<
  string,
  { module: string; targetPersona?: string; targetCity?: string }
> = {
  Audit: { module: "audit" },
  "Formations & Interventions": { module: "interventions_formations" },
  "Automatisations et implémentations": { module: "implementations" },
  "1 TO 1/Dirigeant 1 TO 1": { module: "un-a-un", targetPersona: "dirigeant" },
  "Dirigeant 1 TO 1": { module: "un-a-un", targetPersona: "dirigeant" },
  "1 TO 1/Membre d'équipe 1 TO 1": { module: "un-a-un", targetPersona: "equipe" },
  "Membre d'équipe 1 TO 1": { module: "un-a-un", targetPersona: "equipe" },
  Logos: { module: "logo" },
  "Graphiques et courbes": { module: "graphique" },
  "Tous types de propositions": { module: "proposition" },
  Villes: { module: "ville" },
};

function resolveModuleFromFolder(sourceFolder?: string): {
  module?: string;
  targetPersona?: string;
  targetCity?: string;
} {
  if (!sourceFolder) return {};
  const villeMatch = sourceFolder.match(/^Villes\/(.+)$/);
  if (villeMatch && villeMatch[1]) return { module: "ville", targetCity: villeMatch[1] };
  return FOLDER_TO_MODULE[sourceFolder] ?? {};
}

const metaSchema = z.object({
  slug_fr: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug doit être kebab-case ASCII")
    .min(5)
    .max(120),
  // source_folder détecte automatiquement le module depuis le dossier.
  // Si absent, category est utilisé en fallback.
  source_folder: z.string().max(120).optional(),
  category: z.string().max(80).optional(),
  image_type: z.enum(IMAGE_TYPES),
  alt_fr: z.string().min(5).max(500).optional(),
});

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1) Auth
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role ?? "reader";
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const userId = session.user.id;

  // 2) Rate limit — 30 requêtes / 5 min / admin
  const rl = await checkRateLimit(`image-bank:import:${userId}`, {
    limit: 30,
    windowSec: 300,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: 300 },
      { status: 429 },
    );
  }

  // 3) Parse multipart
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_multipart" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  }

  if (file.size > UPLOAD_BYTES_MAX) {
    return NextResponse.json(
      { ok: false, error: "file_too_large", maxBytes: UPLOAD_BYTES_MAX },
      { status: 413 },
    );
  }

  // 4) Validation métadonnées
  const rawMeta = {
    slug_fr: formData.get("slug_fr"),
    source_folder: formData.get("source_folder") ?? undefined,
    category: formData.get("category") ?? undefined,
    image_type: formData.get("image_type"),
    alt_fr: formData.get("alt_fr") ?? undefined,
  };
  const parsedMeta = metaSchema.safeParse(rawMeta);
  if (!parsedMeta.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_metadata", details: parsedMeta.error.flatten() },
      { status: 422 },
    );
  }
  const { slug_fr, source_folder, category, image_type, alt_fr } = parsedMeta.data;

  // Résolution automatique du module depuis le dossier source.
  // Ex. : "Audit" → module="audit", "Villes/Lyon" → module="ville" + city="Lyon"
  const folderMeta = resolveModuleFromFolder(source_folder);
  const _resolvedModule = folderMeta.module ?? category ?? "proposition";

  // 5) Écriture /tmp sécurisé
  const uuid = randomUUID();
  const originalFilename = (file as File).name ?? `upload-${uuid}`;
  const mimeType = file.type || "application/octet-stream";

  // Vérification MIME basique côté route (Sharp valide les magic bytes dans le worker)
  const ext = path.extname(originalFilename).slice(1).toLowerCase();
  const extToFormat: Record<string, string> = {
    jpg: "jpeg",
    jpeg: "jpeg",
    png: "png",
    webp: "webp",
    tif: "tiff",
    tiff: "tiff",
    heic: "heif",
    heif: "heif",
    avif: "avif",
  };
  const detectedFormat = extToFormat[ext];
  if (
    detectedFormat &&
    !ACCEPTED_INPUT_FORMATS.includes(detectedFormat as (typeof ACCEPTED_INPUT_FORMATS)[number])
  ) {
    return NextResponse.json(
      { ok: false, error: "unsupported_format", accepted: ACCEPTED_INPUT_FORMATS },
      { status: 415 },
    );
  }

  const tmpDir = path.join(os.tmpdir(), "axion-image-bank");
  await fs.mkdir(tmpDir, { recursive: true });
  const tmpFilePath = path.join(tmpDir, `${uuid}-${path.basename(originalFilename)}`);

  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(tmpFilePath, Buffer.from(arrayBuffer));

  // 6) Enqueue BullMQ
  await enqueueImageBankImport({
    tmpFilePath,
    originalFilename,
    mimetype: mimeType,
    uploadedBy: userId,
    triggerEnrich: true,
    initialMetadata: {
      slug: slug_fr,
      sourceType: image_type === "logo" ? "illustration" : "photo",
      ...(alt_fr ? { altFr: alt_fr } : {}),
      ...(folderMeta.targetCity ? { geoPlacename: folderMeta.targetCity, geoRegion: "FR" } : {}),
    },
  });

  return NextResponse.json(
    {
      ok: true,
      status: "queued",
      slug: slug_fr,
      category,
      imageType: image_type,
      originalFilename,
      fileSizeBytes: file.size,
      queuedAt: new Date().toISOString(),
    },
    { status: 202 },
  );
}
