// Rattachement d'un échange apporteur ORPHELIN à sa fiche candidat (2026-11-27, revu après relecture).
//
// ── La cause ──────────────────────────────────────────────────────────────
// Le rattachement automatique (`rattachement-apporteur.ts`) ne tourne qu'UNE fois, à
// l'enrichissement Calendly. Un rendez-vous pris AVANT que la fiche candidat existe (la
// personne réserve, puis remplit le formulaire) restait orphelin pour toujours : « Absent » /
// aperçu de l'e-mail affichait « Ce rendez-vous n'est rattaché à aucune fiche candidat ».
//
// ── La règle (fermée : on échoue côté prudence) ───────────────────────────
// 🔴 SEULE L'ADRESSE QUE L'API CALENDLY CONFIRME DÉCIDE. Jamais la colonne
// `calendly_events.invitee_email` / `invitee_name` : la route PUBLIQUE
// `/api/calendly/client-event` les écrit depuis le corps de la requête (voir `enrich.ts`,
// « SEULE L'ADRESSE QUE CALENDLY CONFIRME DÉCIDE D'UN RATTACHEMENT »). On relit donc l'invité
// par `inviteeUri` (`fetchCalendlyInvitee`) ; API absente ou en échec → aucun rattachement.
// · Ni téléphone, ni nom : « même nom, autre adresse » reste au choix HUMAIN (sélecteur de la
//   console).
// · Plusieurs fiches à la même adresse (recherche par empreinte `contactEmailHash`, sans plafond)
//   → RIEN n'est deviné. Une fiche `suspect` (robot) n'est jamais candidate.
// · On n'écrase jamais un rattachement : la condition « rattaché à rien » est dans l'écriture.
// · Chaque rattachement est écrit dans `activityLog` (`rendez_vous.rattachement_auto`), avec le
//   critère et l'auteur (admin du clic, ou « formulaire »).
// · Rien n'est jamais supprimé.
// `trouverFicheDuRendezVous` ne fait que LIRE (aperçu). Aucune dépendance Next. Ne lève jamais.

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { estApporteur, FILTRE_APPORTEUR_PRISMA } from "@/lib/commercial-application/est-apporteur";
import { decryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { fetchCalendlyInvitee } from "./api";
import { estRendezVousApporteur } from "./appel-apporteur";

/** Le seul critère admis : l'adresse confirmée par l'API Calendly égale celle de la fiche. */
export const CRITERE_RATTACHEMENT = "email_confirme_calendly";

/** Combien de rendez-vous orphelins on confirme par l'API après un formulaire (latence bornée). */
const MAX_ORPHELINS_PAR_FORMULAIRE = 3;

export interface AuteurRattachement {
  /** Admin qui a cliqué ; `null` depuis un formulaire. */
  adminUserId: string | null;
  /** « formulaire », ou l'e-mail de l'admin. */
  libelle: string;
}
export const AUTEUR_FORMULAIRE: AuteurRattachement = { adminUserId: null, libelle: "formulaire" };

export interface ResultatRattachement {
  /** La fiche à laquelle le rendez-vous est (ou vient d'être) rattaché, sinon `null`. */
  ficheId: string | null;
  /** Vrai seulement si CET appel a écrit le lien. */
  rattache: boolean;
}

/** Phrase à ajouter au message de retour de la console quand un lien vient d'être posé. */
export const NOTE_RATTACHEMENT_AUTO =
  " Rendez-vous rattaché automatiquement à la fiche candidat (adresse e-mail confirmée par Calendly).";

const mail = (v: string | null | undefined): string | null => {
  const s = v?.trim().toLowerCase();
  return s ? s : null;
};
const clair = (v: string | null | undefined): string | null => {
  if (!v) return null;
  try {
    return decryptPii(v);
  } catch {
    return null;
  }
};
const estSuspect = (details: unknown): boolean => {
  const vsl = (details as { vsl?: { suspect?: unknown } } | null)?.vsl;
  return vsl?.suspect === true;
};

/** L'adresse de l'invité telle que CALENDLY la confirme (jamais la colonne), ou `null`. */
async function adresseConfirmee(evt: {
  inviteeUri: string | null;
  eventUri: string | null;
}): Promise<string | null> {
  if (!evt.inviteeUri) return null;
  const res = await fetchCalendlyInvitee(evt.inviteeUri, evt.eventUri);
  if (!res.ok) return null;
  return mail(res.data.inviteeEmail);
}

/**
 * Les fiches apporteur vivantes à cette adresse, par empreinte (indexée, SANS plafond), hors
 * fiches `suspect`. Lève si la clé d'empreinte manque en production : l'appelant enveloppe.
 */
async function fichesAvecAdresse(adresse: string): Promise<string[]> {
  const empreinte = hashEmailForLookup(adresse);
  if (!empreinte) return [];
  const lignes = await prisma.submission.findMany({
    where: { contactEmailHash: empreinte, deletedAt: null, ...FILTRE_APPORTEUR_PRISMA },
    select: { id: true, details: true },
  });
  return lignes.filter((l) => estApporteur(l.details) && !estSuspect(l.details)).map((l) => l.id);
}

const SELECT_ORPHELIN = {
  id: true,
  eventTypeName: true,
  typeRendezVous: true,
  inviteeUri: true,
  eventUri: true,
  linkedSubmissionId: true,
  linkedJobApplicationId: true,
} as const;

/**
 * LECTURE SEULE : la fiche à laquelle ce rendez-vous orphelin se rattacherait (adresse confirmée
 * par Calendly, une seule fiche), sinon `null`. N'écrit rien — c'est ce qu'utilise l'aperçu.
 */
export async function trouverFicheDuRendezVous(eventId: string): Promise<string | null> {
  try {
    const evt = await prisma.calendlyEvent.findUnique({
      where: { id: eventId },
      select: SELECT_ORPHELIN,
    });
    if (!evt) return null;
    if (evt.linkedSubmissionId) return evt.linkedSubmissionId;
    if (evt.linkedJobApplicationId || !estRendezVousApporteur(evt)) return null;
    const adresse = await adresseConfirmee(evt);
    if (!adresse) return null;
    const fiches = await fichesAvecAdresse(adresse);
    return fiches.length === 1 ? fiches[0]! : null;
  } catch {
    return null;
  }
}

async function journaliser(
  fiche: string,
  evenements: readonly string[],
  auteur: AuteurRattachement,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: auteur.adminUserId,
        action: "rendez_vous.rattachement_auto",
        targetType: "submission",
        targetId: fiche,
        changes: {
          calendlyEventIds: [...evenements],
          critere: CRITERE_RATTACHEMENT,
          auteur: auteur.libelle,
        },
      },
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { service: "rattachement-orphelins-journal" } });
  }
}

