"use server";

// Server Actions CRUD « Communiqués de presse » (Salle de presse admin).
//
// 2026-06-22 — BASCULE PDF : un communiqué = un PDF uploadé (+ titre, date,
// tag, dek). Plus de saisie du corps texte (`body`) côté admin. Le PDF est
// stocké via les helpers `console-documents/storage.ts` (volume hors web-root)
// et servi publiquement via `/api/presse/communique/[id]`.
//
// Doctrine Axion-IA :
//   - "use server" en tête (Server Actions, pas REST).
//   - Auth admin via `auth()` NextAuth v5.
//   - Upload via FormData (mirror du pattern `uploadPressMediaAsset`).
//   - Zod aux frontières.
//   - `prisma` depuis `@/lib/prisma`, `slugify` depuis `@/lib/slug`.
//   - FR canonique (FR-only ici).
//   - exactOptionalPropertyTypes : aucun `undefined` injecté dans les data
//     Prisma → spreads conditionnels.
//   - Toute mutation revalide `/fr/presse`.

import { extname } from "node:path";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import {
  storeConsoleDoc,
  deleteConsoleDocFile,
  sanitizeConsoleDocFileName,
  CONSOLE_DOC_MAX_BYTES,
} from "@/server/console-documents/storage";
import { pdfBufferToText } from "@/server/press/pdf-extract";
import type { Locale, PublishStatus } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────
// Auth.
// ─────────────────────────────────────────────────────────────────
async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    throw new Error("forbidden");
  }
}

// ─────────────────────────────────────────────────────────────────
// Zod.
// ─────────────────────────────────────────────────────────────────
const tagSchema = z.enum(["launch", "partnership", "study", "product", "milestone"]);
const statusSchema = z.enum(["draft", "published", "archived"]);
const audienceSchema = z.enum(["GENERAL", "FOUNDER"]);

// Taxonomie « ciblage média » (2026-06-24). region/departement/sector sont des
// chaînes libres validées par longueur (les slugs valides viennent des SSOTs
// côté UI ; on accepte aussi "" → null pour « non spécifié »). audience a un
// défaut GENERAL au niveau DB.
const metaSchema = z.object({
  title: z
    .string()
    .min(3, "Le titre doit faire au moins 3 caractères.")
    .max(255, "Le titre ne peut pas dépasser 255 caractères."),
  dek: z.string().max(320, "Le résumé ne peut pas dépasser 320 caractères.").optional(),
  tag: tagSchema,
  status: statusSchema.optional(),
  region: z.string().max(64).optional(),
  departement: z
    .string()
    .max(
      8,
      "Code département : 8 caractères maximum (ex. 75, 2A, 974). Saisissez le code, pas le nom.",
    )
    .optional(),
  sector: z.string().max(64).optional(),
  audience: audienceSchema.optional(),
  // Date de diffusion du communiqué (jour, `<input type="date">`).
  //
  // 🔴 Elle DOIT être saisissable. Auparavant `publishedAt` n'était posé que par
  // le premier clic « Publier » et n'était modifiable nulle part : la date de la
  // carte, le `datePublished` du JSON-LD NewsArticle et le `<lastmod>` du
  // sitemap valaient donc l'instant du clic, jamais la date réelle du CP. Un
  // communiqué rédigé la veille, ou importé en lot, sortait daté du jour.
  // La couverture médias, elle, avait ce champ depuis le début — l'asymétrie
  // signait l'oubli, pas un choix.
  publishedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ.")
    .refine((v) => !Number.isNaN(Date.parse(`${v}T12:00:00.000Z`)), "Date invalide.")
    .optional(),
});

/**
 * "AAAA-MM-JJ" → Date à midi UTC. Midi (et non minuit) : la page publique
 * n'affiche que le jour via `toISOString().slice(0, 10)`, et minuit UTC bascule
 * d'un jour dans les fuseaux à l'ouest. Midi tient dans les deux sens.
 */
function parseDayToDate(day: string): Date {
  return new Date(`${day}T12:00:00.000Z`);
}

