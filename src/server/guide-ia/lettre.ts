/**
 * INSCRIPTION À LA LETTRE depuis le formulaire du guide (lot L2, 2026-09-24).
 *
 * N'est appelée QUE si la case facultative, décochée par défaut, a été cochée.
 * Case décochée ⇒ aucune ligne `newsletter_subscribers` : une demande du guide
 * n'est pas un abonnement (décision n° 1 de Will, RGPD art. 7.4).
 *
 * Quatre situations, et ce qu'on en fait :
 *   · inconnue            → `pending`, jeton de confirmation neuf ;
 *   · `pending`           → jeton RENOUVELÉ (l'ancien lien ne vaut plus) ;
 *   · `confirmed`         → rien : déjà abonnée, aucun bouton de confirmation ;
 *   · `unsubscribed` /
 *     `bounced`           → RÉINSCRIPTION : retour à `pending`, nouveau jeton.
 *
 * 🔴 La réinscription était IMPOSSIBLE : l'upsert ne touchait jamais `status`,
 * puis la confirmation répondait « cet e-mail s'est précédemment désinscrit »,
 * sans issue. Une personne qui revient donner son accord doit pouvoir le faire —
 * et c'est un NOUVEL accord : il repasse par le double opt-in, et le registre de
 * preuve ajoutera une ligne `optin` à la confirmation, APRÈS l'`optout` déjà
 * écrit. L'historique raconte les deux.
 *
 * Le consentement n'est PAS écrit ici : il ne vaut qu'à la confirmation.
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export interface InscriptionLettre {
  readonly email: string;
  readonly locale: "fr" | "en";
  readonly source: string | null;
  readonly ipHash: string | null;
  readonly formRef: string;
  readonly version: string;
}

export type ResultatInscriptionLettre =
  | {
      readonly etat: "a-confirmer";
      readonly id: string;
      readonly confirmToken: string;
      readonly nouvelle: boolean;
    }
  | { readonly etat: "deja-abonnee"; readonly id: string };

function jeton(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function inscrireALaLettre(
  entree: InscriptionLettre,
): Promise<ResultatInscriptionLettre> {
  const existante = await prisma.newsletterSubscriber.findUnique({
    where: { email: entree.email },
    select: { id: true, status: true, unsubscribeToken: true },
  });

  if (existante === null) {
    const confirmToken = jeton();
    const creee = await prisma.newsletterSubscriber.create({
      data: {
        email: entree.email,
        locale: entree.locale,
        status: "pending",
        confirmToken,
        unsubscribeToken: jeton(),
        source: entree.source,
        ipHash: entree.ipHash,
        consentFormRef: entree.formRef,
        consentVersion: entree.version,
      },
      select: { id: true },
    });
    return { etat: "a-confirmer", id: creee.id, confirmToken, nouvelle: true };
  }

  if (existante.status === "confirmed") {
    return { etat: "deja-abonnee", id: existante.id };
  }

  // `pending`, `unsubscribed` ou `bounced` : un nouvel accord est demandé.
  const confirmToken = jeton();
  await prisma.newsletterSubscriber.update({
    where: { id: existante.id },
    data: {
      status: "pending",
      confirmToken,
      confirmSentAt: null,
      confirmedAt: null,
      unsubscribedAt: null,
      locale: entree.locale,
      consentFormRef: entree.formRef,
      consentVersion: entree.version,
      // Le jeton de désabonnement est CONSERVÉ s'il existe : les anciens liens
      // « se désabonner » doivent continuer de fonctionner.
      ...(existante.unsubscribeToken ? {} : { unsubscribeToken: jeton() }),
      ...(entree.ipHash ? { ipHash: entree.ipHash } : {}),
    },
    select: { id: true },
  });
  return { etat: "a-confirmer", id: existante.id, confirmToken, nouvelle: false };
}
