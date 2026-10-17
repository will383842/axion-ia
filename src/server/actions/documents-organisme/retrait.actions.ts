// CHANTIER QNC, LOT L13 — RETIRER un document de l'organisme (rubrique Société,
// hub Documents), SANS l'effacer.
//
// Le retrait masque le document des listes ; la ligne et le fichier restent.
// Il s'inscrit dans `effacements_journal` (ajout seul, trigger), est réservé
// au super-administrateur et porte un motif d'au moins dix caractères.
//
// 🔴 GARDE-FOU : `effacements_journal` ne connaît pas encore ces tables (ses
// énumérations n'ont ni `societe_documents`, ni `console_documents`, ni le
// motif `retrait_document_organisme` — besoin de schéma n° 2 de la PR). On le
// demande à la base À CHAQUE appel : tant que les valeurs manquent, le retrait
// est REFUSÉ et rien n'est écrit. Fermé par défaut.

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { journaliser } from "@/server/journal/journaliser";
import {
  archivageDocumentsOrganismeActif,
  lireDocumentsRetires,
  retraitDocumentDisponible,
} from "@/server/qualiopi/documents-organisme/documents-organisme";
import {
  ACTION_DOCUMENT_RETIRE,
  CIBLE_EFFACEMENT_ATTENDUE,
  CIBLES_DOCUMENT_ORGANISME,
  LONGUEUR_MAX_TEXTE,
  LONGUEUR_MIN_TEXTE,
  MOTIF_EFFACEMENT_ATTENDU,
} from "@/server/qualiopi/documents-organisme/documents-organisme-pur";

type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  cible: z.enum(CIBLES_DOCUMENT_ORGANISME),
  id: z.string().uuid(),
  motif: z.string().trim().min(LONGUEUR_MIN_TEXTE).max(LONGUEUR_MAX_TEXTE),
});

class Introuvable extends Error {}
class DejaRetire extends Error {}

export async function retirerDocumentOrganismeAction(raw: {
  cible: string;
  id: string;
  motif: string;
}): Promise<ActionResult> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return { ok: false, error: "Non authentifié." };
  if (user.role !== "super_admin") {
    return { ok: false, error: "Le retrait est réservé au super-administrateur." };
  }
  const userId = user.id;

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Paramètres invalides (motif de ${LONGUEUR_MIN_TEXTE} caractères au moins).`,
    };
  }
  const { cible, id, motif } = parsed.data;

  if (!(await archivageDocumentsOrganismeActif())) {
    return { ok: false, error: "Le retrait n'est pas ouvert sur cette console." };
  }
  if (!(await retraitDocumentDisponible(cible))) {
    return {
      ok: false,
      error:
        "Retrait indisponible : le journal des effacements ne connaît pas encore les documents de l'organisme. Rien n'a été retiré.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`qualiopi.documents_organisme:${cible}:${id}`}))`;
      const existe =
        cible === "SocieteDocument"
          ? await tx.societeDocument.findUnique({ where: { id }, select: { id: true } })
          : await tx.consoleDocument.findUnique({ where: { id }, select: { id: true } });
      if (!existe) throw new Introuvable();
      if ((await lireDocumentsRetires(cible, tx)).has(id)) throw new DejaRetire();
      const auteur = await tx.adminUser.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      // Casts en TEXTE → énumération : valeurs vérifiées présentes ci-dessus.
      await tx.$executeRaw`
        INSERT INTO effacements_journal (id, table_cible, ligne_id, motif)
        VALUES (gen_random_uuid(), ${CIBLE_EFFACEMENT_ATTENDUE[cible]}::cible_effacement,
                ${id}, ${MOTIF_EFFACEMENT_ATTENDU}::motif_effacement)`;
      await journaliser(
        tx,
        {
          action: ACTION_DOCUMENT_RETIRE,
          targetType: cible,
          targetId: id,
          changes: { motif, auteurNom: auteur?.name ?? null },
          session: { userId },
        },
        { exiger: true },
      );
    });
  } catch (e) {
    if (e instanceof Introuvable) return { ok: false, error: "Document introuvable." };
    if (e instanceof DejaRetire) return { ok: false, error: "Ce document est déjà retiré." };
    throw e;
  }
  // ⚠️ Ni `delete`, ni `deleteConsoleDocFile` : un retrait n'efface rien.

  revalidatePath(adminPath("fr", "societe"), "layout");
  revalidatePath(adminPath("fr", "documents-interventions"), "layout");
  return { ok: true };
}
