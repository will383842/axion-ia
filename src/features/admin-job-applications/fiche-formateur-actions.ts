// « RETENUE → FICHE FORMATEUR » — Server Action de la fiche candidature (L10,
// chantier « candidatures unifiées », paquet 4a).
//
// ── Le besoin ─────────────────────────────────────────────────────────────
// Un formateur recruté par une offre d'emploi devait être RESSAISI dans
// Qualiopi › Formateurs. Le bouton « Créer sa fiche formateur » la crée depuis
// le dossier : nom, prénom, e-mail, téléphone, CV.
//
// ── Ce qui n'est PAS dupliqué ─────────────────────────────────────────────
// La création passe par `createTrainerAction`, l'action EXISTANTE de Qualiopi :
// même validation, même unicité de l'adresse, même trace `qualiopi.trainer.create`.
// Une seconde écriture de `Trainer` ici divergerait d'elle au premier champ
// ajouté là-bas.
//
// ── Les règles ────────────────────────────────────────────────────────────
//   · seule une candidature RECRUTÉE à une offre de FORMATEUR ouvre la
//     passerelle (`peutCreerFicheFormateur`) ;
//   · la fiche naît INACTIVE : une candidature ne porte jamais de numéro de
//     déclaration d'activité, et aucun formateur externe n'est actif sans lui.
//     La fiche affiche « Numéro de déclaration à demander » tant qu'il manque ;
//   · IDEMPOTENCE : `JobApplication.trainerId` posé = la fiche existe, un second
//     clic l'ouvre et ne crée rien. Le lien s'écrit `where trainerId: null` :
//     deux clics simultanés ne s'écrasent pas, et le second bute de toute façon
//     sur l'unicité de l'adresse du formateur ;
//   · garde : les rôles qui OUVRENT un dossier candidat (`requireAdminWrite` de
//     la zone recrutement) — on ne recopie pas l'identité d'un dossier qu'on n'a
//     pas le droit de lire.
//
// 🔴 Aucune donnée personnelle en clair dans le journal d'activité : les
// identifiants suffisent à retrouver la personne.

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { env } from "@/env";
import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { adminPath } from "@/lib/admin-path";
import { createTrainerAction } from "@/server/actions/qualiopi/trainers";
import {
  mentionActivationFormateur,
  peutCreerFicheFormateur,
  statutFormateurDepuisOffre,
} from "@/lib/careers/fiche-formateur";

import { requireAdminWrite } from "./session";
import { consignerEvenement } from "./journal";

export type EtatFicheFormateur =
  | {
      ok: true;
      trainerId: string;
      /** Lien console vers la fiche formateur. */
      lien: string;
      /** La fiche existait déjà pour cette candidature : rien n'a été créé. */
      deja?: true;
      /** « Numéro de déclaration à demander » tant que la fiche est inactive sans numéro. */
      mention?: string;
    }
  | {
      ok: false;
      erreur:
        | "non-autorise"
        | "champs-invalides"
        | "introuvable"
        | "non-eligible"
        | "illisible"
        | "echec";
      message: string;
    };

const schema = z.object({ applicationId: z.string().uuid() });

function lienFiche(id: string): string {
  return adminPath("fr", `qualiopi/formateurs/${id}`);
}

/** « 09/10 », heure de Paris. */
function jourMois(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Paris",
  });
}

