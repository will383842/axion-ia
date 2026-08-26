// Dossier société — Server Actions : import, modification, remplacement de
// fichier, suppression.
//
// Le module voisin `console-documents` ne sait que déposer et supprimer. Ici il
// faut les quatre gestes, parce que la vie d'une pièce administrative est faite
// de renouvellements : un Kbis de trois mois est REMPLACÉ quatre fois par an,
// et une date d'expiration mal saisie doit pouvoir se corriger sans re-déposer
// le fichier.
//
// Le stockage est celui de `console-documents/storage.ts`, réutilisé tel quel :
// même volume hors web-root, même hash SHA-256, même nettoyage de nom de
// fichier. Dupliquer ces trente lignes aurait créé deux règles de sécurité à
// tenir à jour au lieu d'une.

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
import { getRubriqueForType, SOCIETE_DOC_TYPES } from "@/server/societe-documents/rubriques";
import type { SocieteDocumentType } from "../../../../prisma/generated/client";

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

/**
 * Valeurs acceptées par les schémas Zod, DÉRIVÉES de la SSOT.
 *
 * Écrire la liste à la main ici la ferait diverger de `rubriques.ts` au premier
 * type ajouté — et le formulaire proposerait alors un type que l'action
 * refuserait. `z.enum` exige un tuple non vide, d'où la déstructuration.
 */
const TYPE_VALUES = SOCIETE_DOC_TYPES.map((t) => t.key) as [
  SocieteDocumentType,
  ...SocieteDocumentType[],
];

/** Date au format `AAAA-MM-JJ` (champ `<input type="date">`), ou vide. */
const dateChamp = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null));

const metaSchema = z.object({
  type: z.enum(TYPE_VALUES),
  titre: z.string().trim().min(1, "Titre requis.").max(200),
  description: z.string().trim().max(2000).optional(),
  numeroPiece: z.string().trim().max(60).optional(),
  dateEmission: dateChamp,
  dateExpiration: dateChamp,
  sensitive: z.boolean().optional(),
});

const EXT_RE = new RegExp(
  `(${CONSOLE_DOC_ALLOWED_EXTENSIONS.map((e) => "\\" + e).join("|")})$`,
  "i",
);

function lireMeta(formData: FormData): unknown {
  return {
    type: formData.get("type"),
    titre: formData.get("titre"),
    description: formData.get("description") || undefined,
    numeroPiece: formData.get("numeroPiece") || undefined,
    dateEmission: formData.get("dateEmission") ?? "",
    dateExpiration: formData.get("dateExpiration") ?? "",
    sensitive: formData.get("sensitive") === "on" || formData.get("sensitive") === "true",
  };
}

/** Rafraîchit la rubrique qui contient ce type (segment résolu par la SSOT). */
function revalidateRubrique(type: SocieteDocumentType): void {
  const segment = getRubriqueForType(type)?.segment;
  if (segment) revalidatePath(adminPath("fr", `societe/${segment}`));
  revalidatePath(adminPath("fr", "societe"));
}

/**
 * Contrôle un fichier reçu, puis l'écrit sur le volume.
 *
 * La taille est vérifiée AVANT de charger le contenu en mémoire : lire d'abord
 * puis refuser reviendrait à laisser un fichier de 500 Mo occuper la RAM le
 * temps de le rejeter.
 */
async function accepterFichier(
  file: unknown,
): Promise<
  { ok: true; storagePath: string; hashSha256: string; file: File } | { ok: false; error: string }
> {
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
  return { ok: true, storagePath, hashSha256, file };
}

