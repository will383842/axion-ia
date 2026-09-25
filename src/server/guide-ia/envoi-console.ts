/**
 * ENVOYER LE GUIDE DEPUIS LA CONSOLE (lot L3, 2026-09-24).
 *
 * Deux gestes, un seul chemin :
 *   · « Envoyer le guide », sur la fiche d'un abonné : crée la demande
 *     (`origine = admin`) AU CLIC — jamais à l'avance — et la met en file. Si
 *     la personne a déjà reçu le guide, rien ne part : c'est « Renvoyer » qu'il
 *     faut, et l'écran le dit ;
 *   · « Renvoyer le guide », sur l'écran des demandes : remet en file une
 *     demande existante, qu'elle soit partie ou non.
 *
 * ── Idempotence ─────────────────────────────────────────────────────────────
 * Un double clic, deux onglets, un rafraîchissement qui rejoue le formulaire :
 * UN envoi. La demande est « réservée » par une écriture CONDITIONNELLE de
 * `queued_at` (un `updateMany` qui ne réussit que si personne ne l'a mise en
 * file depuis `FENETRE_ANTI_DOUBLON_CONSOLE_MS`) : deux appels simultanés ne
 * peuvent pas gagner tous les deux. Au-delà de la fenêtre, un second
 * « Renvoyer » est un vrai second envoi — voulu.
 *
 * ── Ce qui ne change pas ────────────────────────────────────────────────────
 * La mise en file passe par `mettreEnFileGuide`, comme le formulaire et le
 * rattrapage : coupe-circuit, 3 envois par destinataire sur 24 h, plafond
 * horaire. Un administrateur ne contourne aucune borne — elles protègent le
 * compte d'envoi des factures, pas le guide.
 *
 * Une demande `origine = admin` n'est JAMAIS reprise par le rattrapage : un
 * geste humain ne se rejoue pas dans le dos de celui qui l'a fait.
 *
 * ── Journal ─────────────────────────────────────────────────────────────────
 * Chaque tentative qui a réservé la demande est journalisée (`activity_logs`),
 * avec son résultat, SANS l'adresse : l'identifiant de la demande suffit.
 *
 * ⚠️ Module serveur ordinaire, PAS `"use server"`.
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { AIMANT_GUIDE_IA } from "./config";
import { mettreEnFileGuide, type ResultatEnvoiGuide } from "./envoi";
import { lettreDansLEmail } from "./lettre";

/** Fenêtre pendant laquelle un second clic ne renvoie rien. */
export const FENETRE_ANTI_DOUBLON_CONSOLE_MS = 10 * 60_000;

/** Version portée par une demande créée depuis la console (aucun texte n'a été affiché). */
export const VERSION_ORIGINE_CONSOLE = "console-admin-v1-2026-09-24";

/** Provenance d'une demande créée depuis la console. */
export const SOURCE_CONSOLE = "console";

export type ResultatEnvoiConsole =
  | ResultatEnvoiGuide
  /** « Envoyer » sur une personne qui a déjà reçu le guide : rien ne part. */
  | "deja-envoye"
  /** Un envoi est déjà en file depuis moins de 10 minutes : rien ne part. */
  | "deja-en-file"
  /** Adresse rejetée (rebond dur) : aucun envoi n'arriverait. */
  | "adresse-rejetee"
  | "introuvable";

export interface IssueEnvoiConsole {
  readonly resultat: ResultatEnvoiConsole;
  readonly demandeId: string | null;
  /** La ligne `guide_requests` vient d'être créée par ce clic. */
  readonly creee: boolean;
}

export interface OptionsConsole {
  readonly adminUserId: string;
  /** Phrase de reprise « inscrit avant la parution du guide » (lot L7). */
  readonly reprise?: boolean;
  readonly ip?: string | null;
  readonly maintenant?: Date;
}

