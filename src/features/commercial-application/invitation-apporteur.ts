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
//   3. (2026-09-19) pour une saisie manuelle, vérifie l'ORIGINE de l'adresse :
//      relevée sur l'annonce d'un tiers → jamais ; venue d'ailleurs
//      (recommandation, autre) → seulement si la personne a accepté d'être
//      contactée (L.34-5 CPCE), et le message porte l'information de l'art. 14 ;
//   4. (2026-09-19) refuse une SECONDE invitation à la même personne — toutes
//      ses lignes, par empreinte d'adresse, envois partis ou en validation —
//      sauf « Renvoyer quand même » ;
//   5. met en file `apporteur-invitation-appel` : l'invitation, le kit, et le
//      lien du dossier SI la personne ne l'a pas encore envoyé ;
//   6. retire les rappels « ton dossier t'attend » encore en attente — la
//      personne vient de recevoir l'invitation, qui porte déjà ce lien ;
//   7. journalise le geste (qui, quand, sur quelle fiche).
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
import {
  ORIGINE_INTERDITE,
  ORIGINES_ACCORD_REQUIS,
  ORIGINES_DIRECTES,
  PROVENANCE_ADRESSE,
} from "@/lib/commercial-application/saisie-manuelle";
import { ORIGINE_SAISIE_MANUELLE } from "@/lib/contact/accuse-attendu";
import { annulerRelancesLeadApporteur } from "./relances-lead-apporteur";

/** Nom du gabarit — aussi la clé de lecture de l'historique (`EmailLog.template`). */
export const GABARIT_INVITATION_APPORTEUR = "apporteur-invitation-appel";

export type ResultatInvitation =
  | { ok: true; enValidation?: true; message?: string }
  | {
      ok: false;
      erreur:
        | "lien-invalide"
        | "introuvable"
        | "pas-un-apporteur"
        | "efface"
        | "retenu"
        | "file-indisponible"
        | "deja-invitee"
        | "origine-interdite"
        | "accord-manquant";
      message: string;
    };

interface DetailsContact {
  unifiedType?: unknown;
  subType?: unknown;
  etape?: unknown;
  origine?: unknown;
  origineSaisie?: unknown;
  accordContactAt?: unknown;
}

function lireDetails(v: unknown): DetailsContact {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as DetailsContact) : {};
}

/** Une ligne est un contact apporteur si elle vit dans la file Contacts › Commercial. */
function estContactApporteur(d: DetailsContact): boolean {
  return d.unifiedType === "recrutement" && d.subType === CANDIDATURE_COMMERCIALE_SUBTYPE;
}

/** Ce que l'invitation dit à la personne de l'origine de son adresse (art. 14). */
export interface Provenance {
  mode: "directe" | "indirecte";
  /** Fragment dans la langue de l'e-mail : « par e-mail », « par une personne qui te recommande »… */
  libelle: string;
}

/**
 * Les lignes NON effacées de cette personne, par empreinte d'adresse — un
 * premier contact Facebook, puis un dossier, puis une saisie manuelle font
 * trois lignes pour une seule personne. Sans empreinte (ligne très ancienne),
 * la fiche seule.
 */
async function lignesDeLaPersonne(
  submissionId: string,
  contactEmailHash: string | null,
): Promise<Array<{ id: string; details: unknown }>> {
  if (!contactEmailHash) return [{ id: submissionId, details: null }];
  const lignes = await prisma.submission.findMany({
    where: { contactEmailHash, deletedAt: null },
    select: { id: true, details: true },
    take: 20,
  });
  return lignes.some((l) => l.id === submissionId)
    ? lignes
    : [{ id: submissionId, details: null }, ...lignes];
}

/**
 * Le dossier complet est-il déjà arrivé pour cette personne ?
 *
 * Un premier contact, une capture d'écran 1 ou une saisie manuelle portent
 * `details.etape` ; le dossier complet n'en porte pas. On regarde TOUTES les
 * lignes de la personne, pas seulement la fiche ouverte.
 */