/** "" / undefined → undefined (champ non fourni). Sinon la valeur trimée. */
function emptyToUndefined(v: FormDataEntryValue | null): string | undefined {
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// ─────────────────────────────────────────────────────────────────
// Validation PDF — extension + MIME.
// ─────────────────────────────────────────────────────────────────
const PDF_MIME = new Set<string>([
  "application/pdf",
  // certains navigateurs envoient un type vide → on tolère et on se rabat sur
  // l'extension (validée juste avant).
  "",
]);

interface StoredPdf {
  pdfStoragePath: string;
  pdfFileName: string;
  pdfFileSize: number;
  pdfHashSha256: string;
  /** Corps HTML extrait du PDF (SEO/AEO landing). "" si extraction impossible. */
  bodyHtml: string;
}

/**
 * Valide + stocke un PDF issu d'un champ FormData. Retourne `null` si aucun
 * fichier n'est fourni (cas update : conserver le PDF actuel). Throw une Error
 * (message = code) si le fichier est présent mais invalide.
 */
async function validateAndStorePdf(file: FormDataEntryValue | null): Promise<StoredPdf | null> {
  if (!(file instanceof File) || file.size === 0) return null;

  if (file.size > CONSOLE_DOC_MAX_BYTES) throw new Error("file_too_large");

  const ext = extname(file.name).toLowerCase();
  if (ext !== ".pdf") throw new Error("unsupported_extension");
  if (!PDF_MIME.has(file.type)) throw new Error("unsupported_mime");

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await storeConsoleDoc(buffer, file.name);

  // Extraction texte (best-effort, jamais bloquant) pour peupler la landing
  // /presse/[slug] (SEO/AEO). "" si PDF scanné / illisible.
  const bodyHtml = await pdfBufferToText(buffer);

  return {
    pdfStoragePath: stored.storagePath,
    pdfFileName: sanitizeConsoleDocFileName(file.name),
    pdfFileSize: file.size,
    pdfHashSha256: stored.hashSha256,
    bodyHtml,
  };
}

// ─────────────────────────────────────────────────────────────────
// Slug unique par locale (suffixe -2, -3, … en cas de collision).
// `excludeReleaseId` permet de réutiliser le slug du communiqué en cours d'édition.
// ─────────────────────────────────────────────────────────────────
async function uniqueSlug(
  locale: Locale,
  title: string,
  excludeReleaseId?: string,
): Promise<string> {
  const base = slugify(title, { maxLen: 200, fallback: "communique" });
  let candidate = base;
  let n = 1;
  for (;;) {
    const clash = await prisma.pressReleaseTranslation.findFirst({
      where: {
        locale,
        slug: candidate,
        ...(excludeReleaseId ? { releaseId: { not: excludeReleaseId } } : {}),
      },
      select: { id: true },
    });
    if (!clash) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

function revalidatePresse(): void {
  revalidatePath("/fr/presse");
  // 🔴 La liste ne suffit pas. Une correction de titre, de date ou de PDF laissait
  // la page détail (ISR 1 h) et le sitemap servir l'ancienne version : seule
  // `/fr/presse` était purgée. `"page"` sur la route dynamique purge toutes ses
  // instances rendues, sans avoir à connaître les slugs.
  revalidatePath("/fr/presse/[slug]", "page");
  // Pas de purge du sitemap : `/sitemap-presse.xml` est `force-dynamic`
  // (cf. son `route.ts`), donc recalculé à chaque requête. Un `revalidatePath`
  // dessus ne purgerait rien et se lirait, à tort, comme une garantie.
}

// ─────────────────────────────────────────────────────────────────
// createPressRelease — FormData : title, dek?, tag, status?, file (PDF).
// ─────────────────────────────────────────────────────────────────
export async function createPressRelease(
  formData: FormData,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    await requireAdmin();

    const parsed = metaSchema.safeParse({
      title: formData.get("title"),
      dek: formData.get("dek") ?? undefined,
      tag: formData.get("tag"),
      status: formData.get("status") ?? undefined,
      region: emptyToUndefined(formData.get("region")),
      departement: emptyToUndefined(formData.get("departement")),
      sector: emptyToUndefined(formData.get("sector")),
      audience: emptyToUndefined(formData.get("audience")),
      publishedAt: emptyToUndefined(formData.get("publishedAt")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "validation_failed" };
    }
    const meta = parsed.data;
    const status = meta.status ?? "draft";
    // Date saisie si fournie ; sinon comportement historique (maintenant, au
    // premier publish uniquement).
    const publishedAt = meta.publishedAt
      ? parseDayToDate(meta.publishedAt)
      : status === "published"
        ? new Date()
        : null;

    // PDF requis à la création.
    const pdf = await validateAndStorePdf(formData.get("file"));
    if (!pdf) return { ok: false, error: "file_required" };

    const frSlug = await uniqueSlug("fr", meta.title);

    const created = await prisma.pressRelease.create({
      data: {
        tag: meta.tag,
        status,
        ...(publishedAt ? { publishedAt } : {}),
        // Taxonomie ciblage média — spreads conditionnels (exactOptionalPropertyTypes).
        // audience absente ⇒ défaut DB GENERAL.
        ...(meta.region ? { region: meta.region } : {}),
        ...(meta.departement ? { departement: meta.departement } : {}),
        ...(meta.sector ? { sector: meta.sector } : {}),
        ...(meta.audience ? { audience: meta.audience } : {}),
        pdfStoragePath: pdf.pdfStoragePath,
        pdfFileName: pdf.pdfFileName,
        pdfFileSize: pdf.pdfFileSize,
        pdfHashSha256: pdf.pdfHashSha256,
        translations: {
          create: {
            locale: "fr",
            title: meta.title,
            slug: frSlug,
            // `body` = HTML extrait du PDF (SEO/AEO). Null si extraction vide.
            ...(pdf.bodyHtml ? { body: pdf.bodyHtml } : {}),
            ...(meta.dek ? { dek: meta.dek } : {}),
          },
        },
      },
      select: { id: true },
    });

    revalidatePresse();
    return { ok: true, id: created.id };
  } catch (err) {
    console.error("[createPressRelease]", err);
    return { ok: false, error: err instanceof Error ? err.message : "create_failed" };
  }
}

// ─────────────────────────────────────────────────────────────────
// updatePressRelease — FormData : title?, dek?, tag?, file? (PDF optionnel).
// Si un nouveau PDF est fourni, on remplace l'ancien (best-effort delete).
// ─────────────────────────────────────────────────────────────────
export async function updatePressRelease(
  id: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();

    const parsed = metaSchema.partial().safeParse({
      title: formData.get("title") ?? undefined,
      dek: formData.get("dek") ?? undefined,
      tag: formData.get("tag") ?? undefined,
      status: formData.get("status") ?? undefined,
      region: emptyToUndefined(formData.get("region")),
      departement: emptyToUndefined(formData.get("departement")),
      sector: emptyToUndefined(formData.get("sector")),
      audience: emptyToUndefined(formData.get("audience")),
      publishedAt: emptyToUndefined(formData.get("publishedAt")),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "validation_failed" };
    }
    const meta = parsed.data;

    // Taxonomie : un champ PRÉSENT dans le form (même vide) signifie « définir »
    // — vide ⇒ remise à null (« non spécifié »). On distingue donc la présence
    // de la clé (form édité) de l'absence (autre form / partial update).
    const regionTouched = formData.has("region");
    const departementTouched = formData.has("departement");
    const sectorTouched = formData.has("sector");
    const audienceTouched = formData.has("audience");

    const existing = await prisma.pressRelease.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, pdfStoragePath: true },
    });
    if (!existing) return { ok: false, error: "not_found" };

    // PDF optionnel à l'update (vide = conserver l'actuel).
    const pdf = await validateAndStorePdf(formData.get("file"));

    await prisma.$transaction(async (tx) => {
      const releaseData: {
        tag?: z.infer<typeof tagSchema>;
        region?: string | null;
        departement?: string | null;
        sector?: string | null;
        audience?: z.infer<typeof audienceSchema>;
        publishedAt?: Date;
        pdfStoragePath?: string;
        pdfFileName?: string;
        pdfFileSize?: number;
        pdfHashSha256?: string;
      } = {};
      if (meta.tag !== undefined) releaseData.tag = meta.tag;
      if (meta.publishedAt !== undefined) {
        releaseData.publishedAt = parseDayToDate(meta.publishedAt);
      }
      // Taxonomie : présent ⇒ on définit (vide → null). audience vide ⇒ GENERAL.
      if (regionTouched) releaseData.region = meta.region ?? null;
      if (departementTouched) releaseData.departement = meta.departement ?? null;
      if (sectorTouched) releaseData.sector = meta.sector ?? null;
      if (audienceTouched) releaseData.audience = meta.audience ?? "GENERAL";
      if (pdf) {
        releaseData.pdfStoragePath = pdf.pdfStoragePath;
        releaseData.pdfFileName = pdf.pdfFileName;
        releaseData.pdfFileSize = pdf.pdfFileSize;
        releaseData.pdfHashSha256 = pdf.pdfHashSha256;
      }
      if (Object.keys(releaseData).length > 0) {
        await tx.pressRelease.update({ where: { id }, data: releaseData });
      }

      // Traduction FR (titre + dek + body). Sur remplacement du PDF, on
      // ré-extrait le texte → met à jour `body` (la landing se repeuple).
      const trData: { title?: string; dek?: string; slug?: string; body?: string } = {};
      if (meta.title !== undefined) {
        trData.title = meta.title;
        trData.slug = await uniqueSlug("fr", meta.title, id);
      }
      if (meta.dek !== undefined) trData.dek = meta.dek;
      // PDF remplacé avec un texte exploitable → on rafraîchit le corps HTML.
      if (pdf && pdf.bodyHtml) trData.body = pdf.bodyHtml;

      if (Object.keys(trData).length > 0) {
        const existingTr = await tx.pressReleaseTranslation.findUnique({
          where: { releaseId_locale: { releaseId: id, locale: "fr" } },
          select: { id: true },
        });
        if (existingTr) {
          await tx.pressReleaseTranslation.update({
            where: { releaseId_locale: { releaseId: id, locale: "fr" } },
            data: trData,
          });
        } else if (trData.title !== undefined) {
          await tx.pressReleaseTranslation.create({
            data: {
              releaseId: id,
              locale: "fr",
              title: trData.title,
              slug: trData.slug ?? (await uniqueSlug("fr", trData.title, id)),
              ...(trData.dek !== undefined ? { dek: trData.dek } : {}),
              ...(trData.body !== undefined ? { body: trData.body } : {}),
            },
          });
        }
      }
    });

    // Remplacement PDF réussi → retrait best-effort de l'ancien binaire.
    if (pdf && existing.pdfStoragePath && existing.pdfStoragePath !== pdf.pdfStoragePath) {
      await deleteConsoleDocFile(existing.pdfStoragePath);
    }

    revalidatePresse();
    return { ok: true };
  } catch (err) {
    console.error("[updatePressRelease]", err);
    return { ok: false, error: err instanceof Error ? err.message : "update_failed" };
  }
}

