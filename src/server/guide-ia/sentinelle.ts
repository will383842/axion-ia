/**
 * SENTINELLE QUOTIDIENNE DU GUIDE (lot L2, 2026-09-24).
 *
 * Leçon du 16/09 : la génération de contenu est restée arrêtée SIX JOURS « en
 * vert », parce que chaque passage sortait en se déclarant réussi. Une chaîne
 * d'envoi qui ne part plus ressemble exactement à une chaîne qui n'a rien à
 * envoyer — sauf si quelqu'un compare les DEUX nombres.
 *
 * Chaque matin, sur les dernières 24 h :
 *   · 🔴 demandes > 0 et envois = 0           → la chaîne est coupée ;
 *   · 🔴 coupe-circuit déclenché depuis > 24 h → personne ne l'a ré-armé ;
 *   · 🔴 échecs définitifs d'envoi du guide    → le relais refuse ;
 *   · 🔴 synchro CRM de la lettre abandonnée   → un abonné n'arrivera pas ;
 *   · 🟢 et, s'il y a eu des demandes, le RÉCAPITULATIF du jour — c'est lui qui
 *     remplace les notifications unitaires au-delà du seuil horaire.
 *
 * Aucune adresse dans ces messages : des nombres seulement.
 */

import { prisma } from "@/lib/prisma";
import { COUPE_CIRCUIT_TROP_LONG_MS, GABARIT_GUIDE } from "./config";
import { lireCoupeCircuit } from "./coupe-circuit";
import { estSchemaAbsent } from "./rattrapage";

export interface ReleveSentinelle {
  readonly demandes: number;
  readonly envois: number;
  readonly echecs: number;
  readonly enAttente: number;
  readonly clics: number;
  readonly lettresAConfirmer: number;
  readonly crmAbandons: number;
  readonly coupeCircuitDepuis: Date | null;
  readonly anomalies: readonly string[];
}

export async function releverSentinelle(maintenant: Date = new Date()): Promise<ReleveSentinelle> {
  const depuis = new Date(maintenant.getTime() - 24 * 3_600_000);
  const [demandes, envois, echecs, enAttente, clics, lettresAConfirmer, crmAbandons, coupe] =
    await Promise.all([
      prisma.guideRequest.count({
        where: { OR: [{ createdAt: { gte: depuis } }, { queuedAt: { gte: depuis } }] },
      }),
      prisma.emailLog.count({
        where: { template: GABARIT_GUIDE, status: "sent", sentAt: { gte: depuis } },
      }),
      prisma.emailLog.count({
        where: { template: GABARIT_GUIDE, status: "failed", failedAt: { gte: depuis } },
      }),
      prisma.guideRequest.count({ where: { sentAt: null, origine: "formulaire" } }),
      prisma.guideRequest.count({ where: { firstClickAt: { gte: depuis } } }),
      prisma.newsletterSubscriber.count({
        where: { status: "pending", createdAt: { gte: depuis } },
      }),
      prisma.crmSyncOutbox.count({
        where: {
          status: "gave_up",
          eventType: { in: ["newsletter_optin", "newsletter_optout"] },
          updatedAt: { gte: depuis },
        },
      }),
      lireCoupeCircuit(),
    ]);

  const anomalies: string[] = [];
  if (demandes > 0 && envois === 0) {
    anomalies.push(`${demandes} demande(s) du guide en 24 h et AUCUN envoi : la chaîne est coupée`);
  }
  const coupeCircuitDepuis = coupe.declenche ? coupe.depuis : null;
  if (
    coupe.declenche &&
    (coupe.depuis === null ||
      maintenant.getTime() - coupe.depuis.getTime() > COUPE_CIRCUIT_TROP_LONG_MS)
  ) {
    anomalies.push(
      "Envoi du guide suspendu depuis plus de 24 h (coupe-circuit) : ré-armer depuis la console une fois la cause comprise",
    );
  }
  if (echecs > 0) anomalies.push(`${echecs} échec(s) définitif(s) d'envoi du guide en 24 h`);
  if (crmAbandons > 0) {
    anomalies.push(`${crmAbandons} synchronisation(s) CRM de la lettre abandonnée(s) en 24 h`);
  }

  return {
    demandes,
    envois,
    echecs,
    enAttente,
    clics,
    lettresAConfirmer,
    crmAbandons,
    coupeCircuitDepuis,
    anomalies,
  };
}

/** Relève, puis prévient Telegram. Ne lève pas pour une table absente. */
export async function passerSentinelle(
  maintenant: Date = new Date(),
): Promise<ReleveSentinelle | null> {
  let releve: ReleveSentinelle;
  try {
    releve = await releverSentinelle(maintenant);
  } catch (e) {
    if (estSchemaAbsent(e)) return null;
    throw e;
  }

  const { notify } = await import("@/server/notifications");
  const jour = maintenant.toISOString().slice(0, 10);
  if (releve.anomalies.length > 0) {
    await notify({
      category: "MONITORING_ALERT",
      payload: {
        kind: "guide-ia-sentinelle",
        details: { anomalies: releve.anomalies, demandes: releve.demandes, envois: releve.envois },
      },
      dedupKey: `guide-ia-sentinelle-${jour}`,
    }).catch(() => undefined);
  }
  if (releve.demandes > 0 || releve.enAttente > 0) {
    await notify({
      category: "GUIDE_RECAP",
      payload: {
        demandes: releve.demandes,
        envois: releve.envois,
        clics: releve.clics,
        enAttente: releve.enAttente,
        lettresAConfirmer: releve.lettresAConfirmer,
      },
      dedupKey: `guide-ia-recap-${jour}`,
    }).catch(() => undefined);
  }
  // Doctrine de log : l'absence de nouvelles doit se voir (leçon IndexNow).
  console.warn(
    `[guide-ia] sentinelle : ${releve.demandes} demande(s), ${releve.envois} envoi(s), ` +
      `${releve.clics} clic(s), ${releve.enAttente} en attente, ${releve.anomalies.length} anomalie(s)`,
  );
  return releve;
}
