/**
 * L-INV — les FAITS d'une candidature de formateur indépendant pour l'invitation à
 * l'échange (F1), ses rappels (S1 : F2) et le rattrapage unique du stock (F55).
 *
 * Lus EN LOT, une fois, et partagés par trois lecteurs qui doivent juger pareil : le
 * balayage de l'invitation, la campagne S1 du registre commun, et la relecture au départ
 * (le worker relit une seule candidature juste avant l'envoi).
 *
 * La PERSONNE est l'ensemble de ses candidatures à la même empreinte d'adresse : une
 * invitation par personne, et tout fait sur l'une (réservation, réponse, fiche ouverte)
 * vaut pour toutes.
 *
 * Module sans `server-only` ni import d'envoi : la relecture au départ (worker d'e-mails)
 * le lit sans tirer les files.
 */

import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { ERASED_PLACEHOLDER } from "@/lib/rgpd-erase";
import { estCandidatureFreelance } from "@/server/calendly/rattachement-formateur";

import { siretDuFormulaire } from "./controle-siret-candidature";

export const SELECT_CANDIDATURE_INVITATION = {
  id: true,
  email: true,
  emailHash: true,
  firstName: true,
  status: true,
  origine: true,
  submittedAt: true,
  offerTitleSnap: true,
  natureCollaboration: true,
  invitationFormateurAt: true,
  rattrapageAt: true,
  clotureSansSuiteAt: true,
  trainerId: true,
  answers: true,
  offer: {
    select: { slug: true, titleFr: true, employmentType: true, secondaryEmploymentType: true },
  },
} as const;

export interface CandidatureInvitation {
  id: string;
  email: string;
  emailHash: string | null;
  firstName: string;
  status: string;
  origine: string;
  submittedAt: Date;
  offerTitleSnap: string | null;
  natureCollaboration: string | null;
  invitationFormateurAt: Date | null;
  rattrapageAt: Date | null;
  clotureSansSuiteAt: Date | null;
  trainerId: string | null;
  /** Les réponses du formulaire (le SIRET y est, pour un formateur indépendant). */
  answers?: unknown;
  offer: {
    slug: string | null;
    titleFr: string | null;
    employmentType: string | null;
    secondaryEmploymentType: string | null;
  } | null;
}

export interface FaitsInvitation {
  readonly candidatureId: string;
  /** Adresse en clair (destinataire), ou `null` : effacée ou indéchiffrable. */
  readonly destinataire: string | null;
  readonly prenom: string | null;
  /** Identifiant de la personne : l'empreinte, sinon la candidature. */
  readonly personneId: string;
  readonly freelance: boolean;
  /** Une candidature de la personne a déjà reçu F1 ou F55. */
  readonly dejaInvitee: boolean;
  /** Un échange (formateur OU apporteur) a été réservé par la personne, même annulé. */
  readonly reserve: boolean;
  /** Une réponse HUMAINE de la personne, reçue après `depuis` (ou « répondu ailleurs »). */
  readonly reponseHumaine: boolean;
  /** Une fiche formateur est ouverte pour la personne. */
  readonly ficheOuverte: boolean;
  /**
   * Le dernier contrôle du registre d'une fiche de la personne est rouge. (Le SIRET du
   * FORMULAIRE, lui, se contrôle à part — `controle-siret-candidature.ts`, V1-A-1 : un appel
   * réseau, fait seulement pour une candidature qui pourrait partir.)
   */
  readonly registreRouge: boolean;
  /** Le SIRET (14 chiffres) saisi au formulaire, ou `null`. */
  readonly siret: string | null;
  readonly opposition: boolean;
  /** Rebond dur sur l'adresse (le verdict d'envoi la retiendrait de toute façon). */
  readonly adresseMorte: boolean;
  /** Décidée par Will (statut changé) ou close « sans suite ». */
  readonly decidee: boolean;
}

function dechiffrer(v: string): string | null {
  try {
    const t = decryptPii(v).trim();
    if (!t || t === ERASED_PLACEHOLDER || t.endsWith("@erased.local")) return null;
    return t;
  } catch {
    return null;
  }
}

