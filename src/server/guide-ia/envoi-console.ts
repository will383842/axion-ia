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
 * ── Qui peut recevoir un envoi de la console ────────────────────────────────
 * « Votre guide » est exempté du verdict « désabonné » parce qu'il répond à une
 * DEMANDE. Un envoi à l'initiative de la console n'en est pas une : sans
 * demande du formulaire, seule une personne INSCRITE (`confirmed`) le reçoit.
 * Sont refusés, AVANT toute création de ligne `guide_requests` :
 *   · un désabonné          → `adresse-desabonnee` (il peut redemander le guide
 *                              lui-même sur le site) ;
 *   · un `pending`           → `inscription-non-confirmee` (ancien double
 *                              opt-in, jamais confirmé) ;
 *   · une opposition         → `adresse-opposee` (`email_oppositions`) ;
 *   · un rebond dur connu    → `adresse-rejetee` (même verdict que le
 *                              rattrapage : `email_logs`, pas seulement le
 *                              statut de l'abonné).
 * Une demande du FORMULAIRE garde son droit au renvoi (la personne l'a
 * demandé) : seul le rebond dur l'arrête. `refusConsole` est la règle, pure ;
 * les écrans l'appliquent pour masquer les boutons, les gestes pour refuser.
 *
 * ── Idempotence au-delà de la fenêtre ───────────────────────────────────────
 * La réservation ne tient que 10 minutes. Après elle, et AVANT la mise en
 * file, le journal est relu comme le fait le rattrapage : un `email_logs`
 * encore en file (`pending`), ou un e-mail garé en corbeille de validation,
 * suffit à rendre la réservation et à répondre `deja-en-file` — un e-mail
 * coincé dans une file lente n'est pas une raison d'en mettre un second.
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
import { verdictAvantEnvoi } from "@/server/email/verdict-envoi";
import { AIMANT_GUIDE_IA, GABARIT_GUIDE } from "./config";
import { mettreEnFileGuide, type ResultatEnvoiGuide } from "./envoi";
import { lettreDansLEmail } from "./lettre";
import { estGareeEnValidation, etatJournal } from "./rattrapage";
import {
  LIBELLE_REFUS_CONSOLE,
  refusConsole,
  type EtatAdresseConsole,
  type RefusConsole,
} from "./refus-console";

export {
  LIBELLE_REFUS_CONSOLE,
  refusConsole,
  type EtatAdresseConsole,
  type RefusConsole,
} from "./refus-console";

/** Fenêtre pendant laquelle un second clic ne renvoie rien. */
export const FENETRE_ANTI_DOUBLON_CONSOLE_MS = 10 * 60_000;

/** Version portée par une demande créée depuis la console (aucun texte n'a été affiché). */
export const VERSION_ORIGINE_CONSOLE = "console-admin-v1-2026-09-24";

/** Provenance d'une demande créée depuis la console. */
export const SOURCE_CONSOLE = "console";

export type ResultatEnvoiConsole =
  | ResultatEnvoiGuide
  | RefusConsole
  /** « Envoyer » sur une personne qui a déjà reçu le guide : rien ne part. */
  | "deja-envoye"
  /** Un envoi est déjà en file (réservation, journal ou corbeille) : rien ne part. */
  | "deja-en-file"
  | "introuvable";

/**
 * Lit l'état d'une adresse : opposition (empreinte HMAC) et rebond dur (le
 * MÊME verdict que le rattrapage et l'enfilage, avec le contexte du guide —
 * non marketing, donc seul le rebond dur y compte).
 */
export async function lireEtatAdresse(
  email: string,
  statut: EtatAdresseConsole["statut"],
): Promise<EtatAdresseConsole> {
  const empreinte = hashEmailForLookup(email);
  const [opposition, verdict] = await Promise.all([
    empreinte === null
      ? Promise.resolve(null)
      : prisma.emailOpposition.findUnique({
          where: { emailHash: empreinte },
          select: { id: true },
        }),
    verdictAvantEnvoi(email, { template: GABARIT_GUIDE, marketing: false }),
  ]);
  return {
    statut,
    opposee: opposition !== null,
    rebondDur: verdict.retenu && verdict.motif === "rebond_dur",
  };
}

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
  readonly origine: "formulaire" | "admin";
  readonly queuedAt: Date | null;
  readonly sentAt: Date | null;
}

