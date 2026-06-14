/**
 * Import en masse d'un kit de formation (ZIP) → bibliothèque documents-interventions.
 *
 * IDEMPOTENT : pour chaque (formation × slot), on calcule un hash du contenu
 * (PDF + source). Si la version courante a le MÊME hash → on saute (aucune
 * écriture). Sinon → nouvelle version publiée (l'ancienne passe en `archive`).
 *
 * SSOT : le titre / la catégorie / la VISIBILITÉ viennent du catalogue
 * (intervention-documents-catalog.ts via getSlot) — jamais codés ici — pour ne
 * pas diverger de l'UI manuelle. La visibilité est RÉÉCRITE à chaque maj.
 *
 * GARDES anti-OOM / anti-zip-bomb : plafonds de taille (ZIP, fichier, total
 * décompressé) et de nombre d'entrées AVANT extraction — le worker tourne dans
 * un process partagé avec ~40 autres workers, une OOM les tuerait tous.
 *
 * Node runtime (Prisma + R2 + jszip). Tourne dans le worker BullMQ.
 */

import { createHash } from "node:crypto";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { uploadToR2, getObjectBufferR2 } from "@/lib/r2-storage";
import { getSlot, type InterventionFamille } from "@/content/intervention-documents-catalog";
import { classifyEntry, buildKitR2Key, knownTopFolders } from "./kit-mapping";

const MIME: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf",
};

// Plafonds (garde anti-zip-bomb / anti-OOM du process worker partagé).
const MAX_ZIP_BYTES = 300 * 1024 * 1024; // 300 Mo (ZIP compressé)
const MAX_ENTRIES = 2000; // nombre d'entrées dans le ZIP
const MAX_FILE_BYTES = 80 * 1024 * 1024; // 80 Mo par fichier décompressé
const MAX_TOTAL_BYTES = 800 * 1024 * 1024; // 800 Mo décompressés cumulés

export interface KitImportSummary {
  created: number;
  updated: number;
  unchanged: number;
  items: Array<{ slug: string; slot: string; action: "created" | "updated" | "unchanged" }>;
  unmappedFolders: string[];
  errors: string[];
}

