/**
 * RATTRAPAGE DU GUIDE — passage horaire (lot L2, 2026-09-24).
 *
 * Modèle : ADR 0050 (rattrapage automatique des exemplaires signés). Une mise
 * en file peut échouer — Redis coupé, plafond horaire atteint, corbeille muette
 * — et RIEN ne la rejouait : la personne n'avait ni guide ni confirmation, et
 * aucune trace ne le disait.
 *
 * ── Ce qui est repris ────────────────────────────────────────────────────────
 * Une demande du guide, SI TOUT CECI EST VRAI :
 *   · elle vient d'un FORMULAIRE (`origine = formulaire`) — un envoi déclenché
 *     depuis la console est un geste humain, on ne le rejoue pas dans le dos
 *     de l'administrateur ;
 *   · elle n'est pas partie (`sent_at` nul) ;
 *   · son DERNIER passage en file date de plus d'une heure — l'âge se compte
 *     depuis `queued_at`, pas depuis la demande : une demande refaite hier et
 *     remise en file il y a dix minutes n'est pas « en retard » ;
 *   · aucun `email_logs` ENVOYÉ ou EN FILE n'existe pour elle, et
 *     `send_count` est relu juste avant (une ligne `sent` sans `sent_at` est
 *     réparée, pas renvoyée) ;
 *   · elle n'est pas garée en corbeille de validation.
 *
 * ── Ce qui l'arrête ──────────────────────────────────────────────────────────
 *   · le coupe-circuit : tant qu'il est déclenché, le passage ne fait RIEN ;
 *   · le plafond horaire du guide : il ne relâche que la place restante.
 *
 * L'e-mail repris porte ce que la ligne d'abonné dit AU MOMENT DE L'ENVOI :
 * lien de désinscription (abonnée) ou bouton de réinscription (désabonnée à
 * qui l'on propose de revenir) — `lettreDansLEmail`.
 *
 * 🔴 Il n'y a PLUS de rattrapage des confirmations de la lettre (ancien gabarit
 * `newsletter-confirm-optin`). Depuis l'amendement de Will (24/09), aucune
 * inscription n'attend de confirmation ; et ce rattrapage-là échappait à la
 * limite de 3 e-mails par destinataire : en redemandant le guide toutes les
 * heures avec l'adresse d'un tiers, on lui faisait envoyer jusqu'à 24
 * e-mails par jour.
 *
 * ⚠️ Fenêtre app/worker : ce module tourne dans le WORKER, qui atterrit ~50 min
 * avant la migration. Une table absente (P2021) se lit « rien à faire », en
 * silence, jusqu'au passage suivant.
 */

import { prisma } from "@/lib/prisma";
import { verdictAvantEnvoi } from "@/server/email/verdict-envoi";
import {
  AGE_RATTRAPAGE_MS,
  DELAI_AVANT_RATTRAPAGE_MS,
  ENTITE_GUIDE,
  GABARIT_GUIDE,
  HORIZON_RATTRAPAGE_MS,
  PLAFOND_HORAIRE_GUIDE,
} from "./config";
import { coupeCircuitDeclenche } from "./coupe-circuit";
import { envoisDeLaDerniereHeure, mettreEnFileGuide } from "./envoi";
import { lettreDansLEmail } from "./lettre";

export interface RapportRattrapage {
  readonly suspendu: boolean;
  readonly candidates: number;
  readonly relancees: number;
  readonly reparees: number;
  readonly ecartees: number;
  /** E-mails repris qui portaient un bouton de réinscription à la lettre. */
  readonly confirmationsRelancees: number;
}

const RAPPORT_VIDE: RapportRattrapage = {
  suspendu: false,
  candidates: 0,
  relancees: 0,
  reparees: 0,
  ecartees: 0,
  confirmationsRelancees: 0,
};

/** Table ou colonne absente : la migration n'est pas encore passée (fenêtre worker/app). */
export function estSchemaAbsent(e: unknown): boolean {
  const code = typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined;
  return code === "P2021" || code === "P2022";
}

/**
 * Le journal dit-il que cette demande est DÉJÀ partie, ou en file ?
 * Exporté : l'envoi console relit le même journal avant de mettre en file.
 */
