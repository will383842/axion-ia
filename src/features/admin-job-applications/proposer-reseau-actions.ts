// « PROPOSER LE RÉSEAU D'APPORTEURS » À UNE PERSONNE QUI A POSTULÉ À UNE OFFRE
// D'EMPLOI — Server Action de la fiche candidature (décision Will, 2026-09-28).
//
// ── Le besoin ─────────────────────────────────────────────────────────────
// Des personnes ont postulé aux offres SALARIÉES commerciales du site. Will
// veut leur proposer AUSSI le réseau d'apporteurs d'affaires indépendants, et
// retrouver leur fiche dans Contacts › Commercial pour qu'elles suivent le même
// tunnel (invitation à l'échange de 15 minutes, rappels J+3 / J+7, badges,
// rattachement du rendez-vous Calendly).
//
// ── Sur le modèle EXACT de la saisie manuelle ─────────────────────────────
// (`features/commercial-application/saisie-manuelle-actions.ts`) :
//   · données personnelles chiffrées (`encryptPii`), empreinte d'adresse
//     (`hashEmailForLookup`) pour retrouver la personne ;
//   · `source: import`, `details.unifiedType / subType / etape` : la fiche est
//     un contact apporteur au sens de `estApporteur` ;
//   · LE CONSENTEMENT N'EST PAS SIMULÉ : la personne a consenti à l'étude de sa
//     candidature à un poste, pas au réseau. Le fait est écrit tel quel ;
//   · LE DOUBLON SE DÉTECTE AVANT D'ÉCRIRE, par empreinte : une fiche apporteur
//     existante n'est pas dupliquée, l'écran renvoie vers elle ;
//   · aucun envoi automatique : l'invitation ne part que si la case est cochée
//     (cochée par défaut). Décochée : la fiche seule — cas d'une personne déjà
//     contactée ailleurs (LinkedIn).
// Différences : `details.origine = ORIGINE_CANDIDATURE_OFFRE`, le lien vers la
// candidature (`jobApplicationId`) et le titre de l'offre (`offreTitre`), qui
// fait choisir à l'invitation sa variante honnête (« une autre proposition »,
// jamais « ta candidature apporteur est retenue »).
//
// ── Idempotence ───────────────────────────────────────────────────────────
// Un second clic ne crée pas une seconde fiche : la fiche née de cette
// candidature est cherchée AVANT tout, par `details.jobApplicationId`.
//
// 🔴 Aucune donnée personnelle en clair dans les journaux : ni l'adresse, ni le
// nom. L'empreinte suffit à retrouver la personne.

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { env } from "@/env";
import { adminPath } from "@/lib/admin-path";
import { estLienCalendlyValide } from "@/lib/commercial-application/kit-apporteur";
import { envoyerInvitationApporteur } from "@/features/commercial-application/invitation-apporteur";

import { requireAdminWrite } from "./session";
import { consignerEvenement } from "./journal";
import {
  creerFicheApporteurDepuisCandidature,
  ficheApporteurDeLaCandidature,
} from "./fiche-apporteur-depuis-candidature";

export type IssueInvitationReseau =
  { envoyee: true; enValidation?: true } | { envoyee: false; message: string };

export type EtatPropositionReseau =
  | {
      ok: true;
      submissionId: string;
      /** Lien console vers la fiche apporteur. */
      lien: string;
      /** La fiche existait déjà pour cette candidature : rien n'a été créé ni envoyé. */
      deja?: true;
      invitation?: IssueInvitationReseau;
    }
  | {
      ok: false;
      erreur:
        | "non-autorise"
        | "champs-invalides"
        | "introuvable"
        | "doublon"
        | "lien-absent"
        | "illisible"
        | "echec";
      message: string;
      /** Doublon : la fiche apporteur qui existe déjà pour cette adresse. */
      submissionId?: string;
      lien?: string;
    };

const schema = z.object({
  applicationId: z.string().uuid(),
  envoyerInvitation: z.boolean(),
});

function lienFiche(id: string): string {
  return adminPath("fr", `contacts/commercial/${id}`);
}

/** « 28/09 », heure de Paris. */
function jourMois(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Paris",
  });
}

