// Documents console (hub « Documents ») — Server Actions : upload, suppression,
// et (chantier QNC, L13, interrupteur allumé) remplacement en nouvelle version.
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
import { journaliser } from "@/server/journal/journaliser";
import {
  archivageDocumentsOrganismeActif,
  verrouillerVersionDocument,
} from "@/server/qualiopi/documents-organisme/documents-organisme";
import { ACTION_DOCUMENT_REMPLACE } from "@/server/qualiopi/documents-organisme/documents-organisme-pur";
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

  // CHANTIER QNC, L13 (NC10, NC11, NC15) — archivage allumé : plus aucune
  // suppression. Refus AVANT toute lecture.
  if (await archivageDocumentsOrganismeActif()) {
    return {
      ok: false,
      error:
        "Un document ne se supprime plus : remplacez-le (l'ancien est gardé, étiqueté « remplacé par »). Le retrait est réservé au super-administrateur, par le journal des effacements.",
    };
  }

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

class DejaRemplace extends Error {}

/**
 * CHANTIER QNC, L13 — remplacer un document : un NOUVEAU document reprend le
 * titre, la description, la section et le rang ; l'ancien reste, avec son
 * fichier, étiqueté « remplacé par » au journal (même transaction, `exiger`).
 * N'existe que l'interrupteur allumé : éteint, le hub se comporte comme avant.
 * Même rôle que la suppression qu'il remplace (admin+).
 */
export async function remplacerConsoleDocAction(formData: FormData): Promise<ActionResult> {
  const guard = await requireRole(ADMIN_DELETE_ROLES);
  if (!guard.ok) return guard;

  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Identifiant invalide." };

  if (!(await archivageDocumentsOrganismeActif())) {
    return { ok: false, error: "Le remplacement n'est pas ouvert sur cette console." };
  }

  const ancien = await prisma.consoleDocument.findUnique({
    where: { id: parsed.data.id },
    select: {
      section: true,
      title: true,
      description: true,
      sensitive: true,
      sortOrder: true,
      hashSha256: true,
    },
  });
  if (!ancien) return { ok: false, error: "Document introuvable." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Aucun fichier fourni." };
  }
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

  try {
    await prisma.$transaction(async (tx) => {
      const { dejaRemplacee } = await verrouillerVersionDocument(
        tx,
        "ConsoleDocument",
        parsed.data.id,
      );
      if (dejaRemplacee) throw new DejaRemplace();
      const nouveau = await tx.consoleDocument.create({
        data: {
          section: ancien.section,
          title: ancien.title,
          description: ancien.description,
          fileName: sanitizeConsoleDocFileName(file.name),
          storagePath,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          hashSha256,
          sensitive: ancien.sensitive,
          sortOrder: ancien.sortOrder,
          uploadedById: guard.userId,
        },
        select: { id: true },
      });
      await journaliser(
        tx,
        {
          action: ACTION_DOCUMENT_REMPLACE,
          targetType: "ConsoleDocument",
          targetId: parsed.data.id,
          changes: { nouveauId: nouveau.id, hashAvant: ancien.hashSha256, hashApres: hashSha256 },
          session: { userId: guard.userId },
        },
        { exiger: true },
      );
    });
  } catch (e) {
    if (e instanceof DejaRemplace) {
      return {
        ok: false,
        error:
          "Ce document est déjà remplacé : il reste tel quel. Remplacez la version en vigueur.",
      };
    }
    throw e;
  }
  // ⚠️ Aucun `deleteConsoleDocFile` : l'ancien fichier EST l'ancienne version.

  revalidateBucket(ancien.section);
  return { ok: true };
}
