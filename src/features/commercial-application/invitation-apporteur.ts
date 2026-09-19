// INVITATION À L'ÉCHANGE DE 15 MINUTES — la logique, partagée par les deux
// portes de la console (2026-09-19) :
//   · le bouton « Envoyer l'invitation » de la fiche (Contacts › Commercial) ;
//   · la case « Envoyer l'invitation » de la saisie manuelle d'un contact.
//
// ── Pourquoi c'est un geste MANUEL ────────────────────────────────────────
// Décision de Will : le lien de réservation n'est PAS distribué à toute
// personne qui laisse son adresse — il saturerait son agenda. Tout le monde
// reçoit automatiquement le KIT (document de présentation + catalogue) ; le
// lien d'appel, lui, part à la main, à qui Will choisit.
//
// ── Ce que l'envoi fait, dans l'ordre ─────────────────────────────────────
//   1. vérifie le lien (https, calendly.com) — une faute de frappe ne part pas ;
//   2. vérifie que la fiche est bien un contact apporteur, non effacé ;
//   3. met en file `apporteur-invitation-appel` : l'invitation, le kit, et le
//      lien du dossier SI la personne ne l'a pas encore envoyé ;
//   4. retire les rappels « ton dossier t'attend » encore en attente — la
//      personne vient de recevoir l'invitation, qui porte déjà ce lien ;
//   5. journalise le geste (qui, quand, sur quelle fiche).
//
// 🔴 `enqueueEmail` NE LÈVE PAS : elle rend `{ enqueued }`. Une adresse
// retenue (désinscrite, rebond dur) n'est PAS une réussite — l'écran doit dire
// que rien n'est parti, jamais « envoyé ».
//
// Ce module n'est PAS `"use server"` : c'est de la logique serveur appelée par
// deux actions, pas une action exposée au navigateur.

import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { ERASED_PLACEHOLDER } from "@/lib/rgpd-erase";
import { SITE_URL } from "@/lib/site-url";
import { enqueueEmail } from "@/server/queue/queues";
import { CANDIDATURE_COMMERCIALE_SUBTYPE } from "@/lib/commercial-application/model";
import { DOSSIER_COMPLET_PATH } from "@/lib/commercial-application/lead-apporteur";
import { estLienCalendlyValide } from "@/lib/commercial-application/kit-apporteur";
import { annulerRelancesLeadApporteur } from "./relances-lead-apporteur";

/** Nom du gabarit — aussi la clé de lecture de l'historique (`EmailLog.template`). */
export const GABARIT_INVITATION_APPORTEUR = "apporteur-invitation-appel";

export type ResultatInvitation =
  | { ok: true }
  | {
      ok: false;
      erreur:
        | "lien-invalide"
        | "introuvable"
        | "pas-un-apporteur"
        | "efface"
        | "retenu"
        | "file-indisponible";
      message: string;
    };

interface DetailsContact {
  unifiedType?: unknown;
  subType?: unknown;
  etape?: unknown;
}

function lireDetails(v: unknown): DetailsContact {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as DetailsContact) : {};
}

/** Une ligne est un contact apporteur si elle vit dans la file Contacts › Commercial. */
function estContactApporteur(d: DetailsContact): boolean {
  return d.unifiedType === "recrutement" && d.subType === CANDIDATURE_COMMERCIALE_SUBTYPE;
}

/**
 * Le dossier complet est-il déjà arrivé pour cette personne ?
 *
 * Un premier contact, une capture d'écran 1 ou une saisie manuelle portent
 * `details.etape` ; le dossier complet n'en porte pas. On regarde TOUTES les
 * lignes de la personne (par empreinte d'adresse), pas seulement la fiche
 * ouverte : quelqu'un venu de Facebook a d'abord une ligne « premier contact »,
 * puis une seconde ligne pour son dossier.
 */
async function dossierDejaArrive(contactEmailHash: string | null): Promise<boolean> {
  if (!contactEmailHash) return false;
  const lignes = await prisma.submission.findMany({
    where: { contactEmailHash, deletedAt: null },
    select: { details: true },
    take: 20,
  });
  return lignes.some((l) => {
    const d = lireDetails(l.details);
    return estContactApporteur(d) && d.etape === undefined;
  });
}

