/**
 * Import en masse d'un kit de formation (ZIP) → bibliothèque documents-interventions.
 *
 * IDEMPOTENT : pour chaque (formation × slot), on calcule un hash du contenu
 * (PDF + source). Si la version courante a le MÊME hash → on saute (aucune
 * écriture). Sinon → nouvelle version publiée (l'ancienne reste dans l'historique).
 *
 * Node runtime (Prisma + R2 + jszip). Conçu pour tourner dans le worker BullMQ
 * (côté serveur, qui a l'accès prod) — jamais côté agent.
 */

import { createHash } from "node:crypto";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { uploadToR2, deleteFromR2 } from "@/lib/r2-storage";
import { classifyEntry, buildKitR2Key, FOLDER_TO_SLUG, type SlotConfig } from "./kit-mapping";

const MIME: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf",
};

export interface KitImportSummary {
  created: number;
  updated: number;
  unchanged: number;
  /** Détail par document (pour le récap UI). */
  items: Array<{ slug: string; slot: string; action: "created" | "updated" | "unchanged" }>;
  /** Dossiers du ZIP non reconnus (mapping à compléter). */
  unmappedFolders: string[];
  errors: string[];
}

interface SlotBundle {
  slug: string;
  slot: string;
  config: SlotConfig;
  sourcePath?: string;
  sourceExt?: string;
  pdfPath?: string;
}

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Importe un kit depuis un buffer ZIP. Idempotent.
 * @param zipBuffer  contenu du .zip
 */
export async function importKitFromZip(zipBuffer: Buffer): Promise<KitImportSummary> {
  const summary: KitImportSummary = {
    created: 0,
    updated: 0,
    unchanged: 0,
    items: [],
    unmappedFolders: [],
    errors: [],
  };

  const zip = await JSZip.loadAsync(zipBuffer);

  // 1. Regroupe les entrées par (slug, slot), en appariant source + pdf.
  const bundles = new Map<string, SlotBundle>();
  const seenFolders = new Set<string>();
  const knownFolders = new Set(Object.keys(FOLDER_TO_SLUG));

  for (const rawPath of Object.keys(zip.files)) {
    const entry = zip.files[rawPath];
    if (!entry || entry.dir) continue;
    // Normalise les séparateurs : certains zippeurs Windows (Compress-Archive)
    // écrivent des `\` au lieu de `/`.
    const path = rawPath.replace(/\\/g, "/");
    const topFolder = path.split("/").filter(Boolean)[0];
    if (topFolder) seenFolders.add(topFolder);

    const classified = classifyEntry(path);
    if (!classified) continue;
    const key = `${classified.slug}::${classified.slot}`;
    const b = bundles.get(key) ?? {
      slug: classified.slug,
      slot: classified.slot,
      config: classified.config,
    };
    // On stocke la clé BRUTE (rawPath) pour relire le contenu via zip.files,
    // mais on a classé sur le chemin normalisé.
    if (classified.kind === "source") {
      b.sourcePath = rawPath;
      b.sourceExt = classified.ext;
    } else {
      b.pdfPath = rawPath;
    }
    bundles.set(key, b);
  }

  // Dossiers présents dans le ZIP mais non mappés explicitement (info, pas bloquant).
  for (const f of seenFolders) {
    if (!knownFolders.has(f)) summary.unmappedFolders.push(f);
  }

  // 2. Traite chaque bundle (idempotent).
  for (const b of bundles.values()) {
    try {
      const srcBuf = b.sourcePath ? await zip.files[b.sourcePath]!.async("nodebuffer") : null;
      const pdfBuf = b.pdfPath ? await zip.files[b.pdfPath]!.async("nodebuffer") : null;
      if (!srcBuf && !pdfBuf) continue;
      const hash = sha256Hex(Buffer.concat([pdfBuf ?? Buffer.alloc(0), srcBuf ?? Buffer.alloc(0)]));

      const existing = await prisma.interventionDocument.findUnique({
        where: { interventionSlug_slot: { interventionSlug: b.slug, slot: b.slot } },
        select: { id: true, currentVersion: { select: { hashSha256: true } } },
      });

      if (existing?.currentVersion?.hashSha256 === hash) {
        summary.unchanged++;
        summary.items.push({ slug: b.slug, slot: b.slot, action: "unchanged" });
        continue;
      }

      const isNew = !existing;
      let docId = existing?.id;
      if (!docId) {
        const doc = await prisma.interventionDocument.create({
          data: {
            interventionSlug: b.slug,
            famille: "formation",
            categorie: b.config.categorie,
            slot: b.slot,
            titre: b.config.titre,
            visibilite: b.config.visibilite,
            source: "upload",
          },
          select: { id: true },
        });
        docId = doc.id;
      }

      const last = await prisma.interventionDocumentVersion.aggregate({
        where: { documentId: docId },
        _max: { version: true },
      });
      const version = (last._max.version ?? 0) + 1;

      let sourceKey: string | null = null;
      if (srcBuf && b.sourceExt) {
        sourceKey = buildKitR2Key(b.slug, b.slot, version, "source", b.sourceExt);
        await uploadToR2(sourceKey, srcBuf, MIME[b.sourceExt] ?? "application/octet-stream");
      }
      let pdfKey: string | null = null;
      if (pdfBuf) {
        pdfKey = buildKitR2Key(b.slug, b.slot, version, "pdf", "pdf");
        await uploadToR2(pdfKey, pdfBuf, MIME.pdf);
      }

      const ver = await prisma.interventionDocumentVersion.create({
        data: {
          documentId: docId,
          version,
          sourceKey,
          sourceFormat: srcBuf ? (b.sourceExt ?? null) : null,
          sourceSizeBytes: srcBuf?.length ?? 0,
          pdfKey,
          pdfSizeBytes: pdfBuf?.length ?? 0,
          hashSha256: hash,
          changeNote: isNew ? "Import kit (version initiale)" : "Import kit (mise à jour)",
          statut: "publie",
          publishedAt: new Date(),
        },
        select: { id: true },
      });
      await prisma.interventionDocument.update({
        where: { id: docId },
        data: { currentVersionId: ver.id },
      });

      if (isNew) {
        summary.created++;
        summary.items.push({ slug: b.slug, slot: b.slot, action: "created" });
      } else {
        summary.updated++;
        summary.items.push({ slug: b.slug, slot: b.slot, action: "updated" });
      }
    } catch (e) {
      summary.errors.push(`${b.slug}/${b.slot} : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return summary;
}

/** Variante qui charge le ZIP depuis R2 (clé temporaire) puis le supprime. */
export async function importKitFromR2Key(tempKey: string): Promise<KitImportSummary> {
  const { getObjectBufferR2 } = await import("@/lib/r2-storage");
  const buf = await getObjectBufferR2(tempKey);
  if (!buf) throw new Error(`ZIP introuvable sur R2 : ${tempKey}`);
  try {
    return await importKitFromZip(buf);
  } finally {
    // Nettoyage best-effort du ZIP temporaire.
    try {
      await deleteFromR2(tempKey);
    } catch {
      /* ignore */
    }
  }
}