/** Au clic admin : rattache le rendez-vous orphelin s'il y a EXACTEMENT une fiche à l'adresse confirmée. */
export async function rattacherRendezVousOrphelin(
  eventId: string,
  auteur: AuteurRattachement,
): Promise<ResultatRattachement> {
  try {
    const evt = await prisma.calendlyEvent.findUnique({
      where: { id: eventId },
      select: SELECT_ORPHELIN,
    });
    if (!evt) return { ficheId: null, rattache: false };
    if (evt.linkedSubmissionId) return { ficheId: evt.linkedSubmissionId, rattache: false };
    if (evt.linkedJobApplicationId || !estRendezVousApporteur(evt)) {
      return { ficheId: null, rattache: false };
    }
    const adresse = await adresseConfirmee(evt);
    if (!adresse) return { ficheId: null, rattache: false };
    const fiches = await fichesAvecAdresse(adresse);
    if (fiches.length !== 1) return { ficheId: null, rattache: false }; // 0 ou plusieurs : on ne devine pas
    const cible = fiches[0]!;
    const { count } = await prisma.calendlyEvent.updateMany({
      where: { id: eventId, linkedSubmissionId: null, linkedJobApplicationId: null },
      data: { linkedSubmissionId: cible },
    });
    if (count === 1) {
      await journaliser(cible, [eventId], auteur);
      return { ficheId: cible, rattache: true };
    }
    const relu = await prisma.calendlyEvent.findUnique({
      where: { id: eventId },
      select: { linkedSubmissionId: true },
    });
    return { ficheId: relu?.linkedSubmissionId ?? null, rattache: false };
  } catch {
    return { ficheId: null, rattache: false }; // un rattachement raté laisse le message actuel
  }
}

/**
 * Une fiche candidat vient d'être créée : rattache les échanges apporteur orphelins dont
 * l'adresse CONFIRMÉE PAR CALENDLY est celle de la fiche, si elle est la seule à l'avoir et
 * n'est pas `suspect`. Rend le nombre de rendez-vous rattachés. Ne lève jamais.
 */
export async function rattacherOrphelinsDeLaFiche(
  submissionId: string,
  auteur: AuteurRattachement = AUTEUR_FORMULAIRE,
): Promise<number> {
  try {
    const fiche = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true, details: true, contactEmail: true, deletedAt: true },
    });
    if (!fiche || fiche.deletedAt || !estApporteur(fiche.details) || estSuspect(fiche.details)) {
      return 0;
    }
    const email = mail(clair(fiche.contactEmail));
    if (!email) return 0;

    // Pré-filtre (la colonne n'est PAS une preuve : elle ne sert qu'à limiter les appels à l'API).
    const candidats = await prisma.calendlyEvent.findMany({
      where: {
        linkedSubmissionId: null,
        linkedJobApplicationId: null,
        inviteeUri: { not: null },
        inviteeEmail: { equals: email, mode: "insensitive" },
      },
      orderBy: { capturedAt: "desc" },
      take: MAX_ORPHELINS_PAR_FORMULAIRE,
      select: SELECT_ORPHELIN,
    });
    const aConfirmer = candidats.filter((c) => estRendezVousApporteur(c));
    if (aConfirmer.length === 0) return 0;

    // Une seule fiche à cette adresse (la nôtre) : sinon ambigu, on ne devine pas.
    const fiches = await fichesAvecAdresse(email);
    if (fiches.length !== 1 || fiches[0] !== fiche.id) return 0;

    const confirmes: string[] = [];
    for (const c of aConfirmer) {
      if ((await adresseConfirmee(c)) === email) confirmes.push(c.id);
    }
    if (confirmes.length === 0) return 0;

    const { count } = await prisma.calendlyEvent.updateMany({
      where: { id: { in: confirmes }, linkedSubmissionId: null, linkedJobApplicationId: null },
      data: { linkedSubmissionId: fiche.id },
    });
    if (count > 0) await journaliser(fiche.id, confirmes, auteur);
    return count;
  } catch {
    return 0;
  }
}