/** Importer une pièce dans le dossier société. */
export async function importerSocieteDocAction(formData: FormData): Promise<ActionResult> {
  const guard = await requireRole(ADMIN_WRITE_ROLES);
  if (!guard.ok) return guard;

  const parsed = metaSchema.safeParse(lireMeta(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Paramètres invalides." };
  }

  const fichier = await accepterFichier(formData.get("file"));
  if (!fichier.ok) return fichier;

  const dernier = await prisma.societeDocument.findFirst({
    where: { type: parsed.data.type },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const doc = await prisma.societeDocument.create({
    data: {
      type: parsed.data.type,
      titre: parsed.data.titre,
      description: parsed.data.description ?? null,
      numeroPiece: parsed.data.numeroPiece ?? null,
      dateEmission: parsed.data.dateEmission,
      dateExpiration: parsed.data.dateExpiration,
      fileName: sanitizeConsoleDocFileName(fichier.file.name),
      storagePath: fichier.storagePath,
      mimeType: fichier.file.type || "application/octet-stream",
      sizeBytes: fichier.file.size,
      hashSha256: fichier.hashSha256,
      sensitive: parsed.data.sensitive ?? false,
      sortOrder: (dernier?.sortOrder ?? 0) + 1,
      uploadedById: guard.userId,
    },
    select: { id: true },
  });

  await prisma.activityLog.create({
    data: {
      adminUserId: guard.userId,
      action: "societe.document.importe",
      targetType: "SocieteDocument",
      targetId: doc.id,
      changes: { type: parsed.data.type, titre: parsed.data.titre },
    },
  });

  revalidateRubrique(parsed.data.type);
  return { ok: true };
}

const idSchema = z.string().uuid();

/**
 * Modifier les métadonnées d'une pièce, sans toucher au fichier.
 *
 * Le type peut changer de rubrique : on rafraîchit alors les DEUX, sinon
 * l'ancienne continuerait d'afficher une pièce qu'elle ne contient plus.
 */
export async function modifierSocieteDocAction(formData: FormData): Promise<ActionResult> {
  const guard = await requireRole(ADMIN_WRITE_ROLES);
  if (!guard.ok) return guard;

  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Identifiant invalide." };

  const parsed = metaSchema.safeParse(lireMeta(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Paramètres invalides." };
  }

  const avant = await prisma.societeDocument.findUnique({
    where: { id: id.data },
    select: { type: true },
  });
  if (!avant) return { ok: false, error: "Pièce introuvable." };

  await prisma.societeDocument.update({
    where: { id: id.data },
    data: {
      type: parsed.data.type,
      titre: parsed.data.titre,
      description: parsed.data.description ?? null,
      numeroPiece: parsed.data.numeroPiece ?? null,
      dateEmission: parsed.data.dateEmission,
      dateExpiration: parsed.data.dateExpiration,
      sensitive: parsed.data.sensitive ?? false,
    },
  });

  await prisma.activityLog.create({
    data: {
      adminUserId: guard.userId,
      action: "societe.document.modifie",
      targetType: "SocieteDocument",
      targetId: id.data,
      changes: { typeAvant: avant.type, typeApres: parsed.data.type, titre: parsed.data.titre },
    },
  });

  revalidateRubrique(avant.type);
  if (avant.type !== parsed.data.type) revalidateRubrique(parsed.data.type);
  return { ok: true };
}

/**
 * Remplacer le fichier d'une pièce — le geste du renouvellement.
 *
 * L'ancien fichier n'est effacé du disque QU'APRÈS l'écriture du nouveau et la
 * mise à jour de la ligne : si la base échouait, on aurait sinon supprimé le
 * seul exemplaire d'une attestation encore référencée.
 *
 * Les dates suivent le fichier quand elles sont fournies — c'est le cas normal
 * d'un renouvellement — et restent inchangées sinon.
 */
export async function remplacerFichierSocieteDocAction(formData: FormData): Promise<ActionResult> {
  const guard = await requireRole(ADMIN_WRITE_ROLES);
  if (!guard.ok) return guard;

  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Identifiant invalide." };

  const dates = z.object({ dateEmission: dateChamp, dateExpiration: dateChamp }).safeParse({
    dateEmission: formData.get("dateEmission") ?? "",
    dateExpiration: formData.get("dateExpiration") ?? "",
  });
  if (!dates.success) return { ok: false, error: "Date invalide." };

  const existant = await prisma.societeDocument.findUnique({
    where: { id: id.data },
    select: { storagePath: true, type: true, hashSha256: true },
  });
  if (!existant) return { ok: false, error: "Pièce introuvable." };

  const fichier = await accepterFichier(formData.get("file"));
  if (!fichier.ok) return fichier;

  await prisma.societeDocument.update({
    where: { id: id.data },
    data: {
      fileName: sanitizeConsoleDocFileName(fichier.file.name),
      storagePath: fichier.storagePath,
      mimeType: fichier.file.type || "application/octet-stream",
      sizeBytes: fichier.file.size,
      hashSha256: fichier.hashSha256,
      ...(dates.data.dateEmission ? { dateEmission: dates.data.dateEmission } : {}),
      ...(dates.data.dateExpiration ? { dateExpiration: dates.data.dateExpiration } : {}),
    },
  });

  await deleteConsoleDocFile(existant.storagePath);

  await prisma.activityLog.create({
    data: {
      adminUserId: guard.userId,
      action: "societe.document.fichier.remplace",
      targetType: "SocieteDocument",
      targetId: id.data,
      changes: { hashAvant: existant.hashSha256, hashApres: fichier.hashSha256 },
    },
  });

  revalidateRubrique(existant.type);
  return { ok: true };
}

/** Supprimer une pièce (ligne + fichier). */
export async function supprimerSocieteDocAction(formData: FormData): Promise<ActionResult> {
  const guard = await requireRole(ADMIN_DELETE_ROLES);
  if (!guard.ok) return guard;

  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, error: "Identifiant invalide." };

  const doc = await prisma.societeDocument.findUnique({
    where: { id: id.data },
    select: { storagePath: true, type: true, titre: true },
  });
  if (!doc) return { ok: false, error: "Pièce introuvable." };

  await prisma.societeDocument.delete({ where: { id: id.data } });
  await deleteConsoleDocFile(doc.storagePath);

  await prisma.activityLog.create({
    data: {
      adminUserId: guard.userId,
      action: "societe.document.supprime",
      targetType: "SocieteDocument",
      targetId: id.data,
      changes: { type: doc.type, titre: doc.titre },
    },
  });

  revalidateRubrique(doc.type);
  return { ok: true };
}
