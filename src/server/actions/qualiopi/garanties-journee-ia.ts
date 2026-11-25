/**
 * Qualiopi — Server Actions du suivi des remboursements de la garantie Journée IA (CGV art. 47.10).
 *
 * Règle retenue : « variante brief » (demande écrite sous 30 j après le rapport ; réponse sous 15 j,
 * sinon réputée acceptée ; virement sous 30 j après l'acceptation). Demande reçue après les 30 jours : jamais d'acceptation
 * tacite, le dirigeant choisit (rembourser : virement sous 30 j après la décision ; refuser ; offrir
 * un avoir ≤ 4 470 € HT). Les échéances se CALCULENT
 * (`calculerEcheances`) : on n'écrit que des dates saisies par un humain. « Réputée acceptée » n'est
 * jamais écrite par un robot.
 *
 * Gardes : saisie de dates et archivage = `requireAdminWrite` ; décision et virement (argent) =
 * `requireHabilitation("facturer")`. Chaque écriture et sa trace `ActivityLog` partagent la même
 * transaction : sans trace, pas d'acte. Aucune suppression : on archive.
 */

"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import {
  donneesJournalQualiopi,
  requireAdminWrite,
  requireHabilitation,
} from "@/server/actions/qualiopi/_guards";
import { aujourdhuiParis, jourIso } from "@/lib/garantie-journee-ia/presentation";
import {
  DECISIONS,
  eurosEnCentimes,
  refusDecision,
  refusDemande,
  refusVirement,
  verifierMontantAvoir,
} from "@/server/garanties-journee-ia/regles";
import { dossiersDejaRembourses, lireGarantie } from "@/server/garanties-journee-ia/lecture";

const SOUS_CHEMIN = "garanties-journee-ia";
const uuid = z.string().uuid();
const jour = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function liste(): string {
  return adminPath("fr", SOUS_CHEMIN);
}
function fiche(id: string): string {
  return adminPath("fr", `${SOUS_CHEMIN}/${id}`);
}
/** Redirige vers `chemin` avec le message d'erreur (jamais de redirection vers une valeur du formulaire). */
function refuser(chemin: string, message: string): never {
  redirect(`${chemin}?erreur=${encodeURIComponent(message)}`);
}
function texte(f: FormData, nom: string): string {
  const v = f.get(nom);
  return typeof v === "string" ? v.trim() : "";
}
/** Date facultative : "" → null ; invalide → undefined. */
function jourFacultatif(f: FormData, nom: string): string | null | undefined {
  const t = texte(f, nom);
  if (!t) return null;
  const ok = jour.safeParse(t).success && !Number.isNaN(Date.parse(`${t}T00:00:00Z`));
  return ok ? t : undefined;
}
const enDate = (iso: string | null): Date | null => (iso ? new Date(`${iso}T00:00:00Z`) : null);

/* ── 1. Création ─────────────────────────────────────────────────────────────── */

/**
 * Crée un dossier. Si `auditMissionId` est fourni, client, date de la journée, prix et devis sont
 * repris de la mission (prérempli, jamais écrasé par une saisie vide).
 */
export async function creerGarantieJourneeIaAction(formData: FormData): Promise<void> {
  const session = await requireAdminWrite();
  const chemin = adminPath("fr", `${SOUS_CHEMIN}/nouveau`);

  const missionId = texte(formData, "auditMissionId");
  if (missionId && !uuid.safeParse(missionId).success) refuser(chemin, "Mission d'audit invalide.");
  const mission = missionId
    ? await prisma.auditMission.findUnique({
        where: { id: missionId },
        select: { clientId: true, dateDebut: true, montantHtCents: true, devisId: true },
      })
    : null;
  if (missionId && !mission) refuser(chemin, "Mission d'audit introuvable.");

  const clientId = texte(formData, "clientId") || mission?.clientId || "";
  if (!uuid.safeParse(clientId).success) refuser(chemin, "Client obligatoire.");
  const dateJournee = texte(formData, "dateJournee") || jourIso(mission?.dateDebut) || "";
  if (!jour.safeParse(dateJournee).success) refuser(chemin, "Date de la journée obligatoire.");
  const prix = texte(formData, "prixHtEuros")
    ? eurosEnCentimes(texte(formData, "prixHtEuros"))
    : (mission?.montantHtCents ?? null);
  const seuil = eurosEnCentimes(texte(formData, "seuilHtEuros"));
  if (prix === null || prix <= 0) refuser(chemin, "Prix HT invalide.");
  if (seuil === null || seuil <= 0) refuser(chemin, "Seuil HT invalide.");
  const devisId = texte(formData, "devisId") || mission?.devisId || null;
  if (devisId && !uuid.safeParse(devisId).success) refuser(chemin, "Devis invalide.");

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, siren: true },
  });
  if (!client) refuser(chemin, "Client introuvable.");
  if (
    missionId &&
    (await prisma.garantieJourneeIa.findUnique({
      where: { auditMissionId: missionId },
      select: { id: true },
    }))
  ) {
    refuser(chemin, "Cette mission a déjà un dossier de garantie.");
  }

  const doublons = await dossiersDejaRembourses(client.siren);
  const id = await prisma.$transaction(async (tx) => {
    const cree = await tx.garantieJourneeIa.create({
      data: {
        clientId,
        devisId,
        auditMissionId: missionId || null,
        sirenSnapshot: client.siren,
        prixHtCents: prix as number,
        seuilHtCents: seuil as number,
        dateJournee: enDate(dateJournee) as Date,
        notes: texte(formData, "notes") || null,
        creePar: session.userId,
      },
      select: { id: true },
    });
    await tx.activityLog.create({
      data: await donneesJournalQualiopi({
        action: "qualiopi.garantie_journee_ia.create",
        targetType: "GarantieJourneeIa",
        targetId: cree.id,
        changes: {
          clientId,
          dateJournee,
          prixHtCents: prix,
          seuilHtCents: seuil,
          auditMissionId: missionId || null,
        },
        session,
      }),
    });
    return cree.id;
  });
  revalidatePath(liste());
  redirect(`${fiche(id)}${doublons.length > 0 ? "?avertissement=siren" : ""}`);
}