/**
 * Lit les faits de ces candidatures, en lot. `depuis(c)` borne la réponse humaine (date de
 * l'invitation pour S1 ; `null` = toute réponse). Lève si la base ne répond pas.
 */
export async function lireFaitsInvitation(
  candidatures: readonly CandidatureInvitation[],
  depuis: (c: CandidatureInvitation) => Date | null,
): Promise<Map<string, FaitsInvitation>> {
  const sortie = new Map<string, FaitsInvitation>();
  if (candidatures.length === 0) return sortie;

  const empreintes = [
    ...new Set(candidatures.map((c) => c.emailHash).filter((h): h is string => !!h)),
  ];
  const soeurs = empreintes.length
    ? await prisma.jobApplication.findMany({
        where: { emailHash: { in: empreintes } },
        select: {
          id: true,
          emailHash: true,
          invitationFormateurAt: true,
          rattrapageAt: true,
          trainerId: true,
        },
      })
    : [];
  const lignesDe = (c: CandidatureInvitation): string[] => {
    const ids = c.emailHash
      ? soeurs.filter((s) => s.emailHash === c.emailHash).map((s) => s.id)
      : [];
    return [...new Set([c.id, ...ids])];
  };
  const toutes = [...new Set(candidatures.flatMap(lignesDe))];

  const [rdvCandidature, demandes, reponsesZoho, reponsesFormateur, fiches, oppositions] =
    await Promise.all([
      prisma.calendlyEvent.findMany({
        where: { linkedJobApplicationId: { in: toutes } },
        select: { linkedJobApplicationId: true },
      }),
      empreintes.length
        ? prisma.submission.findMany({
            where: { contactEmailHash: { in: empreintes } },
            select: { contactEmailHash: true, calendlyEvents: { select: { id: true }, take: 1 } },
          })
        : Promise.resolve([]),
      prisma.jobApplicationInboundReply.findMany({
        // V1-A-3 : une réponse « à vérifier » (adresse relais, candidature sans empreinte)
        // n'arrête rien avant le clic humain (« J'ai répondu ailleurs »).
        where: {
          applicationId: { in: toutes },
          auto: false,
          application: { emailHash: { not: null } },
        },
        select: { applicationId: true, receivedAt: true },
      }),
      prisma.reponseEntranteFormateur.findMany({
        where: { candidatureId: { in: toutes }, auto: false },
        select: { candidatureId: true, recuLe: true },
      }),
      prisma.trainer.findMany({
        where: { candidatureId: { in: toutes } },
        select: {
          candidatureId: true,
          verificationsRegistre: {
            orderBy: { verifieAt: "desc" },
            take: 1,
            select: { verdict: true },
          },
        },
      }),
      empreintes.length
        ? prisma.emailOpposition.findMany({
            where: { emailHash: { in: empreintes } },
            select: { emailHash: true },
          })
        : Promise.resolve([]),
    ]);

  const opposees = new Set(oppositions.map((o) => o.emailHash));
  const clairs = new Map(candidatures.map((c) => [c.id, dechiffrer(c.email)]));
  const adresses = [...new Set([...clairs.values()].filter((a): a is string => a !== null))];
  // `recipient` est citext : l'égalité ignore la casse (même lecture que le verdict d'envoi).
  const rebonds = adresses.length
    ? await prisma.emailLog.findMany({
        where: { recipient: { in: adresses }, status: "bounced", bounceType: "hard" },
        select: { recipient: true },
      })
    : [];
  const mortes = new Set(rebonds.map((r) => r.recipient.toLowerCase()));
  for (const c of candidatures) {
    const lignes = new Set(lignesDe(c));
    const borne = depuis(c);
    const apres = (d: Date) => borne === null || d.getTime() > borne.getTime();
    const destinataire = clairs.get(c.id) ?? null;
    const prenomBrut = dechiffrer(c.firstName);
    const fichesDeLaPersonne = fiches.filter((f) => f.candidatureId && lignes.has(f.candidatureId));
    sortie.set(c.id, {
      candidatureId: c.id,
      destinataire,
      prenom: prenomBrut,
      personneId: c.emailHash ?? c.id,
      freelance: estCandidatureFreelance(c),
      dejaInvitee:
        soeurs.some(
          (s) => lignes.has(s.id) && (s.invitationFormateurAt !== null || s.rattrapageAt !== null),
        ) ||
        c.invitationFormateurAt !== null ||
        c.rattrapageAt !== null,
      reserve:
        rdvCandidature.some(
          (r) => r.linkedJobApplicationId && lignes.has(r.linkedJobApplicationId),
        ) ||
        (c.emailHash !== null &&
          demandes.some((d) => d.contactEmailHash === c.emailHash && d.calendlyEvents.length > 0)),
      reponseHumaine:
        reponsesZoho.some((r) => lignes.has(r.applicationId) && apres(r.receivedAt)) ||
        reponsesFormateur.some(
          (r) => r.candidatureId !== null && lignes.has(r.candidatureId) && apres(r.recuLe),
        ),
      ficheOuverte:
        fichesDeLaPersonne.length > 0 ||
        soeurs.some((s) => lignes.has(s.id) && s.trainerId !== null) ||
        c.trainerId !== null,
      siret: siretDuFormulaire(c.answers),
      registreRouge: fichesDeLaPersonne.some(
        (f) => f.verificationsRegistre[0]?.verdict === "rouge",
      ),
      opposition: c.emailHash !== null && opposees.has(c.emailHash),
      adresseMorte: destinataire !== null && mortes.has(destinataire.toLowerCase()),
      decidee: c.status !== "new" || c.clotureSansSuiteAt !== null,
    });
  }
  return sortie;
}

