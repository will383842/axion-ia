// RAPPELS DE L'INVITATION — la LECTURE de l'état d'une personne (2026-09-27).
//
// Deux lecteurs, une seule lecture :
//   · le passage quotidien (`relances-invitation-apporteur.ts`), qui décide
//     qui relancer ;
//   · le FILET DU DÉPART (`email-worker.ts`), qui relit l'état juste avant que
//     le rappel parte — une réservation arrivée entre le passage et le départ
//     doit l'arrêter.
// Les deux disent donc non pour les mêmes raisons (`motifBloquant`).
//
// ── Une PERSONNE, pas une ligne ──────────────────────────────────────────
// Un premier contact, un dossier, une saisie manuelle font trois lignes pour
// une seule personne, reliées par l'empreinte d'adresse (`contactEmailHash`).
// La réservation, la réponse, le classement se lisent sur TOUTES ses lignes :
// l'échange est rattaché à sa ligne la plus récente (`rattachement-apporteur`),
// l'invitation a pu partir d'une autre.
//
// ── Pourquoi aussi l'adresse de l'invité Calendly ────────────────────────
// Le rattachement d'un échange à sa fiche est posé après l'enrichissement
// Calendly, pas à la seconde de la réservation. Entre les deux, seule
// l'adresse de l'invité relie le rendez-vous à la personne : on la lit aussi,
// pour ne pas relancer quelqu'un qui vient de réserver.
//
// ⚠️ SUR LE TRAJET DU WORKER D'E-MAILS : base, déchiffrement, règle pure — rien
// d'autre. Pas de `queues.ts` (il tire `suppression.ts`, donc `next-auth`), pas
// de Sentry Next, pas de `server-only`. Gardé par
// `workers/__tests__/email-worker.opposition.graphe-worker.spec.ts`.

import { prisma } from "@/lib/prisma";
import { decryptPii, isDecryptedEmailUsable } from "@/lib/pii-crypto";
import {
  GABARIT_RELANCE_INVITATION,
  motifBloquant,
  type EtatRelanceInvitation,
  type MotifSansRelance,
} from "@/lib/commercial-application/relance-invitation";
import { estTableAbsente } from "@/lib/commercial-application/reponse-entrante";

/**
 * Nom du gabarit de l'invitation. Copie LOCALE de `GABARIT_INVITATION_APPORTEUR`
 * (`invitation-apporteur.ts`), et c'est voulu : ce module-là tire Sentry Next
 * et la file d'envoi, qui n'ont rien à faire sur le trajet du worker. L'égalité
 * des deux est vérifiée par `les-rappels-de-l-invitation.spec.ts`.
 */
export const GABARIT_INVITATION = "apporteur-invitation-appel";

/** Les colonnes d'une ligne dont la décision a besoin. */
export const COLONNES_LIGNE = {
  id: true,
  contactEmailHash: true,
  contactEmail: true,
  contactName: true,
  locale: true,
  deletedAt: true,
  archivedAt: true,
  status: true,
  details: true,
} as const;

export interface LigneSubmission {
  id: string;
  contactEmailHash: string | null;
  contactEmail: string;
  contactName: string;
  locale: string;
  deletedAt: Date | null;
  archivedAt: Date | null;
  status: string;
  details: unknown;
}

/** Une personne à évaluer : ses lignes, la ligne invitée, et la date de la dernière invitation. */
export interface PersonneInvitee {
  readonly cle: string;
  readonly lignes: readonly LigneSubmission[];
  readonly ligneInvitee: LigneSubmission;
  readonly invitationId: string;
  readonly invitationLe: Date;
}

export interface EtatLu {
  readonly etat: EtatRelanceInvitation;
  /** Adresse déchiffrée de la ligne invitée — `null` si illisible ou effacée. */
  readonly email: string | null;
  readonly nom: string;
}