const SELECTION = {
  id: true,
  email: true,
  locale: true,
  downloadToken: true,
  origine: true,
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

/** Réserve, relit le journal, met en file, et rend la place si rien n'est parti. */
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

  // Rend la réservation : un nouveau clic (après la cause levée) ne doit pas
  // se heurter à « déjà en file ». Conditionnel : si `mettreEnFileGuide` a
  // réécrit `queued_at` entre-temps, on n'y touche pas.
  const rendre = (): Promise<unknown> =>
    prisma.guideRequest
      .updateMany({
        where: { id: demande.id, queuedAt: maintenant },
        data: { queuedAt: precedent },
      })
      .catch(() => undefined);

  let resultat: ResultatEnvoiConsole | undefined;
  try {
    // 🔴 Au-delà des 10 minutes de la réservation, le journal fait foi, comme
    // pour le rattrapage : un e-mail encore en file ou garé en validation ne
    // s'en voit pas ajouter un second. Pour « envoyer », un e-mail déjà parti
    // (ligne `sent` dont la clôture n'a pas été consignée) vaut « déjà
    // envoyé » ; pour « renvoyer », c'est justement ce qu'on renvoie.
    const [journal, garee] = await Promise.all([
      etatJournal(demande.id),
      estGareeEnValidation(demande.id),
    ]);
    if (mode === "envoyer" && journal.envoye !== null) {
      resultat = "deja-envoye";
      return resultat;
    }
    if (journal.enFile || garee) {
      resultat = "deja-en-file";
      return resultat;
    }

    const lettre = await lettreDansLEmail(demande.email);
    resultat = await mettreEnFileGuide(
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
    if (resultat === "non-parti") {
      // L'enfilage a pu retenir l'e-mail pour un rebond dur apparu entre le
      // contrôle et la mise en file : le dire tel quel, pas « réessayez ».
      const verdict = await verdictAvantEnvoi(demande.email, {
        template: GABARIT_GUIDE,
        marketing: false,
      });
      if (verdict.retenu && verdict.motif === "rebond_dur") resultat = "adresse-rejetee";
    }
    return resultat;
  } finally {
    // `finally` : une mise en file qui LÈVE rend aussi la réservation — sans
    // quoi la demande resterait « en file » dix minutes sans que rien ne parte.
    if (resultat !== "en-file" && resultat !== "en-validation") await rendre();
  }
}

/** L'abonné ou la demande a-t-il le droit de recevoir un envoi console ? */
async function controler(
  email: string,
  statut: EtatAdresseConsole["statut"],
  origine: "formulaire" | "admin" | null,
): Promise<RefusConsole | "introuvable" | null> {
  return refusConsole(await lireEtatAdresse(email, statut), origine);
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

  const emailKey = hashEmailForLookup(abonne.email);
  if (!emailKey) return { resultat: "introuvable", demandeId: null, creee: false };
  const cle = { emailKey_aimant: { emailKey, aimant: AIMANT_GUIDE_IA } };

  let demande = await prisma.guideRequest.findUnique({ where: cle, select: SELECTION });

  // 🔴 Contrôlé AVANT de créer la ligne : un refus ne laisse aucune demande
  // derrière lui (une ligne `admin` créée pour rien apparaîtrait « en
  // attente » sur l'écran des demandes).
  const refus = await controler(abonne.email, abonne.status, demande?.origine ?? null);
  if (refus !== null) {
    return { resultat: refus, demandeId: demande?.id ?? null, creee: false };
  }

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
  // Demande du formulaire : la personne l'a demandé, seul le rebond dur
  // l'arrête. Demande console : les mêmes contrôles qu'à l'envoi.
  const refus = await controler(demande.email, abonne?.status ?? null, demande.origine);
  if (refus !== null) return { resultat: refus, demandeId, creee: false };

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
  "deja-en-file": "Un envoi du guide est déjà en file : rien de plus n'est parti.",
  ...LIBELLE_REFUS_CONSOLE,
  introuvable: "Introuvable : la fiche a peut-être été effacée.",
};
