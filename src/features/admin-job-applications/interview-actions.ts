// Les entretiens d'un candidat — Server Actions.
//
// Cinq gestes : planifier, replanifier, marquer tenu, annuler, marquer absent.
// Plus un sixième qui n'en est pas un geste de saisie : rattacher un rendez-vous
// d'agenda déjà pris à la candidature dont il relève.
//
// 🛑 AUCUN ENREGISTREMENT. Le compte rendu est SAISI. Ce fichier ne parle à
// aucun service de captation, de transcription ni de résumé — et ne doit
// jamais le faire.

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";

import { consignerEvenement } from "./journal";

/**
 * Même garde que la réponse au candidat et que le journal : le prédicat de
 * LECTURE du dossier. Un entretien porte le nom de la personne, son compte
 * rendu et la décision qu'on prend sur elle.
 *
 * Voir le commentaire étendu de `reply-actions.ts` sur l'écart délibéré avec
 * `requireAdminWriteSession`, qui autorise un rôle incapable d'ouvrir le
 * dossier.
 */
async function requireEcritureEntretien(): Promise<{ userId: string; nom: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role ?? "reader";
  if (!peutOuvrirDossierCandidat(role)) throw new Error("forbidden");
  const nom = (session.user as { name?: string }).name ?? session.user.email ?? session.user.id;
  return { userId: session.user.id, nom };
}

export type EtatEntretien = { ok: true; id: string } | { ok: false; error: string };

const MODES = ["telephone", "visio", "sur_site"] as const;
const ISSUES = ["poursuivre", "second_tour", "proposition", "ecarter", "sans_suite"] as const;

const LIBELLE_MODE: Record<(typeof MODES)[number], string> = {
  telephone: "téléphone",
  visio: "visioconférence",
  sur_site: "sur site",
};

const schemaPlanifier = z.object({
  applicationId: z.string().uuid(),
  mode: z.enum(MODES),
  scheduledAt: z.coerce.date(),
  durationMin: z.coerce.number().int().min(5).max(480).optional(),
  location: z.string().max(500).optional(),
  round: z.coerce.number().int().min(1).max(9).default(1),
  /** Qui le mène. Vide = la personne connectée. */
  conductedByName: z.string().max(255).optional(),
});

/**
 * Planifie un entretien.
 *
 * 🔑 La date DOIT être dans le futur, et c'est le miroir exact de la règle du
 * journal : là-bas un fait ne peut pas être à venir, ici un rendez-vous ne peut
 * pas être passé. Consigner après coup un entretien déjà tenu est un autre
 * geste — `marquerEntretienTenuAction` avec sa propre date de tenue.
 */
export async function planifierEntretienAction(
  _prev: EtatEntretien,
  formData: FormData,
): Promise<EtatEntretien> {
  let acteur: { userId: string; nom: string };
  try {
    acteur = await requireEcritureEntretien();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unauthorized" };
  }

  const parsed = schemaPlanifier.safeParse({
    applicationId: formData.get("applicationId"),
    mode: formData.get("mode"),
    scheduledAt: formData.get("scheduledAt"),
    ...(formData.get("durationMin") ? { durationMin: formData.get("durationMin") } : {}),
    ...(formData.get("location") ? { location: formData.get("location") } : {}),
    ...(formData.get("round") ? { round: formData.get("round") } : {}),
    ...(formData.get("conductedByName")
      ? { conductedByName: formData.get("conductedByName") }
      : {}),
  });
  if (!parsed.success) return { ok: false, error: "champs_invalides" };
  const d = parsed.data;

  if (d.scheduledAt.getTime() <= Date.now()) {
    return { ok: false, error: "date_passee_pour_planification" };
  }

  const candidature = await prisma.jobApplication.findUnique({
    where: { id: d.applicationId },
    select: { id: true },
  });
  if (!candidature) return { ok: false, error: "candidature_introuvable" };

  const menePar = d.conductedByName?.trim() || acteur.nom;

  try {
    const id = await prisma.$transaction(async (tx) => {
      const entretien = await tx.jobInterview.create({
        data: {
          applicationId: d.applicationId,
          mode: d.mode,
          scheduledAt: d.scheduledAt,
          round: d.round,
          ...(d.durationMin ? { durationMin: d.durationMin } : {}),
          ...(d.location ? { location: d.location } : {}),
          conductedById: acteur.userId,
          conductedByName: menePar,
          state: "planifie",
        },
        select: { id: true },
      });

      await consignerEvenement(
        {
          applicationId: d.applicationId,
          type: "entretien_planifie",
          authorId: acteur.userId,
          authorName: acteur.nom,
          summary: `Entretien ${d.round > 1 ? `(tour ${d.round}) ` : ""}planifié — ${LIBELLE_MODE[d.mode]}`,
          body: d.location ?? null,
          interviewId: entretien.id,
          meta: { mode: d.mode, scheduledAt: d.scheduledAt.toISOString(), round: d.round },
        },
        tx,
      );

      return entretien.id;
    });

    revalidatePath(adminPath("fr", `contacts/candidatures/${d.applicationId}`));
    return { ok: true, id };
  } catch (e) {
    Sentry.captureException(e);
    return { ok: false, error: "db_failed" };
  }
}

const schemaTenu = z.object({
  interviewId: z.string().uuid(),
  heldAt: z.coerce.date().optional(),
  debrief: z.string().min(10).max(20_000),
  outcome: z.enum(ISSUES),
});

