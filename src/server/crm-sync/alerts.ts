/**
 * Alertes de la synchro CRM (lot L5) — le canal par lequel une panne SE VOIT.
 *
 * ── Pourquoi un module dédié plutôt qu'un `notify()` au call-site ───────────
 * Parce que l'anti-bruit est la partie difficile, et qu'elle doit être tenue
 * en UN endroit. Une synchro en panne ne produit pas une anomalie : elle en
 * produit une par ligne, toutes les dix minutes, indéfiniment. Sans agrégation,
 * la première panne réelle noierait le salon et la deuxième ne serait plus lue.
 *
 * ── L'agrégation : une clé de dédup HORAIRE par type ────────────────────────
 * `crm-sync-alert-<kind>-<YYYYMMDDHH>` : au plus UNE alerte par heure et par
 * type d'anomalie (plan §2.9). Le seau est calculé sur l'heure UTC de
 * l'horloge, pas sur un compteur glissant — c'est volontairement grossier :
 * une clé déterministe survit à un redémarrage du worker, un compteur non.
 *
 * Le TTL de 3 600 s couvre toujours la fin du seau courant ; le passage à
 * l'heure suivante change la clé, donc laisse repasser une alerte. Le régime
 * obtenu est « une par heure », jamais « une puis plus rien ».
 *
 * ── Contrat ────────────────────────────────────────────────────────────────
 * `alertCrmSync()` ne lève JAMAIS. Un salon Telegram injoignable ne doit pas
 * faire échouer le job qui l'a appelé — sinon une alerte ratée se transforme
 * en job rouge, et on perd l'information au lieu de la gagner.
 */

import { notify } from "@/server/notifications";
import type { CrmSyncAlertKind } from "@/server/notifications/types";

/**
 * Seuil de backlog qui déclenche l'alerte.
 *
 * 🔴 Valeur FERME du plan (contre-vérification 2026-08-13), pas un réglage :
 * au-delà de 50 lignes en attente, ce n'est plus un CRM lent, c'est une
 * synchro qui ne passe plus. Ne pas la relever pour faire taire une alerte.
 */
export const CRM_SYNC_BACKLOG_THRESHOLD = 50;

/** Durée de vie de la clé de dédup — couvre toujours la fin du seau horaire. */
const DEDUP_TTL_SEC = 3600;

/**
 * Seau horaire d'une alerte : `crm-sync-alert-backlog-2026081409`.
 *
 * Construit par découpe de l'ISO plutôt qu'avec `Intl` : on veut un identifiant
 * stable et lisible, pas une date localisée. UTC assumé — l'horloge des
 * machines est en UTC (piège connu du dépôt), donc un seau « 09 » est le même
 * pour le worker et pour les tests.
 */
export function crmSyncAlertDedupKey(kind: CrmSyncAlertKind, now: Date = new Date()): string {
  const iso = now.toISOString();
  const bucket = `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}${iso.slice(11, 13)}`;
  return `crm-sync-alert-${kind}-${bucket}`;
}

export interface CrmSyncAlertInput {
  kind: CrmSyncAlertKind;
  count?: number | undefined;
  detail?: string | undefined;
  subjectRef?: string | undefined;
}

/**
 * Émet une alerte de synchro, dédupliquée à l'heure.
 *
 * `sync: true` est délibéré : la sévérité `error` ferait normalement partir le
 * dispatch en tâche détachée, or l'appelant est un job BullMQ qui peut se
 * terminer avant l'envoi. Un message perdu parce que le processus a rendu la
 * main est exactement le genre de panne silencieuse que ce module existe pour
 * empêcher.
 */
export async function alertCrmSync(input: CrmSyncAlertInput): Promise<void> {
  try {
    await notify({
      category: "CRM_SYNC_ALERT",
      payload: {
        kind: input.kind,
        ...(input.count !== undefined ? { count: input.count } : {}),
        ...(input.detail !== undefined ? { detail: input.detail } : {}),
        ...(input.subjectRef !== undefined ? { subjectRef: input.subjectRef } : {}),
      },
      dedupKey: crmSyncAlertDedupKey(input.kind),
      dedupTtlSec: DEDUP_TTL_SEC,
      sync: true,
    });
  } catch (error) {
    console.error("[crm-sync] émission de l'alerte échouée:", error);
  }
}
