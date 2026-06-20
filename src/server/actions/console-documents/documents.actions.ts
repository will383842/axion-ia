// Documents console (hub « Documents ») — Server Actions : upload + suppression.
//
// Upload via FormData (le fichier transite par le serveur → volume disque hors
// web-root, cf. storeConsoleDoc). Taille ≤ bodySizeLimit (10 Mo) — suffisant
// pour plaquettes / pièces admin. RBAC : write = editor+ ; delete = admin+.

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import {
  storeConsoleDoc,
  deleteConsoleDocFile,
  sanitizeConsoleDocFileName,
  CONSOLE_DOC_ALLOWED_MIME,
  CONSOLE_DOC_ALLOWED_EXTENSIONS,
  CONSOLE_DOC_MAX_BYTES,
} from "@/server/console-documents/storage";
import { getConsoleDocSection } from "@/server/console-documents/sections";
import type { ConsoleDocSection } from "../../../../prisma/generated/client";

type ActionResult = { ok: true } | { ok: false; error: string };

const ADMIN_WRITE_ROLES = new Set(["super_admin", "admin", "editor"]);
const ADMIN_DELETE_ROLES = new Set(["super_admin", "admin"]);

async function requireRole(
  allowed: Set<string>,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return { ok: false, error: "Non authentifié." };
  if (!allowed.has(user.role ?? "")) return { ok: false, error: "Droits insuffisants." };
  return { ok: true, userId: user.id };
}

const SECTIONS = ["implementations", "sites_web", "autres"] as const;

const uploadSchema = z.object({
  section: z.enum(SECTIONS),
  title: z.string().trim().min(1, "Titre requis.").max(200),
  description: z.string().trim().max(2000).optional(),
  sensitive: z.boolean().optional(),
});

const EXT_RE = new RegExp(
  `(${CONSOLE_DOC_ALLOWED_EXTENSIONS.map((e) => "\\" + e).join("|")})$`,
  "i",
);

function revalidateBucket(section: ConsoleDocSection): void {
  const segment = getConsoleDocSection(section)?.segment ?? "autres";
  revalidatePath(adminPath("fr", `documents-interventions/${segment}`));
}

/** Upload d'un document dans une section (bucket). */
export async function uploadConsoleDocAction(formData: FormData): Promise<ActionResult> {
  const guard = await requireRole(ADMIN_WRITE_ROLES);
  if (!guard.ok) return guard;

  const parsed = uploadSchema.safeParse({
    section: formData.get("section"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    sensitive: formData.get("sensitive") === "on" || formData.get("sensitive") === "true",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Paramètres invalides." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Aucun fichier fourni." };
  }
  // Taille vérifiée AVANT de charger le buffer en mémoire (anti-DoS RAM).
  if (file.size > CONSOLE_DOC_MAX_BYTES) {
    return { ok: false, error: "Fichier trop volumineux (10 Mo max)." };
  }
  const okExt = EXT_RE.test(file.name);
  const okMime = (CONSOLE_DOC_ALLOWED_MIME as readonly string[]).includes(file.type);
  if (!okExt && !okMime) {
    return { ok: false, error: "Type de fichier non autorisé (PDF, Office ou image)." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { storagePath, hashSha256 } = await storeConsoleDoc(buffer, file.name);

  // Ordre = max(sortOrder)+1 pour ranger le nouveau doc en fin de liste.
  const last = await prisma.consoleDocument.findFirst({
    where: { section: parsed.data.section },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.consoleDocument.create({
    data: {
      section: parsed.data.section,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      fileName: sanitizeConsoleDocFileName(file.name),
      storagePath,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      hashSha256,
      sensitive: parsed.data.sensitive ?? false,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      uploadedById: guard.userId,
    },
  });

  revalidateBucket(parsed.data.section);
  return { ok: true };
}

const deleteSchema = z.object({ id: z.string().uuid() });

/** Suppression d'un document (fichier disque + ligne DB). */
export async function deleteConsoleDocAction(formData: FormData): Promise<ActionResult> {
  const guard = await requireRole(ADMIN_DELETE_ROLES);
  if (!guard.ok) return guard;

  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Identifiant invalide." };

  const doc = await prisma.consoleDocument.findUnique({
    where: { id: parsed.data.id },
    select: { storagePath: true, section: true },
  });
  if (!doc) return { ok: false, error: "Document introuvable." };

  await prisma.consoleDocument.delete({ where: { id: parsed.data.id } });
  await deleteConsoleDocFile(doc.storagePath);

  revalidateBucket(doc.section);
  return { ok: true };
}