function dossierDejaArrive(lignes: Array<{ details: unknown }>): boolean {
  return lignes.some((l) => {
    const d = lireDetails(l.details);
    return estContactApporteur(d) && d.etape === undefined;
  });
}

export interface InvitationEnvoyee {
  le: Date;
  /** `sent` / `pending` (journal des envois) ou `a_valider` (corbeille de validation). */
  statut: string;
}

/**
 * Les invitations DÉJÀ PARTIES ou EN ATTENTE DE VALIDATION pour un ensemble de
 * lignes — les deux sources :
 *   · le journal des envois (`pending` = en file, `sent` = parti) ;
 *   · la corbeille « Envois à valider » (`a_valider`) : une invitation garée
 *     n'a pas de ligne de journal, et sans elle un second clic en garerait une
 *     seconde.
 * Les envois annulés, en échec ou rebondis ne comptent pas : ils ne sont pas
 * arrivés. Lève si la base ne répond pas — à l'appelant de choisir.
 */
async function invitationsDesLignes(ids: string[]): Promise<InvitationEnvoyee[]> {
  const [journal, enValidation] = await Promise.all([
    prisma.emailLog.findMany({
      where: {
        template: GABARIT_INVITATION_APPORTEUR,
        entityType: "Submission",
        entityId: { in: ids },
        status: { in: ["pending", "sent"] },
      },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.emailOutbox.findMany({
      where: {
        template: GABARIT_INVITATION_APPORTEUR,
        entityType: "Submission",
        entityId: { in: ids },
        statut: "a_valider",
      },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);
  return [
    ...journal.map((l) => ({ le: l.createdAt, statut: String(l.status) })),
    ...enValidation.map((l) => ({ le: l.createdAt, statut: "a_valider" })),
  ].sort((a, b) => b.le.getTime() - a.le.getTime());
}

/** « 12/09 », heure de Paris — le jour dit à l'administrateur. */
function jourMois(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Paris",
  });
}

export async function envoyerInvitationApporteur(input: {
  submissionId: string;
  calendlyUrl: string;
  adminId: string;
  /** « Renvoyer quand même » : passe outre une invitation déjà partie ou en validation. */
  renvoyer?: boolean;
  /** « La personne a accepté d'être contactée », coché sur la fiche (recommandation, autre). */
  accordContact?: boolean;
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
  const details = lireDetails(ligne.details);
  if (!estContactApporteur(details)) {
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

  // ── ORIGINE DE L'ADRESSE (art. 14 RGPD, L.34-5 CPCE), 2026-09-19 ─────────
  // Seule une SAISIE MANUELLE porte une origine déclarée : une personne venue
  // d'un formulaire du site a donné son adresse elle-même, et son invitation
  // garde le texte d'origine (aucune provenance dans le payload).
  let provenance: Provenance | undefined;
  let accordAEcrire = false;
  if (details.origine === ORIGINE_SAISIE_MANUELLE) {
    const origine = typeof details.origineSaisie === "string" ? details.origineSaisie : "";
    if (origine === ORIGINE_INTERDITE) {
      return {
        ok: false,
        erreur: "origine-interdite",
        message: "Adresse relevée sur l'annonce d'un tiers : pas d'invitation.",
      };
    }
    const fragment = PROVENANCE_ADRESSE[origine];
    if (ORIGINES_ACCORD_REQUIS.includes(origine)) {
      const accordEnregistre = typeof details.accordContactAt === "string";
      if (!accordEnregistre && input.accordContact !== true) {
        return {
          ok: false,
          erreur: "accord-manquant",
          message:
            "L'adresse vient d'ailleurs : coche « La personne a accepté d'être contactée » pour l'inviter.",
        };
      }
      accordAEcrire = !accordEnregistre;
      if (fragment) provenance = { mode: "indirecte", libelle: fragment[locale] };
    } else if (ORIGINES_DIRECTES.includes(origine) && fragment) {
      provenance = { mode: "directe", libelle: fragment[locale] };
    }
  }

  // ── JAMAIS DEUX INVITATIONS, 2026-09-19 ──────────────────────────────────
  // Lue par PERSONNE, pas par ligne : la même personne a souvent deux ou trois
  // lignes, et l'historique d'une seule fiche laissait inviter deux fois.
  // Base muette : on ne peut pas savoir, donc rien ne part — une invitation en
  // double est pire qu'un nouvel essai dans une minute.
  let lignes: Array<{ id: string; details: unknown }>;
  try {
    lignes = await lignesDeLaPersonne(ligne.id, ligne.contactEmailHash);
    if (input.renvoyer !== true) {
      const deja = await invitationsDesLignes(lignes.map((l) => l.id));
      const derniere = deja[0];
      if (derniere) {
        return {
          ok: false,
          erreur: "deja-invitee",
          message:
            `Une invitation est déjà partie (ou attend validation) le ${jourMois(derniere.le)}. ` +
            "Coche « Renvoyer quand même » pour la renvoyer.",
        };
      }
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "envoyerInvitationApporteur", step: "historique" },
    });
    return {
      ok: false,
      erreur: "file-indisponible",
      message:
        "Rien n'est parti : l'historique des invitations est illisible. Réessaie dans un instant.",
    };
  }

  // L'accord attesté sur la fiche est daté AVANT l'envoi : c'est lui qui
  // autorise l'invitation, il doit exister au moment où elle part.
  if (accordAEcrire) {
    await prisma.submission.update({
      where: { id: ligne.id },
      data: {
        details: { ...(ligne.details as object), accordContactAt: new Date().toISOString() },
      },
    });
  }

  const dossierUrl = dossierDejaArrive(lignes)
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
      ...(provenance ? { provenance } : {}),
    },
    { entityType: "Submission", entityId: ligne.id },
  );

  // Garée dans « Envois à valider » (règle d'automatisation) : rien n'est
  // parti, mais rien n'est perdu non plus — ce n'est ni une réussite d'envoi ni
  // une panne. Dit tel quel, et journalisé.
  if (envoi.garePourValidation) {
    await journaliser(input.adminId, ligne, dossierUrl !== undefined, true);
    return {
      ok: true,
      enValidation: true,
      message: "Invitation en attente de validation dans Envois à valider.",
    };
  }

  if (!envoi.enqueued) {
    return envoi.retenu
      ? {
          ok: false,
          erreur: "retenu",
          message:
            "Rien n'est parti : cette adresse est retenue (désinscription, opposition ou adresse en erreur).",
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

  await journaliser(input.adminId, ligne, dossierUrl !== undefined, false);
  return { ok: true };
}

/** Journal du geste : qui, quand, sur quelle fiche. L'adresse n'y est pas recopiée. */
async function journaliser(
  adminId: string,
  ligne: { id: string; contactEmailHash: string | null },
  lienDossier: boolean,
  enValidation: boolean,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: adminId,
        action: "submission.invitation_apporteur",
        targetType: "submission",
        targetId: ligne.id,
        // L'empreinte suffit à retrouver la personne.
        changes: {
          gabarit: GABARIT_INVITATION_APPORTEUR,
          contactEmailHash: ligne.contactEmailHash,
          lienDossier,
          ...(enValidation ? { enValidation: true } : {}),
        },
      },
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "envoyerInvitationApporteur", step: "journal" },
    });
  }
}

/**
 * L'historique des invitations de CETTE PERSONNE — toutes ses lignes, par
 * empreinte d'adresse — lu dans le journal des envois (la seule source qui
 * dit si un e-mail est PARTI) et dans la corbeille de validation. Ne lève
 * jamais : une fiche doit s'afficher même si le journal ne répond pas.
 */
export async function lireInvitationsDeLaPersonne(
  submissionId: string,
): Promise<InvitationEnvoyee[]> {
  try {
    const ligne = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { contactEmailHash: true },
    });
    const lignes = await lignesDeLaPersonne(submissionId, ligne?.contactEmailHash ?? null);
    return await invitationsDesLignes(lignes.map((l) => l.id));
  } catch (err) {
    Sentry.captureException(err, { tags: { lecture: "invitations-apporteur" } });
    return [];
  }
}