/* ── 2. Dates saisies (rapport, demande) et notes ────────────────────────────── */

export async function enregistrerDatesGarantieJourneeIaAction(formData: FormData): Promise<void> {
  const session = await requireAdminWrite();
  const id = texte(formData, "id");
  if (!uuid.safeParse(id).success) refuser(liste(), "Dossier invalide.");
  const dossier = await lireGarantie(id);
  if (!dossier) refuser(liste(), "Dossier introuvable.");
  if (dossier.archiveLe) refuser(fiche(id), "Dossier archivé : le désarchiver d'abord.");

  const rapport = jourFacultatif(formData, "rapportRemisLe");
  const demande = jourFacultatif(formData, "demandeRecueLe");
  if (rapport === undefined || demande === undefined) refuser(fiche(id), "Date invalide.");
  const apres = { ...dossier, rapportRemisLe: rapport, demandeRecueLe: demande };
  if (dossier.virementLe && demande !== dossier.demandeRecueLe) {
    refuser(fiche(id), "Le virement est saisi : la date de la demande ne peut plus changer.");
  }
  const refus = refusDemande(apres, demande);
  if (refus) refuser(fiche(id), refus);
  if (!rapport && demande) refuser(fiche(id), "Saisir d'abord la date de remise du rapport.");

  await prisma.$transaction(async (tx) => {
    await tx.garantieJourneeIa.update({
      where: { id },
      data: {
        rapportRemisLe: enDate(rapport),
        demandeRecueLe: enDate(demande),
        notes: texte(formData, "notes") || null,
      },
    });
    await tx.activityLog.create({
      data: await donneesJournalQualiopi({
        action: "qualiopi.garantie_journee_ia.dates",
        targetType: "GarantieJourneeIa",
        targetId: id,
        changes: {
          rapportRemisLe: { avant: dossier.rapportRemisLe, apres: rapport },
          demandeRecueLe: { avant: dossier.demandeRecueLe, apres: demande },
        },
        session,
      }),
    });
  });
  revalidatePath(liste());
  redirect(`${fiche(id)}?ok=dates`);
}

/* ── 3. Décision (argent) ────────────────────────────────────────────────────── */

const schemaDecision = z.object({
  id: uuid,
  decision: z.enum(DECISIONS),
  decisionLe: jour,
});

