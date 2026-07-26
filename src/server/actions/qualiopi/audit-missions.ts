/**
 * Qualiopi — Server Actions des missions d'audit IA + acomptes.
 *
 * Les audits sont le troisième type de prestation (à côté des formations et des
 * coachings) : créables, affectables à un formateur, rémunérés par le run
 * mensuel. Les acomptes (montant + date + reçu + moyen texte libre) se posent
 * sur une formation OU un audit — suivi MANUEL, sans Stripe.
 *
 * Guards RBAC write + audit ActivityLog, comme les autres actions Qualiopi.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { formatDocumentNumber } from "@/server/qualiopi/numbering/formats";

type ActionResult<T> = { data: T } | { error: string };

const uuid = z.string().uuid();

/** `YYYY-MM-DD` → `Date` (minuit UTC), rejette une saisie non-date. */
const jour = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ")
  .transform((v) => new Date(`${v}T00:00:00Z`))
  .refine((d) => !Number.isNaN(d.getTime()), { message: "Date invalide" });

/* ──────────────────────────────────────────────────────────────────────────────
 * 1. Création d'un audit
 * ────────────────────────────────────────────────────────────────────────────── */

const createSchema = z
  .object({
    titre: z.string().min(1).max(300),
    clientId: uuid.optional(),
    dateDebut: jour,
    dateFin: jour,
    montantEuros: z.coerce.number().nonnegative(),
    dureeHeures: z.coerce.number().int().positive().optional(),
  })
  .refine((v) => v.dateFin >= v.dateDebut, {
    message: "La fin doit suivre le début.",
    path: ["dateFin"],
  });

/**
 * Crée une mission d'audit. Le numéro (`AXI-AUD-YYYY-NNNN`) est alloué sous
 * `pg_advisory_xact_lock` pour éviter deux numéros identiques sous charge — même
 * mécanique que la numérotation des factures.
 */
export async function createAuditMissionAction(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<{ id: string; numero: string }>> {
  const session = await requireAdminWrite();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const v = parsed.data;
  const year = v.dateDebut.getUTCFullYear();

  let created: { id: string; numero: string };
  try {
    created = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('audit_seq_${year}'))`);
      // 🔴 Vérification E2E 2026-07-26 — la borne HAUTE manquait : toute mission
      // datée d'une année future était comptée dans la séquence de l'année
      // courante, qui sautait donc des numéros. Fenêtre fermée, comme
      // `reclamations.ts`.
      const count = await tx.auditMission.count({
        where: {
          dateDebut: {
            gte: new Date(Date.UTC(year, 0, 1)),
            lt: new Date(Date.UTC(year + 1, 0, 1)),
          },
        },
      });
      const numero = formatDocumentNumber("audit", year, count + 1);
      const row = await tx.auditMission.create({
        data: {
          numero,
          titre: v.titre,
          clientId: v.clientId ?? null,
          dateDebut: v.dateDebut,
          dateFin: v.dateFin,
          dureeHeures: v.dureeHeures ?? null,
          montantHtCents: Math.round(v.montantEuros * 100),
        },
        select: { id: true, numero: true },
      });
      return row;
    });
  } catch {
    return { error: "Erreur lors de la création de l'audit." };
  }

  await logQualiopiActivity({
    action: "qualiopi.audit_mission.create",
    targetType: "AuditMission",
    targetId: created.id,
    changes: { numero: created.numero, titre: v.titre },
    session,
  });

  return { data: created };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 2. Affectation d'un formateur (changer / retirer)
 * ────────────────────────────────────────────────────────────────────────────── */

const assignSchema = z.object({
  id: uuid,
  // `null` (chaîne vide côté formulaire) = retirer le formateur.
  formateurId: uuid.nullable(),
});

/** Change ou retire le formateur d'un audit. `null` = retrait. */
export async function assignAuditFormateurAction(
  input: z.input<typeof assignSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  try {
    await prisma.auditMission.update({
      where: { id: v.id },
      data: { formateurId: v.formateurId },
    });
  } catch {
    return { error: "Audit ou formateur introuvable." };
  }

  await logQualiopiActivity({
    action: "qualiopi.audit_mission.assign_formateur",
    targetType: "AuditMission",
    targetId: v.id,
    changes: { formateurId: v.formateurId },
    session,
  });

  return { data: { id: v.id } };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 3. Statut de l'audit
 * ────────────────────────────────────────────────────────────────────────────── */

const STATUTS = ["planifiee", "en_cours", "realisee", "annulee", "reportee"] as const;

const statutSchema = z.object({ id: uuid, statut: z.enum(STATUTS) });

/** Change le statut d'un audit (planifiée → en cours → réalisée, etc.). */
export async function setAuditStatutAction(
  input: z.input<typeof statutSchema>,
): Promise<ActionResult<{ id: string; statut: string }>> {
  const session = await requireAdminWrite();
  const parsed = statutSchema.safeParse(input);
  if (!parsed.success) return { error: "Statut invalide" };
  const v = parsed.data;

  try {
    await prisma.auditMission.update({ where: { id: v.id }, data: { statut: v.statut } });
  } catch {
    return { error: "Audit introuvable." };
  }

  await logQualiopiActivity({
    action: "qualiopi.audit_mission.statut",
    targetType: "AuditMission",
    targetId: v.id,
    changes: { statut: v.statut },
    session,
  });

  return { data: { id: v.id, statut: v.statut } };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * 4. Acompte — sur une FORMATION ou un AUDIT (suivi manuel)
 * ────────────────────────────────────────────────────────────────────────────── */

const acompteSchema = z.object({
  // La prestation ciblée : une formation OU un audit.
  prestation: z.enum(["formation", "audit"]),
  id: uuid,
  montantEuros: z.coerce.number().nonnegative().optional(),
  dateVersement: jour.optional(),
  recu: z.coerce.boolean().optional(),
  moyen: z.string().max(60).optional(),
});

/**
 * Pose ou met à jour l'acompte d'une prestation. Le moyen de paiement est du
 * texte libre (chèque, virement, espèces…) — aucun lien avec un prestataire de
 * paiement : le suivi est manuel.
 */
export async function setAcompteAction(
  input: z.input<typeof acompteSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = acompteSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  const data = {
    acompteMontantCents: v.montantEuros !== undefined ? Math.round(v.montantEuros * 100) : null,
    acompteDateVersement: v.dateVersement ?? null,
    acompteRecu: v.recu === true,
    acompteMoyen: v.moyen !== undefined && v.moyen !== "" ? v.moyen : null,
  };

  try {
    if (v.prestation === "audit") {
      await prisma.auditMission.update({ where: { id: v.id }, data });
    } else {
      await prisma.trainingSession.update({ where: { id: v.id }, data });
    }
  } catch {
    return { error: "Prestation introuvable." };
  }

  await logQualiopiActivity({
    action: "qualiopi.acompte.set",
    targetType: v.prestation === "audit" ? "AuditMission" : "TrainingSession",
    targetId: v.id,
    changes: { recu: data.acompteRecu, montantCents: data.acompteMontantCents },
    session,
  });

  return { data: { id: v.id } };
}
