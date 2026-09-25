/**
 * LA LETTRE, quand quelqu'un demande le guide (lot L2, amendement de Will du 24/09).
 *
 * N'est appelée que s'il y a une BASE pour inscrire (décidée par `demande.ts`,
 * côté serveur, d'après la nature de l'adresse) :
 *   · `interet-legitime` — adresse professionnelle : inscription automatique ;
 *     la preuve est l'INFORMATION donnée (mention versionnée) ;
 *   · `consentement`     — adresse personnelle ET case cochée ; la preuve est
 *     le texte de la case (versionné).
 * Adresse personnelle sans la case : cette fonction n'est pas appelée, et
 * aucune ligne `newsletter_subscribers` n'est créée.
 *
 * Aucun double opt-in (amendement) : l'inscription vaut tout de suite, et la
 * preuve s'écrit ICI, au registre `consent_events`.
 *
 * Situations, et ce qu'on en fait :
 *   · inconnue               → `confirmed`, preuve écrite ;
 *   · `pending` (ancien flux) → `confirmed`, preuve écrite ;
 *   · `confirmed`             → rien : déjà inscrite ;
 *   · `unsubscribed`          → 🔴 RIEN SUR LE STATUT. Voir plus bas ;
 *   · `bounced`               → rien : l'adresse ne reçoit pas.
 *
 * 🔴 UNE OPPOSITION NE SE LÈVE PAS PAR UNE DEMANDE DU GUIDE. N'importe qui peut
 * saisir l'adresse d'un tiers (Turnstile arrête les robots, pas les humains).
 * Remettre un désabonné en liste, ou même effacer sa date de désabonnement,
 * annulerait son opposition dans son dos — et la liste de suppression de
 * demain (MailWizz) ne le verrait plus. On ne fait donc que POSER un jeton :
 * l'e-mail « Votre guide » lui PROPOSE de revenir, et seul le clic sur le
 * bouton de la page qui suit (un POST, `confirmerLettre`) le réinscrit. Un
 * jeton déjà posé est GARDÉ : le lien d'un e-mail précédent reste valable, et
 * redemander ne renouvelle rien.
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { recordConsentEvent } from "@/lib/consents";
import { FORM_REF_REINSCRIPTION, VERSION_REINSCRIPTION } from "@/content/guide-ia-formulaire";

export type BaseLettre = "interet-legitime" | "consentement";

export interface InscriptionLettre {
  readonly email: string;
  readonly locale: "fr" | "en";
  readonly source: string | null;
  readonly base: BaseLettre;
  /** Référence du point de collecte (`consent_events.form_ref`). */
  readonly formRef: string;
  /** Version du texte : la mention (intérêt légitime) ou la case (consentement). */
  readonly version: string;
  /** Empreinte d'IP gardée sur la ligne d'abonné. */
  readonly ipHash: string | null;
  /** IP et agent du geste, hachés par le registre de preuve. */
  readonly ip?: string | null;
  readonly userAgent?: string | null;
  readonly maintenant?: Date;
}

export type ResultatInscriptionLettre =
  | { readonly etat: "inscrite"; readonly id: string; readonly nouvelle: boolean }
  | { readonly etat: "deja-abonnee"; readonly id: string }
  | { readonly etat: "reinscription-proposee"; readonly id: string }
  | { readonly etat: "opposition-maintenue"; readonly id: string };

function jeton(): string {
  return crypto.randomBytes(32).toString("hex");
}

