// L'ISSUE DE L'ÉCHANGE APPORTEUR — la logique serveur (2026-09-28).
//
// Partagée par les deux actions de la console (`issue-apporteur-actions.ts`) :
//   · l'APERÇU, qui rend l'e-mail exact AVANT tout envoi ;
//   · l'ENREGISTREMENT, qui écrit le point et envoie l'e-mail confirmé.
// Les deux passent par `preparerIssueApporteur` : ce que Will a vu dans l'aperçu
// est, au caractère près, ce qui part (même destinataire, même payload).
//
// ── Un seul envoi par issue et par PERSONNE ───────────────────────────────
// Une personne a souvent deux ou trois lignes (premier contact, dossier,
// saisie manuelle), reliées par l'empreinte d'adresse. L'idempotence se lit
// donc sur TOUTES ses lignes, comme l'invitation (`invitation-apporteur.ts`) :
//   1. le journal des envois (`pending` / `sent`) et la corbeille de
//      validation (`a_valider`) — un e-mail déjà parti ou en attente ne repart
//      pas, et l'écran le dit ;
//   2. un identifiant de job DÉTERMINISTE (gabarit + empreinte) : deux clics
//      simultanés qui passeraient tous deux la lecture ne posent qu'UN job —
//      BullMQ ignore un identifiant qui existe déjà.
//
// 🔴 `enqueueEmail` NE LÈVE PAS : elle rend `{ enqueued }`. Une adresse retenue
// (opposition, rebond dur) n'est PAS un envoi — l'écran doit le dire.
//
// Ce module n'est PAS `"use server"` : de la logique appelée par des actions.

import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { ERASED_PLACEHOLDER } from "@/lib/rgpd-erase";
import { enqueueEmail } from "@/server/queue/queues";
import { estAppelApporteur } from "@/server/calendly/appel-apporteur";
import { lienReservation } from "@/features/commercial-application/relances-invitation-apporteur";
import {
  gabaritDeLIssue,
  jourMoisParis,
  type GabaritIssueApporteur,
  type IssueApporteur,
} from "./issue-apporteur";

export interface EvenementIssue {
  id: string;
  startTime: Date | null;
  linkedSubmissionId: string | null;
}

export interface FicheIssue {
  id: string;
  contactEmailHash: string | null;
  details: unknown;
}

/** Ce que l'aperçu montre et ce que l'enregistrement exécute. */
export type PreparationIssue =
  | { ok: false; message: string }
  | {
      ok: true;
      evenement: EvenementIssue;
      /** La fiche candidat rattachée — `null` si le rendez-vous n'en a pas. */
      fiche: FicheIssue | null;
      /** Les identifiants de TOUTES les lignes de la personne. */
      lignes: string[];
      absencesAnterieures: number;
      /** L'e-mail que l'issue fait partir, ou `null` (aucun, ou plus aucun). */
      envoi: {
        gabarit: GabaritIssueApporteur;
        destinataire: string;
        locale: "fr" | "en";
        payload: Record<string, unknown>;
      } | null;
      /** Pourquoi aucun e-mail ne partira, quand l'issue en prévoit un d'ordinaire. */
      sansEmail: string | null;
    };

/** « mardi 22 septembre », heure de Paris — la date dite au candidat absent. */
function dateLongueParis(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  });
}

/** Les lignes NON supprimées de la personne, par empreinte ; sans empreinte, la fiche seule. */
async function lignesDeLaPersonne(fiche: FicheIssue): Promise<string[]> {
  if (!fiche.contactEmailHash) return [fiche.id];
  const lignes = await prisma.submission.findMany({
    where: { contactEmailHash: fiche.contactEmailHash, deletedAt: null },
    select: { id: true },
    take: 20,
  });
  const ids = lignes.map((l) => l.id);
  return ids.includes(fiche.id) ? ids : [fiche.id, ...ids];
}

