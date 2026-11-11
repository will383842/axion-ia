import { createHmac } from "node:crypto";

import { prisma } from "@/lib/prisma";

import {
  CRM_SYNC_MAX_ATTEMPTS,
  CRM_SYNC_TIMEOUT_MS,
  crmSyncSecret,
  crmSyncUrl,
  isCrmSyncEnabled,
  nextAttemptDelayMs,
} from "./config";
import { ENVOI_COUPE, estEnvoiCoupe } from "./coupure-recrutement";
import type { CrmIngestResponse } from "./types";
import { notify } from "@/server/notifications";

/**
 * ÉMISSION d'une ligne d'outbox vers le CRM.
 *
 * Signature : HMAC-SHA256 de « <horodatage>.<corps exact> », en-têtes
 * `X-Site-Timestamp` / `X-Site-Signature`. L'horodatage est DANS la signature :
 * sans lui, une requête légitime interceptée resterait rejouable pour
 * l'éternité (le CRM refuse au-delà de sa fenêtre de tolérance).
 *
 * Le corps signé est la chaîne EXACTE envoyée — jamais un objet re-sérialisé
 * de l'autre côté, sinon la moindre différence d'ordre de clés invaliderait la
 * signature.
 */

/**
 * Le dépôt tourne en `exactOptionalPropertyTypes` : `httpStatus?: number` y
 * REFUSE `undefined` comme valeur explicite. Or ces trois champs sont
 * naturellement « inconnus » (pas de réponse HTTP quand le réseau tombe, pas de
 * corps JSON quand le CRM répond en texte). On les déclare donc
 * `?: T | undefined` — le champ reste optionnel ET peut porter `undefined`,
 * plutôt que de construire les objets par accumulation conditionnelle.
 */
export interface EmitResult {
  status: "sent" | "failed" | "gave_up" | "skipped";
  httpStatus?: number | undefined;
  crmResult?: string | undefined;
  error?: string | undefined;
}

export function signBody(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export async function emitOutboxRow(outboxId: string): Promise<EmitResult> {
  if (!isCrmSyncEnabled()) return { status: "skipped" };

  const row = await prisma.crmSyncOutbox.findUnique({ where: { id: outboxId } });
  if (!row) return { status: "skipped" };
  if (row.status === "sent" || row.status === "gave_up") return { status: "skipped" };

  // 🔴 Rien du recrutement ne part au CRM (ADR 0047, révision § 4 ter) — pas
  // même ce qui était DÉJÀ en file avant la coupure. Couper la création des
  // lignes ne suffit pas : une candidature `pending` ou `failed` d'avant le
  // déploiement serait rejouée par le balayage, et partirait après coup.
  // Soldée en `gave_up` SANS appel réseau, sans consommer de tentative, sans
  // `responseStatus` (le CRM n'a rien reçu) et SANS alerte d'abandon : ce n'est
  // pas une perte, c'est la règle. `skipped` rendu au balayage pour qu'il ne
  // la compte pas comme un abandon.
  if (estEnvoiCoupe(row.eventType, row.payload)) {
    await prisma.crmSyncOutbox.update({
      where: { id: outboxId },
      data: { status: "gave_up", nextAttemptAt: null, lastError: ENVOI_COUPE },
    });
    return { status: "skipped", error: "envoi coupé (ADR 0047)" };
  }

  const url = crmSyncUrl();
  const secret = crmSyncSecret();
  if (!url || !secret) {
    // Configuration incomplète : la ligne RESTE en attente. On ne la solde
    // pas — le jour où le secret est posé, le balayage la rattrape.
    await markFailed(
      outboxId,
      row.attempts,
      "configuration incomplète (URL ou secret absent)",
      false,
    );
    return { status: "failed", error: "config" };
  }

  const body = JSON.stringify(row.payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  let httpStatus: number | undefined;
  let parsed: CrmIngestResponse | undefined;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Site-Timestamp": timestamp,
        "X-Site-Signature": signBody(secret, timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(CRM_SYNC_TIMEOUT_MS),
    });

    httpStatus = response.status;
    parsed = (await response.json().catch(() => undefined)) as CrmIngestResponse | undefined;

    if (response.ok) {
      await prisma.crmSyncOutbox.update({
        where: { id: outboxId },
        data: {
          status: "sent",
          attempts: row.attempts + 1,
          lastAttemptAt: new Date(),
          nextAttemptAt: null,
          sentAt: new Date(),
          responseStatus: httpStatus,
          crmResult: parsed?.result?.status ?? null,
          lastError: null,
        },
      });
      return { status: "sent", httpStatus, crmResult: parsed?.result?.status };
    }

    // 422 = refus DÉFINITIF (contrat, consentement, taxonomie). Rejouer un
    // message que le contrat refuse ne le rendra jamais valide : on abandonne
    // tout de suite et la ligne reste visible pour traitement humain.
    if (httpStatus === 422) {
      await prisma.crmSyncOutbox.update({
        where: { id: outboxId },
        data: {
          status: "gave_up",
          attempts: row.attempts + 1,
          lastAttemptAt: new Date(),
          nextAttemptAt: null,
          responseStatus: httpStatus,
          lastError: truncate(parsed?.error ?? "refus définitif du CRM"),
        },
      });
      await prevenirAbandon(
        outboxId,
        row.eventType,
        row.subjectRef,
        parsed?.error ?? "refus définitif du CRM",
        true,
      );
      return { status: "gave_up", httpStatus, error: parsed?.error };
    }

    // 429 (CRM saturé, ex. post viral) et 503 (CRM éteint : drapeau d'ingestion à OFF, ou flux
    // candidats fermé) sont des refus TEMPORAIRES, pas des échecs de l'événement : la tentative
    // ne compte PAS dans le plafond d'abandon, sinon une rafale de 429 (ou les lignes accumulées
    // pendant la phase inerte) mènerait des personnes à `gave_up` alors qu'il suffit d'attendre.
    // L'événement est reporté (Retry-After respecté, sinon délai borné croissant), jamais soldé.
    if (httpStatus === 429 || httpStatus === 503) {
      await reporterRefusTemporaire(
        outboxId,
        row,
        httpStatus,
        response.headers.get("retry-after"),
        truncate(parsed?.error ?? `HTTP ${httpStatus}`),
      );
      return { status: "failed", httpStatus, error: parsed?.error };
    }

    const abandonne = await markFailed(
      outboxId,
      row.attempts,
      truncate(parsed?.error ?? `HTTP ${httpStatus}`),
      true,
      httpStatus,
    );
    if (abandonne) {
      await prevenirAbandon(
        outboxId,
        row.eventType,
        row.subjectRef,
        parsed?.error ?? `HTTP ${httpStatus}`,
        false,
      );
    }
    return { status: "failed", httpStatus, error: parsed?.error };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const abandonne = await markFailed(outboxId, row.attempts, truncate(detail), true, httpStatus);
    if (abandonne) {
      await prevenirAbandon(outboxId, row.eventType, row.subjectRef, detail, false);
    }
    return { status: "failed", httpStatus, error: "network" };
  }
}

