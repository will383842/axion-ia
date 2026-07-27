/**
 * Qualiopi — Server Actions Réclamations (T12).
 *
 * creerReclamationAction     : enregistre une nouvelle réclamation (numéro AXI-REC-YYYY-NNN).
 * repondreReclamationAction  : traite la réclamation, passe en_cours si nouvelle.
 * setStatutReclamationAction : fait avancer le workflow off.31.
 *
 * Pattern : Prisma direct (même module) + délégation numérotation au service.
 * Statut initial explicite "nouvelle" (off.31). findUnique préalable pour les
 * mutations (évite les erreurs opaques, retour d'erreur métier précis).
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { nextNumero } from "@/server/qualiopi/numbering/allocate";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const SOURCES = ["stagiaire", "client", "financeur", "autre"] as const;
const STATUTS = ["nouvelle", "en_cours", "resolue", "cloturee"] as const;

const creerReclamationSchema = z.object({
  source: z.enum(SOURCES),
  reclamantNom: z.string().min(1).max(200),
  reclamantEmail: z.string().email().max(255).optional(),
  objet: z.string().min(1).max(300),
  description: z.string().min(1),
  gravite: z.string().max(20).optional(),
  dateReception: z.coerce.date(),
  enrollmentId: z.string().uuid().optional(),
  traiteeParId: z.string().uuid().optional(),
});

const repondreReclamationSchema = z.object({
  id: z.string().uuid(),
  reponse: z.string().min(1),
  actionsCorrectives: z.string().optional(),
});

const setStatutReclamationSchema = z.object({
  id: z.string().uuid(),
  statut: z.enum(STATUTS),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RETRY = 5;

async function allocuerNumero(annee: number, tentative = 1): Promise<string> {
  if (tentative > MAX_RETRY) {
    throw new Error("Impossible d'allouer un numéro unique après " + MAX_RETRY + " tentatives");
  }
  // 🔴 V20 — duplicat EXACT de `registres/reclamations-service.ts` : deux
  // chemins d'écriture concurrents sur la MÊME série `AXI-REC`. Tant que la
  // déduplication n'est pas faite (chantier séparé), les deux DOIVENT lire le
  // compteur de la même façon, sinon ils divergent au premier trou.
  // `tentative` ne décale plus le numéro : la borne haute progresse seule.
  return nextNumero("reclamation", annee, (prefixe) =>
    prisma.reclamation.findMany({
      where: { numero: { startsWith: prefixe } },
      select: { numero: true },
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// creerReclamationAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enregistre une nouvelle réclamation avec numéro AXI-REC-YYYY-NNN.
 * Statut initial explicite : "nouvelle".
 */
export async function creerReclamationAction(input: {
  source: (typeof SOURCES)[number];
  reclamantNom: string;
  reclamantEmail?: string;
  objet: string;
  description: string;
  gravite?: string;
  dateReception: Date;
  enrollmentId?: string;
  traiteeParId?: string;
}): Promise<ActionResult<{ id: string; numero: string }>> {
  const session = await requireAdminWrite();
  const parsed = creerReclamationSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  const annee = v.dateReception.getFullYear();

  async function tentative(n: number): Promise<ActionResult<{ id: string; numero: string }>> {
    const numero = await allocuerNumero(annee, n);
    let reclamation: { id: string; numero: string };
    try {
      reclamation = await prisma.reclamation.create({
        data: {
          numero,
          source: v.source,
          reclamantNom: v.reclamantNom,
          ...(v.reclamantEmail !== undefined ? { reclamantEmail: v.reclamantEmail } : {}),
          objet: v.objet,
          description: v.description,
          ...(v.gravite !== undefined ? { gravite: v.gravite } : {}),
          statut: "nouvelle",
          dateReception: v.dateReception,
          ...(v.enrollmentId !== undefined ? { enrollmentId: v.enrollmentId } : {}),
          ...(v.traiteeParId !== undefined ? { traiteeParId: v.traiteeParId } : {}),
        },
      });
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002" &&
        n < MAX_RETRY
      ) {
        return tentative(n + 1);
      }
      return { error: "Erreur lors de l'enregistrement de la réclamation" };
    }

    await logQualiopiActivity({
      action: "qualiopi.reclamation.create",
      targetType: "Reclamation",
      targetId: reclamation.id,
      changes: { numero: reclamation.numero, source: v.source, objet: v.objet },
      session,
    });

    return { data: { id: reclamation.id, numero: reclamation.numero } };
  }

  return tentative(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// repondreReclamationAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Traite une réclamation : enregistre la réponse.
 * Si statut "nouvelle" → passe à "en_cours".
 * Si déjà "en_cours" ou autre statut → ne change pas le statut.
 */
export async function repondreReclamationAction(input: {
  id: string;
  reponse: string;
  actionsCorrectives?: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = repondreReclamationSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  const reclamation = await prisma.reclamation.findUnique({ where: { id: v.id } });
  if (reclamation === null) return { error: "Réclamation introuvable" };

  const nouvelleStatut = reclamation.statut === "nouvelle" ? "en_cours" : undefined;

  await prisma.reclamation.update({
    where: { id: v.id },
    data: {
      reponse: v.reponse,
      ...(v.actionsCorrectives !== undefined ? { actionsCorrectives: v.actionsCorrectives } : {}),
      dateReponse: new Date(),
      ...(nouvelleStatut !== undefined ? { statut: nouvelleStatut } : {}),
    },
  });

  await logQualiopiActivity({
    action: "qualiopi.reclamation.repondre",
    targetType: "Reclamation",
    targetId: v.id,
    changes: { repondu: true, statut: nouvelleStatut },
    session,
  });

  return { data: { id: v.id } };
}

// ─────────────────────────────────────────────────────────────────────────────
// setStatutReclamationAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Change le statut d'une réclamation (workflow off.31).
 * Vérifie l'existence préalablement pour retourner un message précis.
 */
export async function setStatutReclamationAction(input: {
  id: string;
  statut: (typeof STATUTS)[number];
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = setStatutReclamationSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { id, statut } = parsed.data;

  const reclamation = await prisma.reclamation.findUnique({ where: { id } });
  if (reclamation === null) return { error: "Réclamation introuvable" };

  await prisma.reclamation.update({
    where: { id },
    data: { statut },
  });

  await logQualiopiActivity({
    action: `qualiopi.reclamation.statut.${statut}`,
    targetType: "Reclamation",
    targetId: id,
    changes: { statut },
    session,
  });

  return { data: { id } };
}