/**
 * Peut-on inviter (F1 ou F55) ? `null` : oui ; sinon le motif, court et sans donnée
 * personnelle.
 */
export function motifNePasInviter(f: FaitsInvitation): string | null {
  if (!f.freelance) return "pas-freelance";
  if (f.destinataire === null) return "efface";
  if (f.opposition) return "opposition";
  if (f.adresseMorte) return "adresse-morte";
  if (f.decidee) return "decidee";
  if (f.dejaInvitee) return "deja-invitee";
  if (f.reserve) return "deja-reserve";
  // Will a déjà échangé avec la personne (réponse reçue ou « répondu ailleurs ») : ni F1 ni
  // F55 (« nous revenons vers vous » serait faux).
  if (f.reponseHumaine) return "deja-repondu";
  if (f.registreRouge) return "registre-rouge";
  if (f.ficheOuverte) return "fiche-ouverte";
  return null;
}

/**
 * Relecture AU DÉPART d'une invitation ou d'un rappel (`relecture-au-depart.ts`) : la
 * personne a-t-elle réservé, répondu, été décidée, depuis que l'e-mail a été enfilé ?
 * `null` : il peut partir. Lève si la base ne répond pas (l'appelant retient).
 */
export async function motifRetenueInvitationFormateur(
  candidatureId: string,
  gabarit: string,
): Promise<string | null> {
  const c = await prisma.jobApplication.findUnique({
    where: { id: candidatureId },
    select: SELECT_CANDIDATURE_INVITATION,
  });
  if (!c) return "candidature introuvable";
  const f = (await lireFaitsInvitation([c], (x) => x.invitationFormateurAt ?? x.rattrapageAt)).get(
    c.id,
  );
  if (!f) return "état invérifiable";
  if (f.decidee) return "candidature décidée ou close";
  if (f.reserve) return "échange déjà réservé";
  if (f.ficheOuverte) return "fiche formateur déjà ouverte";
  if (f.registreRouge) return "registre des entreprises : entreprise fermée";
  // Un rappel s'arrête sur une réponse humaine ; l'invitation elle-même, non.
  if (gabarit === "formateur-invitation-relance" && f.reponseHumaine)
    return "la personne a répondu";
  return null;
}