export async function creerFicheFormateurDepuisCandidatureAction(
  payload: unknown,
): Promise<EtatFicheFormateur> {
  let acteur: Awaited<ReturnType<typeof requireAdminWrite>>;
  try {
    acteur = await requireAdminWrite();
  } catch {
    return { ok: false, erreur: "non-autorise", message: "Session absente ou rôle insuffisant." };
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, erreur: "champs-invalides", message: "Demande incomplète." };
  }
  const { applicationId } = parsed.data;

  const candidature = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      trainerId: true,
      offerTitleSnap: true,
      offer: { select: { slug: true, employmentType: true, secondaryEmploymentType: true } },
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      cvStoragePath: true,
    },
  });
  if (!candidature) {
    return { ok: false, erreur: "introuvable", message: "Candidature introuvable." };
  }

  // ── IDEMPOTENCE : la fiche liée, avant tout le reste.
  if (candidature.trainerId) {
    return {
      ok: true,
      deja: true,
      trainerId: candidature.trainerId,
      lien: lienFiche(candidature.trainerId),
    };
  }

  if (
    !peutCreerFicheFormateur({
      status: candidature.status,
      offerSlug: candidature.offer?.slug,
      offerTitleSnap: candidature.offerTitleSnap,
    })
  ) {
    return {
      ok: false,
      erreur: "non-eligible",
      message:
        "La fiche formateur se crée depuis une candidature « Recrutée » à une offre de formateur.",
    };
  }

  let prenom: string;
  let nom: string;
  let email: string;
  let telephone: string;
  try {
    prenom = decryptPii(candidature.firstName).trim();
    nom = decryptPii(candidature.lastName).trim();
    email = decryptPii(candidature.email).trim();
    telephone = candidature.phone ? decryptPii(candidature.phone).trim() : "";
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "creerFicheFormateurDepuisCandidature" } });
    return {
      ok: false,
      erreur: "illisible",
      message: "Les coordonnées de cette candidature ne se déchiffrent pas : rien n'a été créé.",
    };
  }

  const statut = statutFormateurDepuisOffre(
    candidature.offer?.employmentType,
    candidature.offer?.secondaryEmploymentType,
  );
  // Le CV reste où il est (volume privé, route authentifiée de la candidature) :
  // la fiche pointe vers lui, comme `cvUrl` pointe ailleurs vers la route de
  // conservation d'un document versé.
  const cvUrl = candidature.cvStoragePath
    ? new URL(
        adminPath("fr", `contacts/candidatures/${candidature.id}/cv`),
        env.NEXT_PUBLIC_SITE_URL,
      ).toString()
    : undefined;

  const creation = await createTrainerAction({
    nom,
    prenom,
    email,
    statut,
    // Aucun numéro de déclaration dans une candidature : la fiche naît inactive.
    actif: false,
    ...(telephone ? { telephone: telephone.slice(0, 40) } : {}),
    ...(cvUrl ? { cvUrl } : {}),
  });
  if ("error" in creation) {
    return { ok: false, erreur: "echec", message: creation.error };
  }
  const trainerId = creation.data.id;

  await prisma.jobApplication.updateMany({
    where: { id: candidature.id, trainerId: null },
    data: { trainerId },
  });

  const mention = mentionActivationFormateur({ actif: false, sousTraitantNda: null });

  // Traces — best-effort : la fiche existe et le lien est posé ; un journal qui
  // ne s'écrit pas ne doit pas faire croire à un échec qu'on rejouerait.
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: acteur.userId,
        action: "careers.candidature.fiche_formateur_creee",
        targetType: "JobApplication",
        targetId: candidature.id,
        changes: { trainerId, statut, actif: false },
      },
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "creerFicheFormateurDepuisCandidature", step: "journal-activite" },
    });
  }
  try {
    await consignerEvenement({
      applicationId: candidature.id,
      type: "note",
      authorId: acteur.userId,
      authorName: acteur.nom,
      summary: `Fiche formateur créée le ${jourMois(new Date())} — inactive${
        mention ? ` : ${mention.charAt(0).toLowerCase()}${mention.slice(1)}` : ""
      }`,
      body: "Fiche créée dans Qualiopi › Formateurs depuis cette candidature.",
      meta: { geste: "fiche-formateur-creee", trainerId },
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "creerFicheFormateurDepuisCandidature", step: "journal-candidature" },
    });
  }

  revalidatePath(adminPath("fr", `contacts/candidatures/${candidature.id}`));
  revalidatePath(adminPath("fr", "qualiopi/formateurs"));
  return { ok: true, trainerId, lien: lienFiche(trainerId), ...(mention ? { mention } : {}) };
}
