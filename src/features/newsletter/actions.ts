// Lettre d'information — Server Actions (Sprint 15 / M8, refondu au lot L2).
//
// 🔴 Lot L2 (2026-09-24) — `subscribeNewsletterAction` N'EXISTE PLUS. Le seul
// point d'entrée est le formulaire du guide (`features/guide-ia/actions.ts`) :
// le guide part tout de suite, et la lettre suit la nature de l'adresse
// (amendement de Will du 24/09 : adresse pro → intérêt légitime ; adresse
// perso → case facultative, décochée). Plus de double opt-in pour les
// nouvelles inscriptions.
//
// Ce module garde :
//   · `confirmNewsletterAction` — appelée par le bouton (POST) de la page de
//     confirmation, JAMAIS au rendu d'un GET (les scanneurs de liens des
//     messageries d'entreprise confirmaient à la place de la personne) ;
//   · `unsubscribeNewsletterAction` — RFC 8058.
//
// Droit : le double opt-in n'est PAS une obligation légale en France. Depuis
// l'amendement, la preuve est écrite à la demande (`consent_events`) : le
// texte présenté, sa version, l'horodatage, les empreintes IP et agent.

"use server";

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { desabonnerAbonne } from "@/server/newsletter/desabonner";

// `confirmNewsletterAction` a quitté ce fichier au lot L2 (2026-09-24) :
// elle vit dans `server/newsletter/confirmer.ts`, appelée par la route POST
// `/api/newsletter/confirmer`. Exportée d'un fichier `"use server"`, elle était
// une Server Action appelable par n'importe quel client — et la preuve qu'elle
// écrit (IP et agent hachés) ne peut pas venir d'arguments fournis par lui.

// ============================================================
// unsubscribeNewsletterAction — P0-5 fix (RFC 8058 list-unsubscribe)
// ============================================================
//
// Consomme l'unsubscribeToken du lien email / header List-Unsubscribe-Post.
// Au succès : status='unsubscribed', unsubscribedAt=now(). Token CONSERVÉ
// pour journal d'audit + idempotency. RGPD : on ne supprime pas la ligne
// (preuve de retrait), on flag uniquement.

export type UnsubscribeState =
  | { ok: true; alreadyUnsubscribed: boolean; email: string }
  | { ok: false; error: "missing_token" | "invalid_token" | "internal" };

export async function unsubscribeNewsletterAction(token: string | null): Promise<UnsubscribeState> {
  if (!token || typeof token !== "string" || token.length < 16) {
    return { ok: false, error: "missing_token" };
  }
  try {
    const sub = await prisma.newsletterSubscriber.findUnique({
      where: { unsubscribeToken: token },
    });
    if (!sub) return { ok: false, error: "invalid_token" };
    if (sub.status === "unsubscribed") {
      return { ok: true, alreadyUnsubscribed: true, email: sub.email };
    }
    // Lot L3 (2026-09-24) : le MÊME chemin que le bouton de la console —
    // statut, opposition au CRM, preuve `optout` au registre, Telegram. Les
    // deux ne peuvent plus diverger (`server/newsletter/desabonner.ts`).
    await desabonnerAbonne(
      {
        id: sub.id,
        email: sub.email,
        locale: sub.locale,
        consentFormRef: sub.consentFormRef,
        consentVersion: sub.consentVersion,
      },
      "unsubscribe-link",
    );
    return { ok: true, alreadyUnsubscribed: false, email: sub.email };
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: "internal" };
  }
}
