/**
 * Chantier QNC, lot L06 — Server Actions de l'émargement par demi-journée :
 * le RATTRAPAGE motivé et la FICHE DU JOUR J. Formulaires de la page
 * `sessions/[id]/emargement` ; aucune règle ici (`emargement/demi-journee/**`).
 *
 * Les deux n'agissent que si `qualiopi.emargement.actif` agit sur la session.
 * Le rattrapage déclare une présence au nom de l'organisme : il exige
 * l'habilitation `attester`. La fiche du jour exige l'écriture admin.
 */

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdminWrite, requireHabilitation } from "@/server/actions/qualiopi/_guards";
import { assertDossierOuvert } from "@/server/qualiopi/sessions/verrou-dossier-garde";
import { parisDateISO } from "@/server/qualiopi/presence/time";
import { emargementParDemiJourneePour } from "@/server/qualiopi/emargement/demi-journee/activation";
import {
  MESSAGE_REFUS_RATTRAPAGE,
  MOTIF_RATTRAPAGE_MAX,
  saisirRattrapage,
} from "@/server/qualiopi/emargement/demi-journee/rattrapage";
import {
  cocherFicheJour,
  type CaseFicheJour,
} from "@/server/qualiopi/emargement/demi-journee/fiche-jour";

const RETOUR = /^\/(fr|en)\/[A-Za-z0-9_-]+\/qualiopi\/sessions\/[0-9a-f-]{36}\/emargement$/;

function retourSur(fd: FormData): string {
  const v = fd.get("retour");
  return typeof v === "string" && RETOUR.test(v) ? v : "/";
}

function retour(base: string, cle: "ok" | "erreur", message: string): never {
  redirect(`${base}?${cle}=${encodeURIComponent(message)}#demi-journee`);
}

const rattrapageSchema = z.object({
  sessionId: z.string().uuid(),
  creneauId: z.string().uuid(),
  motif: z.string().max(MOTIF_RATTRAPAGE_MAX * 2),
});

export async function saisirRattrapageFormAction(formData: FormData): Promise<void> {
  const admin = await requireHabilitation("attester");
  const base = retourSur(formData);
  const parse = rattrapageSchema.safeParse({
    sessionId: formData.get("sessionId"),
    creneauId: formData.get("creneauId"),
    motif: formData.get("motif") ?? "",
  });
  if (!parse.success) retour(base, "erreur", "Choisissez une demi-journée et saisissez un motif.");
  const { sessionId, creneauId, motif } = parse.data;

  const verrou = await assertDossierOuvert(sessionId);
  if (!verrou.ok) retour(base, "erreur", verrou.error);

  // Le créneau doit appartenir à la session du formulaire.
  const appartient = await prisma.presenceCreneau.count({
    where: { id: creneauId, enrollment: { sessionId } },
  });
  if (appartient === 0) retour(base, "erreur", "Cette demi-journée n'appartient pas à la session.");

  const r = await saisirRattrapage({ creneauId, motif, adminUserId: admin.userId });
  if (!r.ok) retour(base, "erreur", MESSAGE_REFUS_RATTRAPAGE[r.raison]);
  revalidatePath(base);
  retour(base, "ok", "Rattrapage consigné. Il reste compté comme écart.");
}

const ficheSchema = z.object({
  sessionId: z.string().uuid(),
  rappelCadre: z.literal("oui").optional(),
  supportsRemis: z.literal("oui").optional(),
  canalSupports: z.enum(["papier", "espace", "email", "autre"]).default("papier"),
});

export async function cocherFicheJourFormAction(formData: FormData): Promise<void> {
  const admin = await requireAdminWrite();
  const base = retourSur(formData);
  const parse = ficheSchema.safeParse({
    sessionId: formData.get("sessionId"),
    rappelCadre: formData.get("rappelCadre") ?? undefined,
    supportsRemis: formData.get("supportsRemis") ?? undefined,
    canalSupports: formData.get("canalSupports") ?? undefined,
  });
  if (!parse.success) retour(base, "erreur", "Formulaire illisible.");
  const d = parse.data;

  const verrou = await assertDossierOuvert(d.sessionId);
  if (!verrou.ok) retour(base, "erreur", verrou.error);

  // Le jour J est celui du SERVEUR, en heure de Paris — jamais une date saisie.
  const jour = parisDateISO(new Date());
  const session = await prisma.trainingSession.findUnique({
    where: { id: d.sessionId },
    select: {
      estTestInterne: true,
      jours: { where: { date: new Date(`${jour}T00:00:00.000Z`) }, select: { id: true } },
    },
  });
  if (session === null) retour(base, "erreur", "Session introuvable.");
  if (!(await emargementParDemiJourneePour(session))) {
    retour(base, "erreur", "L'émargement par demi-journée n'est pas allumé pour cette session.");
  }
  if (session.jours.length === 0) {
    retour(base, "erreur", "Aujourd'hui n'est pas une journée déclarée de cette session.");
  }

  const cases: CaseFicheJour[] = [
    ...(d.rappelCadre === "oui" ? (["rappel_cadre"] as const) : []),
    ...(d.supportsRemis === "oui" ? (["supports_remis"] as const) : []),
  ];
  if (cases.length === 0) retour(base, "erreur", "Cochez au moins une case.");

  const ecrites = await cocherFicheJour({
    sessionId: d.sessionId,
    jour,
    cases,
    canalSupports: d.canalSupports,
    adminUserId: admin.userId,
  });
  revalidatePath(base);
  retour(
    base,
    "ok",
    ecrites === 0
      ? "Fiche du jour déjà consignée."
      : "Fiche du jour consignée pour chaque stagiaire.",
  );
}