/**
 * Prévient qu'un événement n'atteindra JAMAIS le CRM.
 *
 * ## Pourquoi cette alerte n'existait pas, et pourquoi il la fallait
 *
 * Le refus définitif était déjà géré proprement : la ligne passe en
 * `gave_up`, l'erreur est conservée, et le commentaire d'à côté annonçait
 * qu'elle « reste visible pour traitement humain ». Elle l'est — sur la page
 * `/synchro-crm`, qu'il faut penser à ouvrir.
 *
 * `crm-sync/health.ts` mesure d'ailleurs ces abandons, et dit explicitement
 * qu'elle « ne doit ni émettre, ni alerter » : c'est une vue de lecture, par
 * choix. Personne, donc, n'était PRÉVENU.
 *
 * Mesuré en production le 2026-09-01 : **trois soumissions de formulaire
 * abandonnées** les 24, 26 et 28 août, toutes pour la même raison
 * (`candidate_consent_v2_required`), et découvertes seulement parce qu'on est
 * allé regarder. Trois personnes qui ont écrit et que le CRM n'a jamais
 * connues.
 *
 * ## Pourquoi ici et pas dans une sonde
 *
 * Une sonde qui balaie périodiquement ne voit que ce qui est encore dans sa
 * fenêtre — celle de `health.ts` fait 24 heures, et les trois abandons y sont
 * depuis longtemps invisibles. Alerter AU MOMENT de l'abandon ne dépend
 * d'aucune fenêtre : l'événement est signalé une fois, quand il se produit.
 *
 * ## Elle ne bloque jamais l'émission
 *
 * Une alerte qui échoue ne doit pas empêcher la ligne d'être marquée. Le pire
 * cas reste le comportement d'aujourd'hui : un abandon silencieux.
 */