/**
 * Marque un entretien TENU — avec son compte rendu et son issue.
 *
 * 🔴 Les trois vont ensemble, et ce n'est pas une politesse : la contrainte
 * `job_interviews_etat_coherent_check` refuse la ligne autrement. On valide donc
 * ici pour rendre un message lisible, mais c'est Postgres qui garantit — une
 * validation applicative seule se contourne par la prochaine action écrite.
 *
 * Un entretien déjà tenu n'est PAS réécrit. Un compte rendu qui se corrige après
 * coup ne vaut plus rien : la correction passe par une note au journal, qui
 * porte sa date et son auteur.
 */
export async function marquerEntretienTenuAction(
  _prev: EtatEntretien,
  formData: FormData,
): Promise<EtatEntretien> {
  let acteur: { userId: string; nom: string };
  try {
    acteur = await requireEcritureEntretien();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unauthorized" };
  }

  const parsed = schemaTenu.safeParse({
    interviewId: formData.get("interviewId"),
    ...(formData.get("heldAt") ? { heldAt: formData.get("heldAt") } : {}),
    debrief: formData.get("debrief"),
    outcome: formData.get("outcome"),
  });
  if (!parsed.success) return { ok: false, error: "debrief_requis" };
  const d = parsed.data;

  const entretien = await prisma.jobInterview.findUnique({
    where: { id: d.interviewId },
    select: { id: true, applicationId: true, state: true, scheduledAt: true, round: true },
  });
  if (!entretien) return { ok: false, error: "entretien_introuvable" };
  if (entretien.state === "tenu") return { ok: false, error: "deja_tenu" };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.jobInterview.update({
        where: { id: d.interviewId },
        data: {
          state: "tenu",
          // Sans date fournie, on prend l'heure PRÉVUE et non « maintenant » :
          // un entretien débriefé le lendemain se lit à l'heure où il a eu lieu.
          heldAt: d.heldAt ?? entretien.scheduledAt,
          debrief: d.debrief.trim(),
          outcome: d.outcome,
        },
      });

      await consignerEvenement(
        {
          applicationId: entretien.applicationId,
          type: "entretien_tenu",
          authorId: acteur.userId,
          authorName: acteur.nom,
          occurredAt: d.heldAt ?? entretien.scheduledAt,
          summary: `Entretien ${entretien.round > 1 ? `(tour ${entretien.round}) ` : ""}tenu — issue : ${d.outcome.replace("_", " ")}`,
          body: d.debrief.trim(),
          interviewId: entretien.id,
          meta: { outcome: d.outcome, round: entretien.round },
        },
        tx,
      );
    });

    revalidatePath(adminPath("fr", `contacts/candidatures/${entretien.applicationId}`));
    return { ok: true, id: entretien.id };
  } catch (e) {
    Sentry.captureException(e);
    return { ok: false, error: "db_failed" };
  }
}

const schemaSansSuite = z.object({
  interviewId: z.string().uuid(),
  etat: z.enum(["annule", "absent"]),
  motif: z.string().max(2000).optional(),
});

/**
 * Annule un entretien, ou constate que le candidat ne s'est pas présenté.
 *
 * 🔑 Les deux états sont DISTINCTS et le restent. `annule` suppose un geste —
 * quelqu'un a décidé, d'un côté ou de l'autre. `absent` est un fait subi. Les
 * confondre ferait passer un rendez-vous manqué pour une annulation convenue,
 * et l'un se rappelle quand l'autre ne se rappelle pas.
 */
export async function cloreEntretienSansSuiteAction(
  _prev: EtatEntretien,
  formData: FormData,
): Promise<EtatEntretien> {
  let acteur: { userId: string; nom: string };
  try {
    acteur = await requireEcritureEntretien();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unauthorized" };
  }

  const parsed = schemaSansSuite.safeParse({
    interviewId: formData.get("interviewId"),
    etat: formData.get("etat"),
    ...(formData.get("motif") ? { motif: formData.get("motif") } : {}),
  });
  if (!parsed.success) return { ok: false, error: "champs_invalides" };
  const d = parsed.data;

  const entretien = await prisma.jobInterview.findUnique({
    where: { id: d.interviewId },
    select: { id: true, applicationId: true, state: true, round: true },
  });
  if (!entretien) return { ok: false, error: "entretien_introuvable" };
  if (entretien.state === "tenu") return { ok: false, error: "deja_tenu" };

  try {
    await prisma.$transaction(async (tx) => {
      // `heldAt` reste NULL : la contrainte l'exige, et c'est juste — il n'y a
      // pas eu d'entretien. Le fait qu'il n'ait pas eu lieu se lit dans l'état.
      await tx.jobInterview.update({
        where: { id: d.interviewId },
        data: { state: d.etat },
      });

      await consignerEvenement(
        {
          applicationId: entretien.applicationId,
          type: "entretien_sans_suite",
          authorId: acteur.userId,
          authorName: acteur.nom,
          summary:
            d.etat === "annule"
              ? `Entretien annulé${entretien.round > 1 ? ` (tour ${entretien.round})` : ""}`
              : `Entretien manqué — le candidat ne s'est pas présenté${entretien.round > 1 ? ` (tour ${entretien.round})` : ""}`,
          body: d.motif ?? null,
          interviewId: entretien.id,
          meta: { etat: d.etat },
        },
        tx,
      );
    });

    revalidatePath(adminPath("fr", `contacts/candidatures/${entretien.applicationId}`));
    return { ok: true, id: entretien.id };
  } catch (e) {
    Sentry.captureException(e);
    return { ok: false, error: "db_failed" };
  }
}
