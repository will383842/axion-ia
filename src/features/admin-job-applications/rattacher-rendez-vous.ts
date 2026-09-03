// Rattacher un rendez-vous d'agenda à une candidature — Server Action.
//
// Constat `T2bis` de l'audit : `calendly_events` savait pointer une demande
// commerciale (`linkedSubmissionId`) et rien d'autre. Un rendez-vous pris par un
// candidat ne rejoignait donc aucun dossier, alors qu'il portait déjà sa date,
// son lieu, son lien de visioconférence et son état.

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";

import { consignerEvenement } from "./journal";
import { modeDepuisLieu } from "@/lib/careers/mode-entretien";

async function requireEcriture(): Promise<{ userId: string; nom: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role ?? "reader";
  if (!peutOuvrirDossierCandidat(role)) throw new Error("forbidden");
  const nom = (session.user as { name?: string }).name ?? session.user.email ?? session.user.id;
  return { userId: session.user.id, nom };
}

export type EtatRattachement =
  { ok: true; interviewId: string | null } | { ok: false; error: string };

export const LIBELLES_ERREUR_RATTACHEMENT: Record<string, string> = {
  unauthorized: "Session expirée — reconnectez-vous.",
  forbidden: "Vous n'avez pas accès aux dossiers de candidature.",
  champs_invalides: "Champs invalides.",
  rendez_vous_introuvable: "Rendez-vous introuvable.",
  candidature_introuvable: "Candidature introuvable.",
  deja_rattache_ailleurs: "Ce rendez-vous est déjà rattaché à une autre candidature.",
  sans_horaire:
    "Ce rendez-vous n'a pas d'horaire connu — complétez-le avant d'en faire un entretien.",
  db_failed: "Échec d'enregistrement.",
};

const schema = z.object({
  calendlyEventId: z.string().min(1).max(64),
  applicationId: z.string().uuid(),
  /**
   * Créer l'entretien correspondant, pré-rempli depuis le rendez-vous.
   *
   * Facultatif à dessein : tous les rendez-vous d'un candidat ne sont pas des
   * entretiens. Un rappel de dossier, un point logistique, un appel de
   * courtoisie se rattachent utilement à la candidature sans mériter une ligne
   * dans la suite des tours.
   */
  creerEntretien: z.coerce.boolean().default(false),
});

/**
 * Rattache un rendez-vous d'agenda à une candidature, et — au choix — en fait un
 * entretien pré-rempli.
 *
 * ## Idempotence
 *
 * 🔑 `JobInterview.calendlyEventId` est `@unique`. Cliquer deux fois ne crée pas
 * deux entretiens : le second passage voit l'existant et le rend. C'est ce qui
 * rend le geste sûr sur un écran où le bouton peut être pressé pendant que la
 * page se recharge.
 *
 * ## Ce qu'on refuse
 *
 * Un rendez-vous déjà rattaché à une AUTRE candidature. Le déplacer
 * silencieusement ferait disparaître une ligne de l'historique d'un dossier
 * sans que personne ne l'ait demandé — et le journal du premier dossier
 * continuerait d'affirmer un rendez-vous qu'il ne porte plus.
 */
export async function rattacherRendezVousAction(
  _prev: EtatRattachement,
  formData: FormData,
): Promise<EtatRattachement> {
  let acteur: { userId: string; nom: string };
  try {
    acteur = await requireEcriture();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unauthorized" };
  }

  const parsed = schema.safeParse({
    calendlyEventId: formData.get("calendlyEventId"),
    applicationId: formData.get("applicationId"),
    creerEntretien:
      formData.get("creerEntretien") === "true" || formData.get("creerEntretien") === "on",
  });
  if (!parsed.success) return { ok: false, error: "champs_invalides" };
  const d = parsed.data;

  const [rdv, candidature] = await Promise.all([
    prisma.calendlyEvent.findUnique({
      where: { id: d.calendlyEventId },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        location: true,
        eventTypeName: true,
        linkedJobApplicationId: true,
      },
    }),
    prisma.jobApplication.findUnique({
      where: { id: d.applicationId },
      select: { id: true },
    }),
  ]);
  if (!rdv) return { ok: false, error: "rendez_vous_introuvable" };
  if (!candidature) return { ok: false, error: "candidature_introuvable" };
  if (rdv.linkedJobApplicationId && rdv.linkedJobApplicationId !== d.applicationId) {
    return { ok: false, error: "deja_rattache_ailleurs" };
  }

  // Un entretien sans horaire ne peut pas exister : `scheduledAt` est NOT NULL,
  // et la passe de rappels s'appuie dessus. L'Embed JS ne transmet pas toujours
  // l'horaire — c'est une limitation documentée de Calendly, pas un défaut d'ici.
  if (d.creerEntretien && rdv.startTime === null) {
    return { ok: false, error: "sans_horaire" };
  }

  /** Durée déduite des deux bornes, quand elles sont connues. */
  const dureeMin =
    rdv.startTime && rdv.endTime
      ? Math.max(5, Math.round((rdv.endTime.getTime() - rdv.startTime.getTime()) / 60_000))
      : null;

  // Le mode se DÉDUIT du lieu. La règle vit dans `lib/careers/mode-entretien`,
  // pure et éprouvée sur ses cas limites — dont celui qui compte : une adresse
  // qui CONTIENT une URL reste un rendez-vous sur site.
  const lieu = rdv.location ?? "";
  const mode = modeDepuisLieu(lieu);

  try {
    const interviewId = await prisma.$transaction(async (tx) => {
      await tx.calendlyEvent.update({
        where: { id: rdv.id },
        data: { linkedJobApplicationId: d.applicationId },
      });

      if (!d.creerEntretien) return null;

      // Idempotent : si cet événement fonde déjà un entretien, on le rend.
      const existant = await tx.jobInterview.findUnique({
        where: { calendlyEventId: rdv.id },
        select: { id: true },
      });
      if (existant) return existant.id;

      const tours = await tx.jobInterview.count({ where: { applicationId: d.applicationId } });

      const entretien = await tx.jobInterview.create({
        data: {
          applicationId: d.applicationId,
          mode,
          scheduledAt: rdv.startTime!,
          ...(dureeMin ? { durationMin: dureeMin } : {}),
          ...(lieu ? { location: lieu } : {}),
          round: tours + 1,
          conductedById: acteur.userId,
          conductedByName: acteur.nom,
          state: "planifie",
          calendlyEventId: rdv.id,
        },
        select: { id: true },
      });

      await consignerEvenement(
        {
          applicationId: d.applicationId,
          type: "entretien_planifie",
          authorId: acteur.userId,
          authorName: acteur.nom,
          summary: `Rendez-vous « ${rdv.eventTypeName} » rattaché — entretien créé`,
          body: lieu || null,
          interviewId: entretien.id,
          meta: { calendlyEventId: rdv.id, mode, round: tours + 1 },
        },
        tx,
      );

      return entretien.id;
    });

    revalidatePath(adminPath("fr", `contacts/candidatures/${d.applicationId}`));
    revalidatePath(adminPath("fr", `contacts/appels/${rdv.id}`));
    return { ok: true, interviewId };
  } catch (e) {
    Sentry.captureException(e);
    return { ok: false, error: "db_failed" };
  }
}