async function prevenirAbandon(
  outboxId: string,
  eventType: string,
  subjectRef: string,
  raison: string,
  definitif: boolean,
): Promise<void> {
  try {
    await notify({
      category: "MONITORING_ALERT",
      severity: "critical",
      payload: {
        kind: "crm_abandon",
        details: {
          legacyBody:
            `Un événement n'atteindra JAMAIS le CRM.

` +
            `Type   : ${eventType}
` +
            `Sujet  : ${subjectRef}
` +
            `Raison : ${raison}

` +
            (definitif
              ? `Refus DÉFINITIF du CRM (422) : le rejouer ne le rendra pas valide. ` +
                `Il faut corriger la cause — contrat, consentement ou taxonomie — ` +
                `puis ressaisir la personne à la main.`
              : `Toutes les tentatives ont échoué. Le CRM était injoignable ou en ` +
                `erreur pendant toute la durée du réessai.`) +
            `

Détail : console → Synchro CRM.`,
        },
      },
      // Une alerte par événement abandonné : ils sont rares (trois en deux
      // semaines) et chacun représente une personne perdue.
      dedupKey: `crm-abandon:${outboxId}`,
      dedupTtlSec: 7 * 24 * 3600,
    });
  } catch (e) {
    console.warn(
      `[crm-sync] alerte d'abandon impossible pour ${outboxId} : ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

async function markFailed(
  outboxId: string,
  attempts: number,
  message: string,
  countsTowardGiveUp: boolean,
  httpStatus?: number,
): Promise<boolean> {
  const nextAttempts = countsTowardGiveUp ? attempts + 1 : attempts;
  const exhausted = countsTowardGiveUp && nextAttempts >= CRM_SYNC_MAX_ATTEMPTS;

  await prisma.crmSyncOutbox.update({
    where: { id: outboxId },
    data: {
      status: exhausted ? "gave_up" : "failed",
      attempts: nextAttempts,
      lastAttemptAt: new Date(),
      nextAttemptAt: exhausted
        ? null
        : new Date(Date.now() + nextAttemptDelayMs(Math.max(1, nextAttempts))),
      responseStatus: httpStatus ?? null,
      lastError: message,
    },
  });

  // 🔑 REND l'abandon plutôt que d'alerter ici. `markFailed` ne connaît que
  // l'identifiant ; le type d'événement et le sujet vivent chez l'appelant, et
  // une alerte qui ne dit pas DE QUI elle parle n'aide personne.
  return exhausted;
}

/** Délai de report sans `Retry-After` : plancher 1 min, ×2 à chaque refus consécutif, plafond 30 min. */
const REPORT_MIN_MS = 60_000;
const REPORT_MAX_MS = 30 * 60_000;
/** Plafond d'un `Retry-After` annoncé par le CRM (même borne que le délai d'échec ordinaire). */
const RETRY_AFTER_MAX_MS = 6 * 60 * 60_000;

/** `Retry-After` en millisecondes (secondes entières ou date HTTP), plafonné ; null si absent/illisible. */
function lireRetryAfterMs(valeur: string | null, maintenant: number): number | null {
  const v = valeur?.trim();
  if (!v) return null;
  let ms: number;
  if (/^\d+$/.test(v)) ms = Number(v) * 1000;
  else {
    const date = Date.parse(v);
    if (Number.isNaN(date)) return null;
    ms = date - maintenant;
  }
  return Math.min(Math.max(ms, 0), RETRY_AFTER_MAX_MS);
}

/**
 * Reporte une ligne après un 429/503 SANS toucher `attempts` ni jamais la solder. Le délai croît
 * à partir de l'écart précédent (lastAttemptAt → nextAttemptAt) quand le refus précédent était
 * déjà un 429/503 : aucune colonne nouvelle, rien n'est supprimé.
 */
async function reporterRefusTemporaire(
  outboxId: string,
  row: {
    attempts: number;
    lastAttemptAt?: Date | null;
    nextAttemptAt?: Date | null;
    responseStatus?: number | null;
  },
  httpStatus: number,
  retryAfter: string | null,
  message: string,
): Promise<void> {
  const maintenant = Date.now();
  let delai = lireRetryAfterMs(retryAfter, maintenant);
  if (delai === null) {
    const refusPrecedent = row.responseStatus === 429 || row.responseStatus === 503;
    const ecart =
      refusPrecedent && row.lastAttemptAt && row.nextAttemptAt
        ? row.nextAttemptAt.getTime() - row.lastAttemptAt.getTime()
        : 0;
    delai = Math.min(Math.max(ecart * 2, REPORT_MIN_MS), REPORT_MAX_MS);
  }
  await prisma.crmSyncOutbox.update({
    where: { id: outboxId },
    data: {
      status: "failed",
      attempts: row.attempts,
      lastAttemptAt: new Date(maintenant),
      nextAttemptAt: new Date(maintenant + delai),
      responseStatus: httpStatus,
      lastError: message,
    },
  });
}

function truncate(message: string): string {
  return message.length > 480 ? `${message.slice(0, 480)}…` : message;
}