function estConflitUnique(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

interface DemandeReservable {
  readonly id: string;
  readonly email: string;
  readonly locale: "fr" | "en";
  readonly downloadToken: string;
  readonly queuedAt: Date | null;
  readonly sentAt: Date | null;
}

const SELECTION = {
  id: true,
  email: true,
  locale: true,
  downloadToken: true,
  queuedAt: true,
  sentAt: true,
} as const;

/**
 * Réserve la demande : n'aboutit que pour UN appelant par fenêtre. Pour
 * « envoyer », la demande ne doit pas être déjà partie.
 */
async function reserver(
  demande: DemandeReservable,
  mode: "envoyer" | "renvoyer",
  maintenant: Date,
): Promise<boolean> {
  const limite = new Date(maintenant.getTime() - FENETRE_ANTI_DOUBLON_CONSOLE_MS);
  const r = await prisma.guideRequest.updateMany({
    where: {
      id: demande.id,
      OR: [{ queuedAt: null }, { queuedAt: { lt: limite } }],
      ...(mode === "envoyer" ? { sentAt: null } : {}),
    },
    data: { queuedAt: maintenant },
  });
  return r.count === 1;
}

async function journaliser(
  mode: "envoyer" | "renvoyer",
  demandeId: string,
  resultat: ResultatEnvoiConsole,
  options: OptionsConsole,
  extra: Record<string, unknown>,
): Promise<void> {
  await prisma.activityLog
    .create({
      data: {
        adminUserId: options.adminUserId,
        action: mode === "envoyer" ? "newsletter.guide.envoyer" : "newsletter.guide.renvoyer",
        targetType: "guide_request",
        targetId: demandeId,
        changes: { resultat, reprise: options.reprise === true, ...extra },
        ipAddress: options.ip ?? null,
      },
    })
    .catch((e: unknown) =>
      console.error(
        "[guide-ia] envoi console non journalisé :",
        e instanceof Error ? e.message : String(e),
      ),
    );
}

/** Réserve, met en file, et rend la place si rien n'est parti. */
async function reserverEtMettreEnFile(
  demande: DemandeReservable,
  mode: "envoyer" | "renvoyer",
  options: OptionsConsole,
  maintenant: Date,
): Promise<ResultatEnvoiConsole> {
  // Relevé AVANT la réservation : c'est cette valeur qu'on rend si rien ne part.
  const precedent = demande.queuedAt;
  if (!(await reserver(demande, mode, maintenant))) {
    const relue = await prisma.guideRequest.findUnique({
      where: { id: demande.id },
      select: { sentAt: true },
    });
    return mode === "envoyer" && relue?.sentAt ? "deja-envoye" : "deja-en-file";
  }

  const lettre = await lettreDansLEmail(demande.email);
  const resultat = await mettreEnFileGuide(
    {
      id: demande.id,
      email: demande.email,
      locale: demande.locale,
      downloadToken: demande.downloadToken,
    },
    {
      confirmToken: lettre.confirmToken ?? null,
      unsubscribeToken: lettre.unsubscribeToken ?? null,
      reprise: options.reprise === true,
      maintenant,
    },
  );

  if (resultat !== "en-file" && resultat !== "en-validation") {
    // Rien n'est parti : la réservation est rendue, pour qu'un nouveau clic
    // (après la cause levée) ne se heurte pas à « déjà en file ».
    await prisma.guideRequest
      .updateMany({
        where: { id: demande.id, queuedAt: maintenant },
        data: { queuedAt: precedent },
      })
      .catch(() => undefined);
  }
  return resultat;
}

/**
 * « Envoyer le guide », depuis la fiche d'un abonné. Crée la demande au clic
 * s'il n'y en a pas (`origine = admin`), sinon réutilise celle de la personne.
 */
export async function envoyerGuideAAbonne(
  abonneId: string,
  options: OptionsConsole,
): Promise<IssueEnvoiConsole> {
  const maintenant = options.maintenant ?? new Date();
  const abonne = await prisma.newsletterSubscriber.findUnique({
    where: { id: abonneId },
    select: { id: true, email: true, locale: true, status: true },
  });
  if (!abonne) return { resultat: "introuvable", demandeId: null, creee: false };
  if (abonne.status === "bounced") {
    return { resultat: "adresse-rejetee", demandeId: null, creee: false };
  }

  const emailKey = hashEmailForLookup(abonne.email);
  if (!emailKey) return { resultat: "introuvable", demandeId: null, creee: false };
  const cle = { emailKey_aimant: { emailKey, aimant: AIMANT_GUIDE_IA } };

  let demande = await prisma.guideRequest.findUnique({ where: cle, select: SELECTION });
  let creee = false;
  if (!demande) {
    try {
      demande = await prisma.guideRequest.create({
        data: {
          email: abonne.email,
          emailKey,
          aimant: AIMANT_GUIDE_IA,
          origine: "admin",
          source: SOURCE_CONSOLE,
          locale: abonne.locale,
          version: VERSION_ORIGINE_CONSOLE,
          downloadToken: crypto.randomBytes(32).toString("hex"),
        },
        select: SELECTION,
      });
      creee = true;
    } catch (e) {
      // Double clic simultané : le second relit la ligne du premier, et sa
      // réservation échouera ci-dessous. Un seul envoi.
      if (!estConflitUnique(e)) throw e;
      demande = await prisma.guideRequest.findUniqueOrThrow({ where: cle, select: SELECTION });
    }
  }

  if (demande.sentAt !== null) {
    return { resultat: "deja-envoye", demandeId: demande.id, creee: false };
  }

  const resultat = await reserverEtMettreEnFile(demande, "envoyer", options, maintenant);
  if (resultat !== "deja-envoye" && resultat !== "deja-en-file") {
    await journaliser("envoyer", demande.id, resultat, options, { abonneId, creee });
  }
  return { resultat, demandeId: demande.id, creee };
}

/** « Renvoyer le guide », depuis l'écran des demandes. */
export async function renvoyerGuide(
  demandeId: string,
  options: OptionsConsole,
): Promise<IssueEnvoiConsole> {
  const maintenant = options.maintenant ?? new Date();
  const demande = await prisma.guideRequest.findUnique({
    where: { id: demandeId },
    select: SELECTION,
  });
  if (!demande) return { resultat: "introuvable", demandeId: null, creee: false };

  const abonne = await prisma.newsletterSubscriber.findUnique({
    where: { email: demande.email },
    select: { status: true },
  });
  if (abonne?.status === "bounced") {
    return { resultat: "adresse-rejetee", demandeId, creee: false };
  }

  const resultat = await reserverEtMettreEnFile(demande, "renvoyer", options, maintenant);
  if (resultat !== "deja-en-file" && resultat !== "deja-envoye") {
    await journaliser("renvoyer", demandeId, resultat, options, {});
  }
  return { resultat, demandeId, creee: false };
}

/** Phrase courte, pour la console, de chaque issue. */
export const LIBELLE_ISSUE_CONSOLE: Readonly<Record<ResultatEnvoiConsole, string>> = {
  "en-file": "Guide mis en file : il part dans les minutes qui viennent.",
  "en-validation": "Guide retenu pour relecture : il attend dans « E-mails à valider ».",
  suspendu: "Envoi du guide suspendu (coupe-circuit des rebonds) : rien n'est parti.",
  "limite-destinataire": "Déjà 3 envois du guide à cette adresse sur 24 h : rien n'est parti.",
  plafond: "Plafond horaire du guide atteint : réessayez dans une heure.",
  "non-parti": "La mise en file a échoué : rien n'est parti. Réessayez.",
  "deja-envoye": "Cette personne a déjà reçu le guide. Utilisez « Renvoyer » depuis ses demandes.",
  "deja-en-file":
    "Un envoi est déjà en file depuis moins de 10 minutes : rien de plus n'est parti.",
  "adresse-rejetee": "Adresse rejetée (rebond définitif) : aucun envoi n'arriverait.",
  introuvable: "Introuvable : la fiche a peut-être été effacée.",
};