// ─────────────────────────────────────────────────────────────────
// setPressReleaseStatus — publie/dépublie. Pose publishedAt au 1er publish.
// ─────────────────────────────────────────────────────────────────
export async function setPressReleaseStatus(
  id: string,
  status: PublishStatus,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    if (!statusSchema.safeParse(status).success) {
      return { ok: false, error: "invalid_status" };
    }

    const existing = await prisma.pressRelease.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, publishedAt: true },
    });
    if (!existing) return { ok: false, error: "not_found" };

    await prisma.pressRelease.update({
      where: { id },
      data: {
        status,
        // 1er publish uniquement : on pose publishedAt=now (sinon on préserve).
        ...(status === "published" && !existing.publishedAt ? { publishedAt: new Date() } : {}),
      },
    });

    revalidatePresse();
    return { ok: true };
  } catch (err) {
    console.error("[setPressReleaseStatus]", err);
    return { ok: false, error: err instanceof Error ? err.message : "status_failed" };
  }
}

// ─────────────────────────────────────────────────────────────────
// movePressRelease — réordonnancement manuel (↑/↓). Normalise `sortOrder`
// sur 0..n-1 dans l'ordre d'affichage courant puis échange la cible avec son
// voisin. Réécrit toutes les lignes (≤200) en transaction → ordre déterministe
// même quand tous les sortOrder valent 0 au départ. L'ordre pilote l'affichage
// public (la page /presse trie par sortOrder asc).
// ─────────────────────────────────────────────────────────────────
export async function movePressRelease(
  id: string,
  direction: "up" | "down",
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const rows = await prisma.pressRelease.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return { ok: false, error: "not_found" };

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    // Déjà en bord de liste → no-op silencieux (le bouton devrait être désactivé).
    if (swapIdx < 0 || swapIdx >= rows.length) return { ok: true };

    const reordered = [...rows];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(swapIdx, 0, moved!);

    await prisma.$transaction(
      reordered.map((r, i) =>
        prisma.pressRelease.update({ where: { id: r.id }, data: { sortOrder: i } }),
      ),
    );

    revalidatePresse();
    return { ok: true };
  } catch (err) {
    console.error("[movePressRelease]", err);
    return { ok: false, error: err instanceof Error ? err.message : "move_failed" };
  }
}