function estConflitUnique(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

async function ecrirePreuve(entree: InscriptionLettre, quand: Date): Promise<void> {
  await recordConsentEvent({
    email: entree.email,
    formRef: entree.formRef,
    consentVersion: entree.version,
    action: entree.base === "consentement" ? "optin" : "information",
    occurredAt: quand,
    ip: entree.ip ?? null,
    userAgent: entree.userAgent ?? null,
  });
}

export async function inscrireALaLettre(
  entree: InscriptionLettre,
  tentative = 0,
): Promise<ResultatInscriptionLettre> {
  const maintenant = entree.maintenant ?? new Date();
  const existante = await prisma.newsletterSubscriber.findUnique({
    where: { email: entree.email },
    select: { id: true, status: true, unsubscribeToken: true, confirmToken: true },
  });

  if (existante === null) {
    try {
      const creee = await prisma.newsletterSubscriber.create({
        data: {
          email: entree.email,
          locale: entree.locale,
          status: "confirmed",
          confirmedAt: maintenant,
          unsubscribeToken: jeton(),
          source: entree.source,
          ipHash: entree.ipHash,
          consentFormRef: entree.formRef,
          consentVersion: entree.version,
        },
        select: { id: true },
      });
      await ecrirePreuve(entree, maintenant);
      return { etat: "inscrite", id: creee.id, nouvelle: true };
    } catch (e) {
      // Deux demandes simultanées de la même adresse : la seconde relit.
      if (!estConflitUnique(e) || tentative > 0) throw e;
      return inscrireALaLettre(entree, tentative + 1);
    }
  }

  switch (existante.status) {
    case "confirmed":
      return { etat: "deja-abonnee", id: existante.id };

    case "bounced":
      return { etat: "opposition-maintenue", id: existante.id };

    case "unsubscribed": {
      // Statut et date de désabonnement INTACTS. Un jeton déjà posé est gardé.
      if (!existante.confirmToken) {
        await prisma.newsletterSubscriber.updateMany({
          where: { id: existante.id, status: "unsubscribed", confirmToken: null },
          data: {
            confirmToken: jeton(),
            confirmSentAt: null,
            consentFormRef: FORM_REF_REINSCRIPTION,
            consentVersion: VERSION_REINSCRIPTION,
          },
        });
      }
      return { etat: "reinscription-proposee", id: existante.id };
    }

    default: {
      // `pending` : inscription de l'ancien double opt-in, jamais confirmée. La
      // nouvelle base (information ou case cochée) l'inscrit maintenant.
      const r = await prisma.newsletterSubscriber.updateMany({
        where: { id: existante.id, status: "pending" },
        data: {
          status: "confirmed",
          confirmedAt: maintenant,
          confirmToken: null,
          locale: entree.locale,
          consentFormRef: entree.formRef,
          consentVersion: entree.version,
          // Le jeton de désabonnement est CONSERVÉ s'il existe : les anciens
          // liens « se désabonner » doivent continuer de fonctionner.
          ...(existante.unsubscribeToken ? {} : { unsubscribeToken: jeton() }),
          ...(entree.ipHash ? { ipHash: entree.ipHash } : {}),
        },
      });
      if (r.count > 0) await ecrirePreuve(entree, maintenant);
      return { etat: "inscrite", id: existante.id, nouvelle: false };
    }
  }
}

/** Ce que l'e-mail « Votre guide » doit porter pour la lettre, d'après la ligne d'abonné. */
export interface LettreDansLEmail {
  /** Abonnée : lien « Se désabonner » visible, et en-tête One-Click (RFC 8058). */
  readonly unsubscribeToken?: string;
  /** Désabonnée à qui l'on propose de revenir : le bouton de confirmation. */
  readonly confirmToken?: string;
}

/**
 * Lu au moment de mettre l'e-mail en file (formulaire ET rattrapage). Sélection
 * EXPLICITE des colonnes historiques : le rattrapage tourne dans le worker, qui
 * peut atterrir avant la migration des nouvelles colonnes.
 */
export async function lettreDansLEmail(email: string): Promise<LettreDansLEmail> {
  const abonne = await prisma.newsletterSubscriber.findUnique({
    where: { email },
    select: { status: true, unsubscribeToken: true, confirmToken: true },
  });
  if (abonne === null) return {};
  if (abonne.status === "confirmed" && abonne.unsubscribeToken) {
    return { unsubscribeToken: abonne.unsubscribeToken };
  }
  if (abonne.status === "unsubscribed" && abonne.confirmToken) {
    return { confirmToken: abonne.confirmToken };
  }
  return {};
}