function lireDetails(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Fiche vivante archivée ou classée sans suite. */
function estClose(l: LigneSubmission): boolean {
  if (l.deletedAt !== null) return false;
  const sansSuite = lireDetails(l.details)["sansSuiteAt"];
  return l.archivedAt !== null || l.status === "archived" || typeof sansSuite === "string";
}

/** « J'ai répondu ailleurs », posé APRÈS l'invitation. */
function reponduHorsCircuitApres(l: LigneSubmission, depuis: Date): boolean {
  const v = lireDetails(l.details)["reponduHorsCircuitAt"];
  if (typeof v !== "string") return false;
  const t = Date.parse(v);
  return Number.isFinite(t) && t > depuis.getTime();
}

/** L'adresse de la ligne invitée, déchiffrée ; `null` si illisible, absente ou effacée (art. 17). */
function adresseUtilisable(l: LigneSubmission): string | null {
  let email: string | null = null;
  try {
    email = decryptPii(l.contactEmail);
  } catch {
    return null;
  }
  if (!isDecryptedEmailUsable(email) || email!.trim().toLowerCase().endsWith("@erased.local")) {
    return null;
  }
  return email!.trim();
}

function nomLisible(l: LigneSubmission): string {
  try {
    return decryptPii(l.contactName) ?? "";
  } catch {
    return "";
  }
}

/**
 * Les réponses HUMAINES reçues par e-mail (relevé Zoho, 2026-09-27) sur ces
 * lignes depuis `depuis`. Une réponse automatique n'arrête pas les rappels.
 *
 * Table absente (P2021) = aucune réponse, et c'est VRAI : pendant l'heure qui
 * suit la fusion, le worker tourne avant que l'app n'ait migré, et rien n'a pu
 * y être écrit. Toute AUTRE erreur remonte — le filet du départ retient alors
 * le rappel (« base muette = retenu »).
 */
async function reponsesEntrantesHumaines(
  ids: readonly string[],
  depuis: Date,
): Promise<Array<{ submissionId: string; receivedAt: Date }>> {
  try {
    return await prisma.submissionInboundReply.findMany({
      where: { submissionId: { in: [...ids] }, auto: false, receivedAt: { gt: depuis } },
      select: { submissionId: true, receivedAt: true },
    });
  } catch (e) {
    if (estTableAbsente(e)) return [];
    throw e;
  }
}

/**
 * L'état de chaque personne — SIX requêtes pour tout le lot, pas une par
 * personne. Lève si la base ne répond pas : à l'appelant de choisir (le
 * passage abandonne, le filet retient).
 */
export async function lireEtatsRelance(
  personnes: readonly PersonneInvitee[],
): Promise<Map<string, EtatLu>> {
  const resultat = new Map<string, EtatLu>();
  if (personnes.length === 0) return resultat;

  const personneDeLigne = new Map<string, string>();
  const personneDeLAdresse = new Map<string, string>();
  const adresses = new Map<string, string | null>();
  for (const p of personnes) {
    for (const l of p.lignes) personneDeLigne.set(l.id, p.cle);
    personneDeLigne.set(p.ligneInvitee.id, p.cle);
    const email = adresseUtilisable(p.ligneInvitee);
    adresses.set(p.cle, email);
    if (email) personneDeLAdresse.set(email.toLowerCase(), p.cle);
  }
  const ids = [...personneDeLigne.keys()];
  const emails = [...personneDeLAdresse.keys()];
  const depuisMin = new Date(Math.min(...personnes.map((p) => p.invitationLe.getTime())));

  const [evenements, reponses, journal, corbeille, entrantes] = await Promise.all([
    prisma.calendlyEvent.findMany({
      where: {
        OR: [
          { linkedSubmissionId: { in: ids } },
          ...(emails.length > 0 ? [{ inviteeEmail: { in: emails } }] : []),
        ],
      },
      select: { linkedSubmissionId: true, inviteeEmail: true },
    }),
    prisma.submissionReply.findMany({
      where: { submissionId: { in: ids }, repliedAt: { gt: depuisMin } },
      select: { submissionId: true, repliedAt: true },
    }),
    prisma.emailLog.findMany({
      where: {
        template: GABARIT_RELANCE_INVITATION,
        entityType: "Submission",
        entityId: { in: ids },
        createdAt: { gt: depuisMin },
      },
      select: { entityId: true, createdAt: true },
    }),
    prisma.emailOutbox.findMany({
      where: {
        template: GABARIT_RELANCE_INVITATION,
        entityType: "Submission",
        entityId: { in: ids },
        createdAt: { gt: depuisMin },
      },
      select: { entityId: true, createdAt: true },
    }),
    reponsesEntrantesHumaines(ids, depuisMin),
  ]);

  const reservees = new Set<string>();
  for (const e of evenements) {
    const parLigne = e.linkedSubmissionId ? personneDeLigne.get(e.linkedSubmissionId) : undefined;
    const parAdresse = e.inviteeEmail
      ? personneDeLAdresse.get(e.inviteeEmail.toLowerCase())
      : undefined;
    if (parLigne) reservees.add(parLigne);
    if (parAdresse) reservees.add(parAdresse);
  }

  for (const p of personnes) {
    const mesLignes = new Set([...p.lignes.map((l) => l.id), p.ligneInvitee.id]);
    const apres = (d: Date) => d.getTime() > p.invitationLe.getTime();
    const relancesApres = [...journal, ...corbeille]
      .filter((r) => r.entityId !== null && mesLignes.has(r.entityId) && apres(r.createdAt))
      .map((r) => r.createdAt)
      .sort((a, b) => a.getTime() - b.getTime());
    const repondu =
      reponses.some((r) => mesLignes.has(r.submissionId) && apres(r.repliedAt)) ||
      p.lignes.some((l) => reponduHorsCircuitApres(l, p.invitationLe)) ||
      // 2026-09-27 — la personne a répondu elle-même, par e-mail.
      entrantes.some((r) => mesLignes.has(r.submissionId) && apres(r.receivedAt));
    const email = adresses.get(p.cle) ?? null;
    resultat.set(p.cle, {
      email,
      nom: nomLisible(p.ligneInvitee),
      etat: {
        derniereInvitation: p.invitationLe,
        relancesApres,
        reserve: reservees.has(p.cle),
        repondu,
        close: p.lignes.some(estClose) || estClose(p.ligneInvitee),
        efface: p.ligneInvitee.deletedAt !== null || email === null,
      },
    });
  }
  return resultat;
}

/** Les lignes d'une personne (toutes, corbeille comprise), par empreinte ; sans empreinte, la ligne seule. */
export async function lignesDeLaPersonne(ligne: LigneSubmission): Promise<LigneSubmission[]> {
  if (!ligne.contactEmailHash) return [ligne];
  const lignes = (await prisma.submission.findMany({
    where: { contactEmailHash: ligne.contactEmailHash },
    select: COLONNES_LIGNE,
    take: 50,
  })) as LigneSubmission[];
  return lignes.some((l) => l.id === ligne.id) ? lignes : [ligne, ...lignes];
}

const MOTIFS_LISIBLES: Record<Exclude<MotifSansRelance, "pas-encore">, string> = {
  efface: "la fiche a été supprimée ou effacée",
  reserve: "la personne a réservé son échange",
  repondu: "une réponse a été échangée avec la personne depuis l'invitation",
  close: "la fiche est archivée ou classée sans suite",
  "trop-ancienne": "l'invitation est trop ancienne",
  termine: "les deux rappels sont déjà partis",
};

/**
 * 🔴 LE FILET DU DÉPART, propre aux rappels de l'invitation.
 *
 * Le passage quotidien ne pose que des jobs IMMÉDIATS : entre sa lecture et le
 * départ, il ne s'écoule que le temps de la file (quelques secondes, au pire
 * quelques minutes sous le limiteur horaire). Ce filet relit quand même l'état
 * au moment de partir, pour que la fenêtre se réduise à l'intervalle entre
 * cette lecture et la remise au relais SMTP.
 *
 * Rend le motif de la retenue, ou `null` si le rappel peut partir.
 *
 * Base injoignable : on RETIENT (motif « état illisible ») — l'inverse du
 * filet d'opposition, et c'est voulu : un rappel perdu ne coûte rien, un rappel
 * envoyé à quelqu'un qui a réservé fait douter du sérieux de la maison.
 */
export async function motifRetenueRelanceInvitation(submissionId: string): Promise<string | null> {
  try {
    const ligne = (await prisma.submission.findUnique({
      where: { id: submissionId },
      select: COLONNES_LIGNE,
    })) as LigneSubmission | null;
    if (!ligne) return MOTIFS_LISIBLES.efface;
    const lignes = await lignesDeLaPersonne(ligne);
    const invitation = await prisma.emailLog.findFirst({
      where: {
        template: GABARIT_INVITATION,
        entityType: "Submission",
        entityId: { in: lignes.map((l) => l.id) },
        status: "sent",
      },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    if (!invitation) return "aucune invitation partie n'a été trouvée pour cette personne";
    const cle = ligne.contactEmailHash ?? `id:${ligne.id}`;
    const etats = await lireEtatsRelance([
      {
        cle,
        lignes,
        ligneInvitee: ligne,
        invitationId: invitation.id,
        invitationLe: invitation.createdAt,
      },
    ]);
    const lu = etats.get(cle);
    if (!lu) return "état illisible";
    const motif = motifBloquant(lu.etat);
    return motif ? MOTIFS_LISIBLES[motif] : null;
  } catch (e) {
    console.error(
      `[relance-invitation] état de la fiche ${submissionId} illisible — rappel retenu :`,
      e instanceof Error ? e.message : String(e),
    );
    return "état illisible (base injoignable)";
  }
}
