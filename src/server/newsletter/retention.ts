/**
 * DURÉES DE CONSERVATION DE LA LETTRE ET DU GUIDE (lot L6, 2026-09-25).
 *
 * Appelé par la purge quotidienne existante (`retention-purge-worker.ts`,
 * 03:00 UTC) — aucun planificateur de plus. Trois règles, chacune celle que la
 * politique de confidentialité ANNONCE (`src/content/legal.ts`, section « Guide
 * IA entreprise et lettre d'information ») :
 *
 *   1. inscription `pending` jamais confirmée (ancien double opt-in) : 30 jours ;
 *   2. abonné `confirmed` sans contact depuis 3 ans : supprimé ;
 *   3. demande du guide sans contact depuis 3 ans : supprimée ;
 *   4. journal d'envoi (`email_logs`) de l'e-mail « Votre guide » et de la
 *      confirmation de la lettre : 3 ans. Ces gabarits sont transactionnels
 *      (`marketing: false`), donc gardés 5 ans par la règle générale — durée
 *      des PIÈCES Qualiopi dont ce journal est la preuve d'envoi. Un envoi du
 *      guide ne prouve aucune pièce : son adresse en clair ne doit pas survivre
 *      deux ans à la demande elle-même.
 *
 * ## « Dernier contact » — le choix, et pourquoi
 *
 * Le référentiel CNIL « gestion des activités commerciales » compte 3 ans à
 * partir du dernier contact **émanant de la personne**. On ne retient donc que
 * les dates où la personne a agi, ou demandé que l'on agisse :
 *
 *   · abonné : `createdAt` (inscription), `confirmedAt` (confirmation ou
 *     réinscription), `lastClickAt` (clic dans une lettre), et toute demande du
 *     guide faite depuis la même adresse (`guide_requests` : `createdAt`,
 *     `queuedAt`, `firstClickAt`) — redemander le guide est un contact ;
 *   · demande du guide : `createdAt`, `queuedAt` (chaque nouvelle demande
 *     repasse sur la même ligne et avance cette date ; un renvoi depuis la
 *     console aussi), `sentAt`, `firstClickAt` (clic sur le bouton de
 *     téléchargement).
 *
 * ⛔ Ce qui N'EST PAS un contact, à dessein :
 *   · `lastSentAt` — une lettre ENVOYÉE sans réponse. La compter ferait de
 *     chaque envoi une prolongation automatique : la liste ne vieillirait
 *     jamais, et l'inactivité à 3 ans ne s'appliquerait à personne ;
 *   · `firstSeenAt` — le premier GET du lien personnel, qu'un antivirus
 *     (Safe Links, prévisualisation) déclenche sans la personne ;
 *   · `updatedAt` — n'importe quelle écriture technique l'avance.
 *
 * ## Ce qui n'est JAMAIS purgé ici
 *
 * `consent_events` (registre de preuve, append-only), `email_oppositions`
 * (liste d'opposition), les abonnés `unsubscribed` (règle des 36 mois déjà
 * appliquée par le worker, avec trace) et `bounced` (suppression pour rebond),
 * et les fiches `Prospection*` (décision de Will du 2026-08-20). Verrou :
 * `src/server/newsletter/__tests__/retention.spec.ts`.
 *
 * ## Journal
 *
 * Des COMPTES seulement, jamais d'adresse ni d'empreinte : une purge par âge ne
 * répond à aucune demande individuelle, rien ne justifie d'en garder la liste.
 *
 * ⚠️ `deleteMany` seulement : il ne relit aucune colonne (pas de RETURNING *),
 * donc il tolère la fenêtre où le worker tourne un code plus récent que le
 * schéma migré par l'app.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../prisma/generated/client";

export const DUREES_LETTRE_GUIDE = {
  /** `pending` jamais confirmé — « inscription jamais confirmée (ancien parcours), 30 jours ». */
  pendingJours: 30,
  /** Abonné confirmé — « 3 ans après votre dernier contact avec nous ». */
  abonneInactifMois: 36,
  /** Demande du guide — « 3 ans après votre dernier contact avec nous ». */
  demandeGuideMois: 36,
} as const;

export interface DureesLettreGuide {
  readonly pendingJours: number;
  readonly abonneInactifMois: number;
  readonly demandeGuideMois: number;
}

export interface ResultatPurgeLettreGuide {
  readonly pendingPurges: number;
  readonly abonnesInactifsPurges: number;
  /** Abonnés au-delà du seuil, gardés parce qu'une demande du guide récente les rattache. */
  readonly abonnesGardesParDemandeRecente: number;
  readonly demandesGuidePurgees: number;
  readonly journauxEnvoiPurges: number;
}

/** Gabarits dont le journal suit la durée de la lettre et du guide, pas celle des pièces. */
export const GABARITS_LETTRE_GUIDE = ["guide-ia-envoi", "newsletter-confirm-optin"] as const;

function moisAvant(maintenant: Date, mois: number): Date {
  const d = new Date(maintenant.getTime());
  d.setUTCMonth(d.getUTCMonth() - mois);
  return d;
}