interface SlotBundle {
  slug: string;
  slot: string;
  sourcePath?: string;
  sourceExt?: string;
  pdfPath?: string;
}

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** Importe un kit depuis un buffer ZIP. Idempotent. Famille-aware (défaut : formation). */
export async function importKitFromZip(
  zipBuffer: Buffer,
  famille: InterventionFamille = "formation",
): Promise<KitImportSummary> {
  const summary: KitImportSummary = {
    created: 0,
    updated: 0,
    unchanged: 0,
    items: [],
    unmappedFolders: [],
    errors: [],
  };

  if (zipBuffer.length > MAX_ZIP_BYTES) {
    throw new Error(
      `ZIP trop volumineux (${Math.round(zipBuffer.length / 1024 / 1024)} Mo > ${MAX_ZIP_BYTES / 1024 / 1024} Mo).`,
    );
  }

  const zip = await JSZip.loadAsync(zipBuffer);
  const allPaths = Object.keys(zip.files);
  if (allPaths.length > MAX_ENTRIES) {
    throw new Error(`ZIP avec trop d'entrées (${allPaths.length} > ${MAX_ENTRIES}).`);
  }

  // 1. Regroupe les entrées par (slug, slot), en appariant source + pdf.
  //    Un fichier peut viser PLUSIEURS slugs (variantes 1j/2j en 1-to-1) → on
  //    crée/alimente un bundle par slug destinataire (même contenu réutilisé).
  const bundles = new Map<string, SlotBundle>();
  const seenFolders = new Set<string>();
  const knownFolders = knownTopFolders(famille);

  for (const rawPath of allPaths) {
    const entry = zip.files[rawPath];
    if (!entry || entry.dir) continue;
    // Normalise les séparateurs (Compress-Archive Windows écrit parfois des `\`).
    const path = rawPath.replace(/\\/g, "/");
    const topFolder = path.split("/").filter(Boolean)[0];
    if (topFolder) seenFolders.add(topFolder);

    const classified = classifyEntry(path, famille);
    if (!classified) continue;
    for (const slug of classified.slugs) {
      const key = `${slug}::${classified.slot}`;
      const b = bundles.get(key) ?? { slug, slot: classified.slot };
      // Clé BRUTE (rawPath) pour relire le contenu ; classification sur le normalisé.
      if (classified.kind === "source") {
        b.sourcePath = rawPath;
        b.sourceExt = classified.ext;
      } else {
        b.pdfPath = rawPath;
      }
      bundles.set(key, b);
    }
  }

  for (const f of seenFolders) {
    if (!knownFolders.has(f)) summary.unmappedFolders.push(f);
  }

  // 2. Traite chaque bundle (idempotent), avec garde de taille cumulée.
  let totalBytes = 0;
  for (const b of bundles.values()) {
    try {
      const slotDef = getSlot(famille, b.slot);
      if (!slotDef) {
        summary.errors.push(`${b.slug}/${b.slot} : slot inconnu du catalogue, ignoré`);
        continue;
      }
      if (slotDef.generatedOnly) {
        // Document généré par la plateforme : pas d'upload statique.
        continue;
      }
      if (slotDef.qualiopiDocType) {
        // Document Qualiopi (positionnement / évaluation / satisfaction / attestation) :
        // produit/agrégé par le Formation Engine, JAMAIS dupliqué via l'import en masse
        // (invariant aligné sur les formations — cf. catalogue + schéma documents_interventions).
        continue;
      }

      const srcBuf = b.sourcePath ? await zip.files[b.sourcePath]!.async("nodebuffer") : null;
      const pdfBuf = b.pdfPath ? await zip.files[b.pdfPath]!.async("nodebuffer") : null;
      if (!srcBuf && !pdfBuf) continue;

      for (const buf of [srcBuf, pdfBuf]) {
        if (buf && buf.length > MAX_FILE_BYTES) {
          throw new Error(
            `Fichier trop volumineux (${Math.round(buf.length / 1024 / 1024)} Mo > ${MAX_FILE_BYTES / 1024 / 1024} Mo).`,
          );
        }
      }
      totalBytes += (srcBuf?.length ?? 0) + (pdfBuf?.length ?? 0);
      if (totalBytes > MAX_TOTAL_BYTES) {
        throw new Error(`Kit décompressé trop volumineux (> ${MAX_TOTAL_BYTES / 1024 / 1024} Mo).`);
      }

      const hash = sha256Hex(Buffer.concat([pdfBuf ?? Buffer.alloc(0), srcBuf ?? Buffer.alloc(0)]));

      const existing = await prisma.interventionDocument.findUnique({
        where: { interventionSlug_slot: { interventionSlug: b.slug, slot: b.slot } },
        select: {
          id: true,
          currentVersionId: true,
          currentVersion: { select: { hashSha256: true } },
        },
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
            famille,
            categorie: slotDef.categorie,
            slot: b.slot,
            titre: slotDef.titre,
            visibilite: slotDef.visibilite,
            source: "upload",
          },
          select: { id: true },
        });
        docId = doc.id;
      } else {
        // Réaligne titre/catégorie/visibilité sur le catalogue (déterminisme).
        await prisma.interventionDocument.update({
          where: { id: docId },
          data: {
            categorie: slotDef.categorie,
            titre: slotDef.titre,
            visibilite: slotDef.visibilite,
          },
        });
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

      const prevCurrentId = existing?.currentVersionId ?? null;
      // Transaction : crée la version + archive l'ancienne courante + pointe la nouvelle.
      await prisma.$transaction(async (tx) => {
        const ver = await tx.interventionDocumentVersion.create({
          data: {
            documentId: docId!,
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
        if (prevCurrentId) {
          await tx.interventionDocumentVersion.update({
            where: { id: prevCurrentId },
            data: { statut: "archive" },
          });
        }
        await tx.interventionDocument.update({
          where: { id: docId! },
          data: { currentVersionId: ver.id },
        });
      });

      if (isNew) {
        summary.created++;
        summary.items.push({ slug: b.slug, slot: b.slot, action: "created" });
      } else {
        summary.updated++;
        summary.items.push({ slug: b.slug, slot: b.slot, action: "updated" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Les erreurs de plafond doivent arrêter tout l'import (sécurité).
      if (/volumineux|entrées/.test(msg)) throw e;
      summary.errors.push(`${b.slug}/${b.slot} : ${msg}`);
    }
  }

  return summary;
}

/**
 * Charge le ZIP depuis R2 (clé temporaire) et l'importe.
 * NE supprime PAS le ZIP : le worker le fait APRÈS l'écriture du statut final,
 * pour qu'un retry (statut non encore 'termine') puisse re-télécharger le ZIP.
 */
export async function importKitFromR2Key(
  tempKey: string,
  famille: InterventionFamille = "formation",
): Promise<KitImportSummary> {
  const buf = await getObjectBufferR2(tempKey);
  if (!buf) throw new Error(`ZIP introuvable sur R2 : ${tempKey}`);
  return importKitFromZip(buf, famille);
}