// ─────────────────────────────────────────────────────────────────
// bulkCreatePressReleases — création en masse depuis N PDF (multi-upload).
// FormData : files (N×PDF) + tag commun. Chaque PDF → 1 brouillon, titre
// pré-rempli = nom du fichier nettoyé (à compléter ensuite via l'éditeur).
// Best-effort par fichier : un PDF invalide est compté en `failed`, n'arrête
// pas le lot.
// ─────────────────────────────────────────────────────────────────
export async function bulkCreatePressReleases(
  formData: FormData,
): Promise<{ ok: boolean; created: number; failed: number; error?: string }> {
  try {
    await requireAdmin();

    const tagParsed = tagSchema.safeParse(formData.get("tag"));
    if (!tagParsed.success) return { ok: false, created: 0, failed: 0, error: "invalid_tag" };
    const tag = tagParsed.data;

    const files = formData
      .getAll("files")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return { ok: false, created: 0, failed: 0, error: "file_required" };

    let created = 0;
    let failed = 0;
    for (const file of files) {
      try {
        const stored = await validateAndStorePdf(file);
        if (!stored) {
          failed += 1;
          continue;
        }
        const title =
          file.name
            .replace(/\.pdf$/i, "")
            .replace(/[-_]+/g, " ")
            .trim()
            .slice(0, 255) || "Communiqué";
        const frSlug = await uniqueSlug("fr", title);
        await prisma.pressRelease.create({
          data: {
            tag,
            status: "draft",
            pdfStoragePath: stored.pdfStoragePath,
            pdfFileName: stored.pdfFileName,
            pdfFileSize: stored.pdfFileSize,
            pdfHashSha256: stored.pdfHashSha256,
            translations: {
              create: {
                locale: "fr",
                title,
                slug: frSlug,
                ...(stored.bodyHtml ? { body: stored.bodyHtml } : {}),
              },
            },
          },
        });
        created += 1;
      } catch (itemErr) {
        console.error("[bulkCreatePressReleases:item]", itemErr);
        failed += 1;
      }
    }

    revalidatePresse();
    return { ok: created > 0, created, failed };
  } catch (err) {
    console.error("[bulkCreatePressReleases]", err);
    return {
      ok: false,
      created: 0,
      failed: 0,
      error: err instanceof Error ? err.message : "bulk_failed",
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// deletePressRelease — soft delete + suppression PDF best-effort.
// ─────────────────────────────────────────────────────────────────
export async function deletePressRelease(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const existing = await prisma.pressRelease.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, pdfStoragePath: true },
    });
    if (!existing) return { ok: false, error: "not_found" };

    await prisma.pressRelease.update({
      where: { id },
      data: { deletedAt: new Date(), status: "archived" },
    });

    // Best-effort : retrait du binaire PDF du disque.
    await deleteConsoleDocFile(existing.pdfStoragePath);

    revalidatePresse();
    return { ok: true };
  } catch (err) {
    console.error("[deletePressRelease]", err);
    return { ok: false, error: err instanceof Error ? err.message : "delete_failed" };
  }
}