/**
 * Le dernier envoi de ce gabarit pour ces lignes — parti, en file ou en
 * validation — ou `null`. Les envois annulés, en échec ou rebondis ne comptent
 * pas : ils ne sont pas arrivés. Lève si la base ne répond pas.
 */
export async function dernierEnvoiIssue(
  gabarit: GabaritIssueApporteur,
  lignes: readonly string[],
): Promise<Date | null> {
  const [journal, corbeille] = await Promise.all([
    prisma.emailLog.findFirst({
      where: {
        template: gabarit,
        entityType: "Submission",
        entityId: { in: [...lignes] },
        status: { in: ["pending", "sent"] },
      },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.emailOutbox.findFirst({
      where: {
        template: gabarit,
        entityType: "Submission",
        entityId: { in: [...lignes] },
        statut: "a_valider",
      },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const dates = [journal?.createdAt, corbeille?.createdAt].filter((d): d is Date => !!d);
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

/**
 * Identifiant du job BullMQ : un par gabarit et par PERSONNE. L'empreinte,
 * jamais l'adresse (une clé Redis se lit dans n'importe quel dump) ; aucun `:`
 * (séparateur BullMQ).
 */
export function jobIdIssue(gabarit: GabaritIssueApporteur, cle: string): string {
  return `${gabarit}-${cle}`.replace(/:/g, "-");
}

export async function preparerIssueApporteur(input: {
  calendlyEventId: string;
  issue: IssueApporteur;
  motPersonnel?: string | null;
}): Promise<PreparationIssue> {
  const evt = await prisma.calendlyEvent.findUnique({
    where: { id: input.calendlyEventId },
    select: {
      id: true,
      eventTypeName: true,
      startTime: true,
      inviteeEmail: true,
      linkedSubmissionId: true,
    },
  });
  if (!evt) return { ok: false, message: "Rendez-vous introuvable." };
  if (!estAppelApporteur(evt.eventTypeName)) {
    return { ok: false, message: "Ce rendez-vous n'est pas un échange apporteur." };
  }
  const evenement: EvenementIssue = {
    id: evt.id,
    startTime: evt.startTime,
    linkedSubmissionId: evt.linkedSubmissionId,
  };

  const ligne = evt.linkedSubmissionId
    ? await prisma.submission.findUnique({
        where: { id: evt.linkedSubmissionId },
        select: {
          id: true,
          locale: true,
          contactName: true,
          contactEmail: true,
          contactEmailHash: true,
          details: true,
          deletedAt: true,
        },
      })
    : null;
  const fiche: FicheIssue | null =
    ligne && !ligne.deletedAt
      ? { id: ligne.id, contactEmailHash: ligne.contactEmailHash, details: ligne.details }
      : null;
  const lignes = fiche ? await lignesDeLaPersonne(fiche) : [];

  // Les AUTRES échanges de la personne déjà notés « Absent » — par ses lignes,
  // et par l'adresse de l'invité (un échange pas encore rattaché compte aussi).
  const parPersonne = [
    ...(lignes.length > 0 ? [{ linkedSubmissionId: { in: lignes } }] : []),
    ...(evt.inviteeEmail ? [{ inviteeEmail: evt.inviteeEmail }] : []),
  ];
  const absencesAnterieures =
    parPersonne.length === 0
      ? 0
      : await prisma.rendezVousSuivi.count({
          where: {
            issue: "absent",
            calendlyEventId: { not: evt.id },
            calendlyEvent: { OR: parPersonne },
          },
        });

  const base = { ok: true as const, evenement, fiche, lignes, absencesAnterieures };
  const gabarit = gabaritDeLIssue(input.issue, absencesAnterieures);
  if (!gabarit) {
    const sansEmail =
      input.issue === "absent"
        ? "Deuxième absence : aucun nouveau créneau n'est proposé. Tu peux classer la personne « Non retenu »."
        : null;
    return { ...base, envoi: null, sansEmail };
  }

  // Un e-mail prévu : il faut une fiche, et une adresse vivante.
  if (!fiche || !ligne) {
    return {
      ok: false,
      message:
        "Ce rendez-vous n'est rattaché à aucune fiche candidat : impossible d'envoyer l'e-mail. Rattache-le d'abord depuis la fiche d'appel.",
    };
  }
  let email: string | null = null;
  let nom: string | null = null;
  try {
    email = decryptPii(ligne.contactEmail);
    nom = decryptPii(ligne.contactName);
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "issue-apporteur", step: "pii" } });
  }
  if (
    !email ||
    nom === ERASED_PLACEHOLDER ||
    email.trim().toLowerCase().endsWith("@erased.local")
  ) {
    return {
      ok: false,
      message: "La fiche a été effacée ou son adresse est illisible : aucun e-mail ne peut partir.",
    };
  }

  let calendlyUrl: string | null = null;
  if (gabarit === "apporteur-issue-absent") {
    calendlyUrl = lienReservation();
    if (!calendlyUrl) {
      return {
        ok: false,
        message:
          "Le lien de réservation apporteur (CALENDLY_APPORTEUR_URL) est absent ou invalide : l'e-mail ne peut pas proposer de créneau.",
      };
    }
  }

  const deja = await dernierEnvoiIssue(gabarit, lignes);
  if (deja) {
    return {
      ...base,
      envoi: null,
      sansEmail: `Cet e-mail est déjà parti (ou attend validation) depuis le ${jourMoisParis(deja)} : il ne sera pas renvoyé.`,
    };
  }

  const mot = input.motPersonnel?.trim();
  const payload: Record<string, unknown> = {
    contactName: nom ?? "",
    ...(calendlyUrl ? { calendlyUrl } : {}),
    ...(gabarit === "apporteur-issue-absent" && evt.startTime
      ? { dateEchange: dateLongueParis(evt.startTime) }
      : {}),
    ...(mot ? { motPersonnel: mot } : {}),
  };
  return {
    ...base,
    envoi: {
      gabarit,
      destinataire: email.trim(),
      locale: ligne.locale === "en" ? "en" : "fr",
      payload,
    },
    sansEmail: null,
  };
}

/**
 * Les trois e-mails que ce module met en file, nommés EN TOUTES LETTRES : le
 * catalogue des e-mails (`server/email/apercu/catalogue.spec.ts`) retrouve
 * l'émetteur d'un gabarit à son nom littéral dans le fichier qui enfile.
 */
const GABARITS_ENVOYES: readonly GabaritIssueApporteur[] = [
  "apporteur-issue-absent",
  "apporteur-issue-retenu",
  "apporteur-issue-non-retenu",
];

export type ResultatEnvoiIssue =
  | { statut: "envoye" }
  | { statut: "en-validation" }
  | { statut: "retenu" }
  | { statut: "file-indisponible" };

/** Met l'e-mail préparé en file. Ne lève pas. */
export async function envoyerIssue(
  prep: Extract<PreparationIssue, { ok: true }>,
): Promise<ResultatEnvoiIssue | null> {
  if (!prep.envoi || !prep.fiche) return null;
  if (!GABARITS_ENVOYES.includes(prep.envoi.gabarit)) return { statut: "file-indisponible" };
  const cle = prep.fiche.contactEmailHash ?? `id-${prep.fiche.id}`;
  try {
    const r = await enqueueEmail(
      prep.envoi.gabarit,
      prep.envoi.destinataire,
      prep.envoi.locale,
      prep.envoi.payload,
      {
        entityType: "Submission",
        entityId: prep.fiche.id,
        jobId: jobIdIssue(prep.envoi.gabarit, cle),
      },
    );
    if (r.garePourValidation) return { statut: "en-validation" };
    if (r.enqueued) return { statut: "envoye" };
    return r.retenu ? { statut: "retenu" } : { statut: "file-indisponible" };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "issue-apporteur", step: "envoi" } });
    return { statut: "file-indisponible" };
  }
}