export async function etatJournal(
  demandeId: string,
): Promise<{ envoye: Date | null; enFile: boolean }> {
  const lignes = await prisma.emailLog.findMany({
    where: {
      entityType: ENTITE_GUIDE,
      entityId: demandeId,
      template: GABARIT_GUIDE,
      status: { in: ["sent", "pending"] },
    },
    select: { status: true, sentAt: true },
  });
  const envoyee = lignes.find((l) => l.status === "sent");
  return {
    envoye: envoyee ? (envoyee.sentAt ?? new Date()) : null,
    enFile: lignes.some((l) => l.status === "pending"),
  };
}

export async function estGareeEnValidation(demandeId: string): Promise<boolean> {
  const n = await prisma.emailOutbox.count({
    where: { entityType: ENTITE_GUIDE, entityId: demandeId, statut: "a_valider" },
  });
  return n > 0;
}

export async function rattraperGuides(maintenant: Date = new Date()): Promise<RapportRattrapage> {
  try {
    if (await coupeCircuitDeclenche(maintenant)) return { ...RAPPORT_VIDE, suspendu: true };

    const place = PLAFOND_HORAIRE_GUIDE - (await envoisDeLaDerniereHeure(maintenant));
    const t = maintenant.getTime();
    const candidates = await prisma.guideRequest.findMany({
      where: {
        origine: "formulaire",
        sentAt: null,
        createdAt: {
          gte: new Date(t - HORIZON_RATTRAPAGE_MS),
          lte: new Date(t - DELAI_AVANT_RATTRAPAGE_MS),
        },
        OR: [{ queuedAt: null }, { queuedAt: { lt: new Date(t - AGE_RATTRAPAGE_MS) } }],
      },
      select: { id: true, email: true, locale: true, downloadToken: true, sendCount: true },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    let relancees = 0;
    let reparees = 0;
    let ecartees = 0;
    let confirmationsViaGuide = 0;
    for (const c of candidates) {
      if (relancees >= place) break;

      // Relecture JUSTE AVANT : un envoi a pu aboutir entre la requête et ici.
      const fraiche = await prisma.guideRequest.findUnique({
        where: { id: c.id },
        select: { sentAt: true, sendCount: true },
      });
      if (fraiche === null || fraiche.sentAt !== null) {
        ecartees++;
        continue;
      }
      const journal = await etatJournal(c.id);
      if (journal.envoye !== null || fraiche.sendCount > 0) {
        // Parti, mais la clôture n'a pas été consignée : on RÉPARE la trace,
        // on ne renvoie pas. Un guide reçu deux fois vaut moins que zéro.
        await prisma.guideRequest.updateMany({
          where: { id: c.id, sentAt: null },
          data: { sentAt: journal.envoye ?? maintenant },
        });
        reparees++;
        continue;
      }
      if (journal.enFile || (await estGareeEnValidation(c.id))) {
        ecartees++;
        continue;
      }
      // Même liste de suppression que l'enfilage : une adresse en rebond dur ne
      // doit pas être re-tentée toutes les heures pendant une semaine.
      const verdict = await verdictAvantEnvoi(c.email, {
        template: GABARIT_GUIDE,
        marketing: false,
      });
      if (verdict.retenu) {
        ecartees++;
        continue;
      }

      const lettre = await lettreDansLEmail(c.email);
      const r = await mettreEnFileGuide(
        {
          id: c.id,
          email: c.email,
          locale: c.locale === "en" ? "en" : "fr",
          downloadToken: c.downloadToken,
        },
        {
          confirmToken: lettre.confirmToken ?? null,
          unsubscribeToken: lettre.unsubscribeToken ?? null,
          maintenant,
        },
      );
      if (r === "en-file") {
        relancees++;
        if (lettre.confirmToken) {
          confirmationsViaGuide++;
          await prisma.newsletterSubscriber
            .updateMany({
              where: { email: c.email, confirmToken: lettre.confirmToken },
              data: { confirmSentAt: maintenant },
            })
            .catch(() => undefined);
        }
      } else if (r === "suspendu" || r === "plafond") {
        break;
      } else {
        ecartees++;
      }
    }

    return {
      suspendu: false,
      candidates: candidates.length,
      relancees,
      reparees,
      ecartees,
      confirmationsRelancees: confirmationsViaGuide,
    };
  } catch (e) {
    if (estSchemaAbsent(e)) return RAPPORT_VIDE;
    throw e;
  }
}
