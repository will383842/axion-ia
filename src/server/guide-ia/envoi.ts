/**
 * MISE EN FILE DE L'E-MAIL « VOTRE GUIDE », derrière ses garde-fous (lot L2).
 *
 * Un seul chemin pour les trois appelants — le formulaire, le rattrapage
 * horaire, et demain le bouton de la console (lot L3) — pour qu'aucun des trois
 * ne contourne une borne. Dans l'ordre :
 *
 *   1. coupe-circuit (rebonds durs en série)  → rien ne part ;
 *   2. 3 envois par destinataire sur 24 h      → rien ne part ;
 *   3. plafond horaire du guide                → la demande ATTEND le rattrapage ;
 *   4. mise en file, priorité basse (les factures passent devant) ;
 *   5. `queued_at` posé SEULEMENT si la mise en file a réussi (la trace suit
 *      l'envoi, jamais l'intention — même contrat que `confirmSentAt`).
 *
 * `sent_at` et `send_count` ne sont PAS écrits ici : c'est le worker qui les
 * pose, après l'envoi réel (`journal.ts`). Une mise en file n'est pas un envoi.
 *
 * Les bornes 2 et 3 se comptent dans `email_logs` (une ligne `pending` est
 * posée à chaque mise en file) : une seule source, lisible par l'app et le
 * worker, sans compteur Redis qui divergerait.
 */

import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";
import { coupeCircuitDeclenche } from "./coupe-circuit";
import {
  ENTITE_GUIDE,
  FENETRE_DESTINATAIRE_MS,
  GABARIT_GUIDE,
  LIMITE_PAR_DESTINATAIRE,
  PLAFOND_HORAIRE_GUIDE,
  PRIORITE_GUIDE,
} from "./config";

export interface DemandeAEnvoyer {
  readonly id: string;
  readonly email: string;
  readonly locale: "fr" | "en";
  readonly downloadToken: string;
}

export interface OptionsEnvoiGuide {
  /** Jeton de confirmation de la lettre — présent si la case était cochée et l'abonné en attente. */
  readonly confirmToken?: string | null;
  /** Phrase de reprise « inscrit avant la parution du guide » (envoi unique, lot L7). */
  readonly reprise?: boolean;
  readonly maintenant?: Date;
}

export type ResultatEnvoiGuide =
  "en-file" | "en-validation" | "suspendu" | "limite-destinataire" | "plafond" | "non-parti";

/** Nombre d'e-mails du guide mis en file vers ce destinataire sur la fenêtre. */
export async function envoisRecentsVers(email: string, maintenant: Date): Promise<number> {
  return prisma.emailLog.count({
    where: {
      template: GABARIT_GUIDE,
      recipient: email,
      createdAt: { gte: new Date(maintenant.getTime() - FENETRE_DESTINATAIRE_MS) },
    },
  });
}

/** Nombre d'e-mails du guide mis en file, toutes adresses, sur la dernière heure. */
export async function envoisDeLaDerniereHeure(maintenant: Date): Promise<number> {
  return prisma.emailLog.count({
    where: {
      template: GABARIT_GUIDE,
      createdAt: { gte: new Date(maintenant.getTime() - 3_600_000) },
    },
  });
}

export async function mettreEnFileGuide(
  demande: DemandeAEnvoyer,
  options: OptionsEnvoiGuide = {},
): Promise<ResultatEnvoiGuide> {
  const maintenant = options.maintenant ?? new Date();

  if (await coupeCircuitDeclenche(maintenant)) return "suspendu";
  if ((await envoisRecentsVers(demande.email, maintenant)) >= LIMITE_PAR_DESTINATAIRE) {
    return "limite-destinataire";
  }
  if ((await envoisDeLaDerniereHeure(maintenant)) >= PLAFOND_HORAIRE_GUIDE) return "plafond";

  const payload: Record<string, unknown> = { downloadToken: demande.downloadToken };
  if (options.confirmToken) payload["confirmToken"] = options.confirmToken;
  if (options.reprise === true) payload["reprise"] = true;

  // ⛔ JAMAIS `marketing: true` : « Votre guide » répond à une demande
  // (transactionnel, RGPD 6.1.b), part depuis `contact@` par ZeptoMail, dont
  // les conditions interdisent la lettre d'information. Gardé par
  // `aucune-lettre-par-zeptomail.spec.ts`.
  // Nom du gabarit en LITTÉRAL (= `GABARIT_GUIDE`) : le catalogue des e-mails
  // et la garde « aucune lettre par ZeptoMail » lisent les appels dans le code.
  const envoi = await enqueueEmail("guide-ia-envoi", demande.email, demande.locale, payload, {
    entityType: ENTITE_GUIDE,
    entityId: demande.id,
    priority: PRIORITE_GUIDE,
  });

  if (envoi.garePourValidation === true) {
    // Une règle de la console retient ce gabarit pour relecture : l'e-mail
    // partira depuis la corbeille. `queued_at` est posé pour que le rattrapage
    // ne le gare pas une seconde fois dans l'heure.
    await prisma.guideRequest
      .update({ where: { id: demande.id }, data: { queuedAt: maintenant } })
      .catch(() => undefined);
    return "en-validation";
  }
  if (!envoi.enqueued) {
    console.error(
      `[guide-ia] « Votre guide » NON mis en file (${
        envoi.retenu ?? (envoi.corbeilleIndisponible === true ? "corbeille" : "file")
      }) — la demande reste en attente ; le rattrapage la reprendra si la cause est passagère.`,
    );
    return "non-parti";
  }

  await prisma.guideRequest
    .update({ where: { id: demande.id }, data: { queuedAt: maintenant } })
    .catch((e: unknown) =>
      console.error(
        "[guide-ia] queued_at non écrit (e-mail pourtant en file) :",
        e instanceof Error ? e.message : String(e),
      ),
    );
  return "en-file";
}