export async function envoyerInvitationApporteur(input: {
  submissionId: string;
  calendlyUrl: string;
  adminId: string;
}): Promise<ResultatInvitation> {
  const calendlyUrl = input.calendlyUrl.trim();
  if (!estLienCalendlyValide(calendlyUrl)) {
    return {
      ok: false,
      erreur: "lien-invalide",
      message: "Le lien doit être une adresse https://calendly.com/… complète.",
    };
  }

  const ligne = await prisma.submission.findUnique({
    where: { id: input.submissionId },
    select: {
      id: true,
      locale: true,
      contactName: true,
      contactEmail: true,
      contactEmailHash: true,
      details: true,
      deletedAt: true,
    },
  });
  if (!ligne || ligne.deletedAt) {
    return { ok: false, erreur: "introuvable", message: "Cette fiche n'existe plus." };
  }
  if (!estContactApporteur(lireDetails(ligne.details))) {
    return {
      ok: false,
      erreur: "pas-un-apporteur",
      message: "Cette fiche n'est pas un contact du réseau d'apporteurs.",
    };
  }

  let email: string | null = null;
  let nom: string | null = null;
  try {
    email = decryptPii(ligne.contactEmail);
    nom = decryptPii(ligne.contactName);
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "envoyerInvitationApporteur", step: "pii" } });
  }
  // Une fiche effacée (art. 17) porte une adresse synthétique : lui écrire
  // ferait rebondir un message au nom d'une personne qui a demandé l'oubli.
  if (!email || nom === ERASED_PLACEHOLDER || email.endsWith("@erased.local")) {
    return {
      ok: false,
      erreur: "efface",
      message: "Les coordonnées de cette personne ont été effacées : rien n'est envoyé.",
    };
  }

  const locale = ligne.locale === "en" ? "en" : "fr";
  const dossierUrl = (await dossierDejaArrive(ligne.contactEmailHash))
    ? undefined
    : `${SITE_URL}/${locale}${DOSSIER_COMPLET_PATH}`;

  const envoi = await enqueueEmail(
    GABARIT_INVITATION_APPORTEUR,
    email,
    locale,
    {
      contactName: nom ?? "",
      calendlyUrl,
      ...(dossierUrl ? { dossierUrl } : {}),
    },
    { entityType: "Submission", entityId: ligne.id },
  );

  if (!envoi.enqueued) {
    return envoi.retenu
      ? {
          ok: false,
          erreur: "retenu",
          message:
            "Rien n'est parti : cette adresse est retenue (désinscription ou adresse en erreur).",
        }
      : {
          ok: false,
          erreur: "file-indisponible",
          message: "Rien n'est parti : la file d'envoi est indisponible. Réessaie dans un instant.",
        };
  }

  // Les rappels « ton dossier t'attend » deviennent redondants : l'invitation
  // porte déjà le lien du dossier. Best-effort — l'invitation est partie.
  try {
    await annulerRelancesLeadApporteur(
      email,
      "Envoi annulé : une invitation à l'échange a été envoyée depuis la console.",
    );
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "envoyerInvitationApporteur", step: "annuler-relances" },
    });
  }

  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: input.adminId,
        action: "submission.invitation_apporteur",
        targetType: "submission",
        targetId: ligne.id,
        // L'adresse n'est pas recopiée : l'empreinte suffit à retrouver la personne.
        changes: {
          gabarit: GABARIT_INVITATION_APPORTEUR,
          contactEmailHash: ligne.contactEmailHash,
          lienDossier: dossierUrl !== undefined,
        },
      },
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "envoyerInvitationApporteur", step: "journal" },
    });
  }

  return { ok: true };
}

export interface InvitationEnvoyee {
  le: Date;
  statut: string;
}

/**
 * L'historique des invitations de cette fiche, lu dans le journal des envois —
 * la seule source qui dit si un e-mail est PARTI, et pas seulement demandé.
 * Ne lève jamais : une fiche doit s'afficher même si le journal ne répond pas.
 */
export async function lireInvitationsEnvoyees(submissionId: string): Promise<InvitationEnvoyee[]> {
  try {
    const lignes = await prisma.emailLog.findMany({
      where: {
        template: GABARIT_INVITATION_APPORTEUR,
        entityType: "Submission",
        entityId: submissionId,
      },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    return lignes.map((l) => ({ le: l.createdAt, statut: String(l.status) }));
  } catch (err) {
    Sentry.captureException(err, { tags: { lecture: "invitations-apporteur" } });
    return [];
  }
}
