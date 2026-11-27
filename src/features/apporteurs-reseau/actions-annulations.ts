"use server";

// Contrat 2.8, art. 3.2 : QUALIFIER un rendez-vous annulé (Axion IA ou l'entreprise) et lier un report.
// L'auteur n'est jamais déduit automatiquement (Calendly renvoie `canceler_type: host` quel que soit
// l'auteur) : seul un administrateur le pose, une seule fois (déclencheur en base).
// Aucun e-mail à l'apporteur.

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import type { EtatAction } from "./actions-presentations";

const ROLES = new Set(["super_admin", "admin"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLE_RENDEZ_VOUS = /^(calendly|rencontre):[A-Za-z0-9_-]{1,60}$/;
const MOTIF_MAX = 2000;

async function administrateur(): Promise<{ id: string } | { erreur: EtatAction }> {
  const session = await auth();
  if (!session?.user?.id)
    return { erreur: { etat: "erreur", message: "Session expirée : reconnectez-vous." } };
  const role = (session.user as { role?: string }).role ?? "";
  if (!ROLES.has(role))
    return { erreur: { etat: "erreur", message: "Réservé aux administrateurs." } };
  return { id: session.user.id };
}

function texte(fd: FormData, nom: string): string {
  const v = fd.get(nom);
  return typeof v === "string" ? v.trim() : "";
}

function idValide(fd: FormData): string | null {
  const id = texte(fd, "id").toLowerCase();
  return UUID.test(id) ? id : null;
}

const PAGE = () => adminPath("fr", "apporteurs/entreprises/annulations");

/** « Annulé par Axion IA » ou « Annulé ou manqué par l'entreprise » (motif obligatoire pour l'entreprise). */
export async function qualifierAnnulationAction(
  _prev: EtatAction,
  fd: FormData,
): Promise<EtatAction> {
  const admin = await administrateur();
  if ("erreur" in admin) return admin.erreur;
  const id = idValide(fd);
  if (!id) return { etat: "erreur", message: "Identifiant invalide." };
  const auteur = texte(fd, "auteur");
  if (auteur !== "axion" && auteur !== "entreprise")
    return { etat: "erreur", message: "Choisissez qui a annulé le rendez-vous." };
  const motif = texte(fd, "motif").slice(0, MOTIF_MAX);
  if (auteur === "entreprise" && !motif)
    return { etat: "erreur", message: "Le motif est obligatoire quand l'entreprise a annulé." };
  try {
    const maintenant = new Date();
    const r = await prisma.annulationRendezVousPresentation.updateMany({
      where: { id, auteur: null },
      data: {
        auteur,
        qualifieeAt: maintenant,
        qualifieePar: admin.id,
        motif: motif || null,
      },
    });
    if (r.count !== 1)
      return { etat: "erreur", message: "Cette annulation est déjà qualifiée ou introuvable." };
    await prisma.activityLog.create({
      data: {
        adminUserId: admin.id,
        action: "presentation.annulation_rendez_vous_qualifiee",
        targetType: "annulation_rendez_vous_presentation",
        targetId: id,
        changes: { auteur },
      },
    });
    revalidatePath(PAGE());
    return { etat: "ok", message: "Annulation qualifiée." };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "qualifier-annulation-rdv" } });
    return { etat: "erreur", message: "L'enregistrement a échoué. Réessayez dans un instant." };
  }
}

/**
 * « Lier le report » : la clé doit être un rendez-vous connu de la MÊME présentation (proposition ou
 * ligne de réservation). La date de prise est conservée : le report conserve la date de prise.
 */
export async function lierReportAction(_prev: EtatAction, fd: FormData): Promise<EtatAction> {
  const admin = await administrateur();
  if ("erreur" in admin) return admin.erreur;
  const id = idValide(fd);
  if (!id) return { etat: "erreur", message: "Identifiant invalide." };
  const reportCle = texte(fd, "reportCle");
  if (!CLE_RENDEZ_VOUS.test(reportCle))
    return { etat: "erreur", message: "Rendez-vous de report invalide." };
  try {
    const ligne = await prisma.annulationRendezVousPresentation.findUnique({
      where: { id },
      select: { presentationId: true, rendezVousCle: true, auteur: true },
    });
    if (!ligne) return { etat: "erreur", message: "Annulation introuvable." };
    if (ligne.auteur !== "entreprise")
      return {
        etat: "erreur",
        message: "Un report ne se lie que pour une annulation de l'entreprise.",
      };
    if (reportCle === ligne.rendezVousCle)
      return { etat: "erreur", message: "Le report doit être un autre rendez-vous." };
    const [proposition, reservation] = await Promise.all([
      prisma.propositionRendezVousPresentation.findFirst({
        where: { presentationId: ligne.presentationId, rendezVousCle: reportCle },
        select: { id: true },
      }),
      prisma.presentationReservation.findFirst({
        where: { presentationId: ligne.presentationId, rendezVousCle: reportCle },
        select: { presentationId: true },
      }),
    ]);
    if (!proposition && !reservation)
      return {
        etat: "erreur",
        message: "Ce rendez-vous n'est pas connu pour cette présentation.",
      };
    const r = await prisma.annulationRendezVousPresentation.updateMany({
      where: { id, auteur: "entreprise" },
      data: { reportCle, reportLieAt: new Date() },
    });
    if (r.count !== 1) return { etat: "erreur", message: "Annulation introuvable." };
    await prisma.activityLog.create({
      data: {
        adminUserId: admin.id,
        action: "presentation.annulation_rendez_vous_report_lie",
        targetType: "annulation_rendez_vous_presentation",
        targetId: id,
        changes: { reportCle },
      },
    });
    revalidatePath(PAGE());
    return { etat: "ok", message: "Report lié." };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "lier-report-rdv" } });
    return { etat: "erreur", message: "L'enregistrement a échoué. Réessayez dans un instant." };
  }
}