function joursAvant(maintenant: Date, jours: number): Date {
  return new Date(maintenant.getTime() - jours * 86_400_000);
}

/** Une date absente ou antérieure à la limite : la condition « pas de contact depuis ». */
function avantAbonne(
  champ: "confirmSentAt" | "confirmedAt" | "lastClickAt",
  limite: Date,
): Prisma.NewsletterSubscriberWhereInput {
  return { OR: [{ [champ]: null }, { [champ]: { lt: limite } }] };
}

function avantDemande(
  champ: "queuedAt" | "sentAt" | "firstClickAt",
  limite: Date,
): Prisma.GuideRequestWhereInput {
  return { OR: [{ [champ]: null }, { [champ]: { lt: limite } }] };
}

/** Lit une durée d'environnement ; toute valeur < 1 retombe sur le défaut (anti-misconfig). */
export function lireDuree(nom: string, defaut: number): number {
  const brut = process.env[nom];
  if (!brut) return defaut;
  const n = parseInt(brut, 10);
  return Number.isFinite(n) && n >= 1 ? n : defaut;
}

export function dureesDepuisEnvironnement(): DureesLettreGuide {
  return {
    pendingJours: lireDuree("RETENTION_NEWSLETTER_PENDING_DAYS", DUREES_LETTRE_GUIDE.pendingJours),
    abonneInactifMois: lireDuree(
      "RETENTION_NEWSLETTER_INACTIVE_MONTHS",
      DUREES_LETTRE_GUIDE.abonneInactifMois,
    ),
    demandeGuideMois: lireDuree(
      "RETENTION_GUIDE_REQUESTS_MONTHS",
      DUREES_LETTRE_GUIDE.demandeGuideMois,
    ),
  };
}

const LOT = 500;

export async function purgerLettreEtGuide(
  maintenant: Date = new Date(),
  durees: DureesLettreGuide = dureesDepuisEnvironnement(),
): Promise<ResultatPurgeLettreGuide> {
  // 1) `pending` : ni créé, ni relancé depuis 30 jours.
  const limitePending = joursAvant(maintenant, durees.pendingJours);
  const pending = await prisma.newsletterSubscriber.deleteMany({
    where: {
      status: "pending",
      createdAt: { lt: limitePending },
      AND: [avantAbonne("confirmSentAt", limitePending)],
    },
  });

  // 2) abonnés confirmés sans contact depuis 3 ans.
  const limiteAbonne = moisAvant(maintenant, durees.abonneInactifMois);
  const clauseInactif: Prisma.NewsletterSubscriberWhereInput = {
    status: "confirmed",
    createdAt: { lt: limiteAbonne },
    AND: [avantAbonne("confirmedAt", limiteAbonne), avantAbonne("lastClickAt", limiteAbonne)],
  };
  const candidats = await prisma.newsletterSubscriber.findMany({
    where: clauseInactif,
    select: { id: true, email: true },
  });

  let abonnesInactifsPurges = 0;
  let abonnesGardesParDemandeRecente = 0;
  for (let i = 0; i < candidats.length; i += LOT) {
    const lot = candidats.slice(i, i + LOT);
    // Une demande du guide récente depuis la même adresse est un contact.
    const recentes = await prisma.guideRequest.findMany({
      where: {
        email: { in: lot.map((c) => c.email) },
        OR: [
          { createdAt: { gte: limiteAbonne } },
          { queuedAt: { gte: limiteAbonne } },
          { firstClickAt: { gte: limiteAbonne } },
        ],
      },
      select: { email: true },
    });
    // `email` est en `citext` : la base compare sans la casse, on fait de même.
    const actives = new Set(recentes.map((r) => r.email.toLowerCase()));
    const ids = lot.filter((c) => !actives.has(c.email.toLowerCase())).map((c) => c.id);
    abonnesGardesParDemandeRecente += lot.length - ids.length;
    if (ids.length === 0) continue;
    // La clause d'inactivité est REJOUÉE dans la suppression : un clic arrivé
    // entre la lecture et l'écriture garde la ligne.
    const r = await prisma.newsletterSubscriber.deleteMany({
      where: { id: { in: ids }, ...clauseInactif },
    });
    abonnesInactifsPurges += r.count;
  }

  // 3) demandes du guide sans contact depuis 3 ans.
  const limiteGuide = moisAvant(maintenant, durees.demandeGuideMois);
  const guide = await prisma.guideRequest.deleteMany({
    where: {
      createdAt: { lt: limiteGuide },
      AND: [
        avantDemande("queuedAt", limiteGuide),
        avantDemande("sentAt", limiteGuide),
        avantDemande("firstClickAt", limiteGuide),
      ],
    },
  });

  // 4) journaux d'envoi du guide et de la confirmation de la lettre.
  const journaux = await prisma.emailLog.deleteMany({
    where: { template: { in: [...GABARITS_LETTRE_GUIDE] }, createdAt: { lt: limiteGuide } },
  });

  return {
    pendingPurges: pending.count,
    abonnesInactifsPurges,
    abonnesGardesParDemandeRecente,
    demandesGuidePurgees: guide.count,
    journauxEnvoiPurges: journaux.count,
  };
}