export async function proposerReseauApporteursAction(
  payload: unknown,
): Promise<EtatPropositionReseau> {
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
  const { applicationId, envoyerInvitation } = parsed.data;

  // ── IDEMPOTENCE : la fiche née de CETTE candidature, avant tout le reste.
  const existante = await ficheApporteurDeLaCandidature(applicationId);
  if (existante) {
    return { ok: true, deja: true, submissionId: existante.id, lien: lienFiche(existante.id) };
  }

  // Le lien se vérifie AVANT d'écrire : une invitation demandée sans lien
  // valide ne doit pas laisser une fiche créée et un envoi raté derrière elle.
  const calendlyUrl = env.CALENDLY_APPORTEUR_URL?.trim() ?? "";
  if (envoyerInvitation && !estLienCalendlyValide(calendlyUrl)) {
    return {
      ok: false,
      erreur: "lien-absent",
      message:
        "Le lien Calendly de l'échange (CALENDLY_APPORTEUR_URL) n'est pas configuré : décoche l'invitation, ou fais poser le lien.",
    };
  }

  // La création (idempotence, doublon par empreinte, chiffrement, journal) est
  // partagée avec le passage automatique du worker (2026-09-28).
  const creation = await creerFicheApporteurDepuisCandidature({
    applicationId,
    acteurId: acteur.userId,
    message: envoyerInvitation
      ? "Fiche créée depuis une candidature à une offre d'emploi. Invitation à l'échange de 15 minutes demandée."
      : "Fiche créée depuis une candidature à une offre d'emploi. Aucun e-mail ne lui a été envoyé.",
  });
  if (!creation.ok) {
    switch (creation.erreur) {
      case "introuvable":
        return { ok: false, erreur: "introuvable", message: "Candidature introuvable." };
      case "illisible":
        return {
          ok: false,
          erreur: "illisible",
          message:
            "Les coordonnées de cette candidature ne se déchiffrent pas : rien n'a été créé.",
        };
      case "doublon":
        return {
          ok: false,
          erreur: "doublon",
          message:
            "Cette personne a déjà une fiche apporteur : rien n'a été créé. Ouvre-la pour l'inviter.",
          ...(creation.submissionId
            ? { submissionId: creation.submissionId, lien: lienFiche(creation.submissionId) }
            : {}),
        };
      default:
        return { ok: false, erreur: "echec", message: "L'enregistrement a échoué. Réessaie." };
    }
  }
  const submissionId = creation.submissionId;
  if (creation.deja) {
    return { ok: true, deja: true, submissionId, lien: lienFiche(submissionId) };
  }
  const candidature = { id: applicationId };

  // L'invitation, si cochée. La fiche est écrite : un échec d'envoi ne la
  // défait pas, il est RAPPORTÉ — la fiche garde son bouton pour réessayer.
  let invitation: IssueInvitationReseau | undefined;
  if (envoyerInvitation) {
    try {
      const r = await envoyerInvitationApporteur({
        submissionId,
        calendlyUrl,
        adminId: acteur.userId,
      });
      invitation = r.ok
        ? { envoyee: true, ...(r.enValidation ? { enValidation: true as const } : {}) }
        : { envoyee: false, message: r.message };
    } catch (err) {
      Sentry.captureException(err, {
        tags: { action: "proposerReseauApporteursAction", step: "invitation" },
      });
      invitation = {
        envoyee: false,
        message: "L'invitation n'est pas partie. Réessaie depuis la fiche apporteur.",
      };
    }
  }

  // La frise de la candidature le dit. Best-effort : la fiche existe, et
  // l'écran de la candidature affiche de toute façon le lien vers elle.
  const suite = !invitation
    ? "fiche créée sans invitation"
    : invitation.envoyee
      ? invitation.enValidation
        ? "invitation en attente de validation"
        : "invitation envoyée"
      : "invitation non partie";
  try {
    await consignerEvenement({
      applicationId: candidature.id,
      type: "note",
      authorId: acteur.userId,
      authorName: acteur.nom,
      summary: `Réseau d'apporteurs proposé le ${jourMois(new Date())} — ${suite}`,
      body:
        `Fiche apporteur créée dans Contacts › Commercial.` +
        (invitation && !invitation.envoyee ? ` ${invitation.message}` : ""),
      meta: {
        geste: "reseau-apporteurs-propose",
        submissionId,
        invitation: !invitation
          ? "aucune"
          : invitation.envoyee
            ? invitation.enValidation
              ? "en-validation"
              : "envoyee"
            : "echec",
      },
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "proposerReseauApporteursAction", step: "journal-candidature" },
    });
  }

  revalidatePath(adminPath("fr", `contacts/candidatures/${candidature.id}`));
  revalidatePath(adminPath("fr", "contacts/commercial"));
  return {
    ok: true,
    submissionId,
    lien: lienFiche(submissionId),
    ...(invitation ? { invitation } : {}),
  };
}
