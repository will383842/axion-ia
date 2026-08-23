import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { crmSyncQueue } from "@/server/queue/queues";

import { isCrmSyncCandidatesEnabled, isCrmSyncEnabled } from "./config";
import type { CrmSyncEvent, CrmUniverse } from "./types";

/**
 * Écriture d'un événement dans l'OUTBOX, puis demande d'émission immédiate.
 *
 * ── Pourquoi une outbox et pas un appel direct ───────────────────────────────
 * Un appel HTTP direct depuis la Server Action ferait dépendre la capture du
 * lead de la disponibilité d'un autre système : CRM lent = formulaire lent,
 * CRM mort = événement perdu sans trace. Ici, l'événement est d'abord POSÉ en
 * base (statut `pending`), et l'émission n'est qu'une optimisation de
 * fraîcheur : ce qui garantit la livraison, c'est le rejeu périodique.
 *
 * ── Pourquoi APRÈS l'écriture métier et non DANS sa transaction ──────────────
 * Le plan décrit une outbox transactionnelle. Elle est ici volontairement
 * POST-COMMIT, pour une raison qui prime (ordre de mission, interdits) :
 * dans la même transaction, un échec d'insertion de l'outbox ferait ROLLBACK
 * la soumission — un lead perdu à cause de la synchro CRM, exactement ce que la
 * doctrine « zéro perte de lead » du site interdit. Le filet contre la fenêtre
 * (crash entre les deux écritures) est le batch de réconciliation — livré avec
 * le lot OBSERVABILITÉ (plan §synchro : « le temps réel donne la fraîcheur, le
 * batch donne la garantie »), qui comparera les enregistrements source aux
 * `subject_ref` émis. D'ici là la fenêtre existe mais reste marginale (crash du
 * process dans les millisecondes entre les deux écritures) et RIEN n'est actif
 * tant que le drapeau est OFF.
 * Là où une transaction existe DÉJÀ (chatbot), on la réutilise via `tx` : on
 * gagne la garantie sans rien changer au risque.
 *
 * ── Contrat de cette fonction ───────────────────────────────────────────────
 * Elle ne lève JAMAIS. Aucun appelant n'a besoin de try/catch : un échec de
 * synchro ne doit pas pouvoir remonter jusqu'à l'utilisateur.
 */

/**
 * Client minimal accepté : le client Prisma global ou un client de transaction.
 * Typé STRUCTURELLEMENT pour ne pas dépendre des types générés (les tests
 * passent un faux client de deux lignes, sans monter tout Prisma).
 *
 * Deux choix imposés par les types générés :
 *   - `create(...)` en syntaxe de MÉTHODE et non en propriété-fonction : sous
 *     `strictFunctionTypes`, une propriété-fonction fait vérifier les
 *     paramètres en CONTRAVARIANCE, et la signature générique de Prisma
 *     (`<T extends CrmSyncOutboxCreateArgs>(args: SelectSubset<T, …>)`) n'y est
 *     jamais assignable — le client de transaction serait rejeté à l'appel. La
 *     syntaxe de méthode est bivariante, ce qui est exactement ce qu'il faut
 *     pour un contrat structurel volontairement plus large que l'implémentation.
 *   - `PromiseLike` et non `Promise` — Prisma renvoie un `Prisma__XClient`,
 *     qui est un « thenable » enrichi, pas une vraie `Promise`.
 */
export interface CrmOutboxWriter {
  crmSyncOutbox: {
    create(args: { data: Record<string, unknown> }): PromiseLike<{ id: string }>;
  };
}

export interface EnqueueOptions {
  /** Client de transaction, quand l'écriture métier est déjà transactionnelle. */
  tx?: CrmOutboxWriter | undefined;
  universe?: CrmUniverse | undefined;
}

export function newCrmEventId(): string {
  return randomUUID();
}

export async function enqueueCrmSyncEvent(
  event: CrmSyncEvent,
  options: EnqueueOptions = {},
): Promise<string | null> {
  const universe: CrmUniverse = options.universe ?? universeOf(event);

  // ── VERROU D'INERTIE ────────────────────────────────────────────────────
  // Aucune écriture, aucun job, aucun appel réseau tant que le drapeau est à
  // OFF : le comportement est identique à celui d'avant le lot.
  if (!isCrmSyncEnabled()) return null;
  if (universe === "vivier" && !isCrmSyncCandidatesEnabled()) {
    // ── E31-003 ────────────────────────────────────────────────────────────
    // C'était le SEUL chemin d'abandon de ce fichier qui ne disait rien, alors
    // que les deux autres journalisent (« mise en file best-effort échouée »,
    // « écriture outbox échouée (événement perdu) »).
    //
    // Mesure du 2026-08-22 : drapeau maître ON + `CRM_SYNC_CANDIDATES_ENABLED`
    // absent est un état NOMINAL et DURABLE — `config.ts` dit que ce second
    // verrou ne s'ouvre qu'après la mise en production des textes de
    // consentement v2. Or `syncVivierOppositionToCrm()` force l'univers à
    // `vivier` : dans cet état, toute OPPOSITION à la conservation en vivier
    // était perdue en silence, sans ligne d'outbox et sans journal, pendant que
    // la personne voyait une page de confirmation.
    //
    // Ce qu'on NE fait PAS ici, volontairement : laisser passer les `opt_out`
    // malgré le verrou. Ce serait envoyer au CRM des événements `vivier` que la
    // séquence de déploiement dit qu'il ne doit pas encore recevoir —
    // l'arbitrage appartient au contrat d'ingestion du CRM, pas à ce fichier.
    // On rend donc l'abandon AUDIBLE, rien de plus : la source de vérité de
    // l'opposition reste `vivierOpposedAt` côté site, et cette trace est ce qui
    // permettra de rejouer les oppositions au moment de la bascule.
    if (event.event_type === "opt_out") {
      console.error(
        "[crm-sync] opposition vivier NON transmise (CRM_SYNC_CANDIDATES_ENABLED à OFF) — " +
          "à rejouer après la bascule du flux candidats :",
        { event_id: event.event_id, subject_ref: event.subject_ref },
      );
    }
    return null;
  }

  try {
    const writer = (options.tx ?? prisma) as unknown as CrmOutboxWriter;

    const row = await writer.crmSyncOutbox.create({
      data: {
        eventId: event.event_id,
        eventType: event.event_type,
        subjectRef: event.subject_ref,
        universe,
        payload: event as unknown as Record<string, unknown>,
      },
    });

    // Émission immédiate déléguée à la queue : la Server Action rend la main
    // sans attendre le réseau. Si BullMQ est coupé (build, `BULLMQ_DISABLED`),
    // `crmSyncQueue` vaut `null` — la ligne reste simplement `pending` et le
    // balayage périodique la prendra.
    try {
      await crmSyncQueue?.add("emit", { outboxId: row.id }, { jobId: `crm-sync-emit-${row.id}` });
    } catch (queueError) {
      console.error("[crm-sync] mise en file best-effort échouée:", queueError);
    }

    return row.id;
  } catch (error) {
    // Un échec d'outbox ne doit jamais faire échouer la capture du lead.
    console.error("[crm-sync] écriture outbox échouée (événement perdu):", error);
    return null;
  }
}

function universeOf(event: CrmSyncEvent): CrmUniverse {
  if (event.event_type === "application_submitted") return "vivier";
  if (event.event_type === "form_submission" && event.form_type === "recrutement") {
    return "vivier";
  }
  return "business";
}