export async function enregistrerDecisionGarantieJourneeIaAction(
  formData: FormData,
): Promise<void> {
  const session = await requireHabilitation("facturer");
  const p = schemaDecision.safeParse({
    id: texte(formData, "id"),
    decision: texte(formData, "decision"),
    decisionLe: texte(formData, "decisionLe"),
  });
  if (!p.success) refuser(liste(), "Décision ou date invalide.");
  const { id, decision, decisionLe } = p.data;
  const dossier = await lireGarantie(id);
  if (!dossier) refuser(liste(), "Dossier introuvable.");
  if (dossier.archiveLe) refuser(fiche(id), "Dossier archivé : le désarchiver d'abord.");

  const motif = texte(formData, "motifDecision") || null;
  const refus = refusDecision(dossier, { decision, decisionLe, motif });
  if (refus) refuser(fiche(id), refus);

  let montant: number | null = null;
  if (decision === "remboursement") {
    montant = eurosEnCentimes(texte(formData, "montantRembourseEuros"));
    if (montant === null || montant <= 0) refuser(fiche(id), "Montant remboursé invalide.");
    if (montant > dossier.prixHtCents * 2)
      refuser(fiche(id), "Montant remboursé incohérent avec le prix.");
  }
  let montantAvoir: number | null = null;
  if (decision === "avoir") {
    const v = verifierMontantAvoir(eurosEnCentimes(texte(formData, "montantAvoirEuros")));
    if (!v.ok) refuser(fiche(id), v.message);
    montantAvoir = v.cents;
  }
  const total = texte(formData, "totalGainsEuros")
    ? eurosEnCentimes(texte(formData, "totalGainsEuros"))
    : null;
  if (texte(formData, "totalGainsEuros") && total === null)
    refuser(fiche(id), "Total des gains invalide.");
  const avoirEmisLe = jourFacultatif(formData, "avoirEmisLe");
  if (avoirEmisLe === undefined) refuser(fiche(id), "Date d'avoir invalide.");
  const avoirId = texte(formData, "avoirId") || null;
  if (avoirId && !uuid.safeParse(avoirId).success)
    refuser(fiche(id), "Identifiant d'avoir invalide.");

  await prisma.$transaction(async (tx) => {
    await tx.garantieJourneeIa.update({
      where: { id },
      data: {
        decision,
        decisionLe: enDate(decisionLe),
        motifDecision: motif,
        montantRembourseCents: montant,
        montantAvoirHtCents: montantAvoir,
        totalGainsCents: total,
        avoirEmisLe: enDate(avoirEmisLe),
        avoirId,
      },
    });
    await tx.activityLog.create({
      data: await donneesJournalQualiopi({
        action: "qualiopi.garantie_journee_ia.decision",
        targetType: "GarantieJourneeIa",
        targetId: id,
        changes: {
          decision: { avant: dossier.decision, apres: decision },
          decisionLe,
          montantRembourseCents: montant,
          montantAvoirHtCents: montantAvoir,
        },
        session,
      }),
    });
  });
  revalidatePath(liste());
  redirect(`${fiche(id)}?ok=decision`);
}

/* ── 4. Virement (argent) ────────────────────────────────────────────────────── */

export async function enregistrerVirementGarantieJourneeIaAction(
  formData: FormData,
): Promise<void> {
  const session = await requireHabilitation("facturer");
  const id = texte(formData, "id");
  if (!uuid.safeParse(id).success) refuser(liste(), "Dossier invalide.");
  const virementLe = jourFacultatif(formData, "virementLe");
  if (!virementLe) refuser(fiche(id), "Date de virement invalide.");
  const dossier = await lireGarantie(id);
  if (!dossier) refuser(liste(), "Dossier introuvable.");
  if (dossier.archiveLe) refuser(fiche(id), "Dossier archivé : le désarchiver d'abord.");
  const refus = refusVirement(dossier, virementLe, aujourdhuiParis());
  if (refus) refuser(fiche(id), refus);

  // Réputée acceptée : le montant n'a pas de décision pour le porter, il se saisit ici.
  let montant = dossier.montantRembourseCents;
  const saisi = texte(formData, "montantRembourseEuros");
  if (saisi) {
    montant = eurosEnCentimes(saisi);
    if (montant === null || montant <= 0) refuser(fiche(id), "Montant remboursé invalide.");
  }
  if (montant === null) refuser(fiche(id), "Saisir le montant remboursé.");

  await prisma.$transaction(async (tx) => {
    await tx.garantieJourneeIa.update({
      where: { id },
      data: { virementLe: enDate(virementLe), montantRembourseCents: montant },
    });
    await tx.activityLog.create({
      data: await donneesJournalQualiopi({
        action: "qualiopi.garantie_journee_ia.virement",
        targetType: "GarantieJourneeIa",
        targetId: id,
        changes: { virementLe, montantRembourseCents: montant },
        session,
      }),
    });
  });
  revalidatePath(liste());
  redirect(`${fiche(id)}?ok=virement`);
}

/* ── 5. Archivage (jamais de suppression) ────────────────────────────────────── */

export async function archiverGarantieJourneeIaAction(formData: FormData): Promise<void> {
  const session = await requireAdminWrite();
  const id = texte(formData, "id");
  if (!uuid.safeParse(id).success) refuser(liste(), "Dossier invalide.");
  const archiver = texte(formData, "archiver") === "oui";
  const dossier = await lireGarantie(id);
  if (!dossier) refuser(liste(), "Dossier introuvable.");

  await prisma.$transaction(async (tx) => {
    await tx.garantieJourneeIa.update({
      where: { id },
      data: { archiveLe: archiver ? new Date() : null },
    });
    await tx.activityLog.create({
      data: await donneesJournalQualiopi({
        action: archiver
          ? "qualiopi.garantie_journee_ia.archive"
          : "qualiopi.garantie_journee_ia.desarchive",
        targetType: "GarantieJourneeIa",
        targetId: id,
        changes: { archiver },
        session,
      }),
    });
  });
  revalidatePath(liste());
  redirect(`${fiche(id)}?ok=${archiver ? "archive" : "desarchive"}`);
}
