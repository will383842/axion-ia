// Rafraîchissement des réservations Calendly à venir (extrait de la route HTTP
// le 2026-08-09).
//
// POURQUOI CE MODULE EXISTE
// -------------------------
// Cette boucle vivait DANS `app/api/internal/calendly-refresh/route.ts`, donc
// elle n'était atteignable que par une requête HTTP — en pratique le cron
// GitHub Actions horaire. Or ce cron dérive fortement : relevé le 2026-08-09 sur
// 8 passages consécutifs, un trou de 2 h 44 entre 23:45 et 02:29.
//
// Le sondage passe donc sur le worker BullMQ (`calendly-poll-worker.ts`), qui
// tourne dans le conteneur `oqj5…` et déclenche à la minute près. Pour que les
// DEUX appelants partagent exactement le même code — et qu'on ne se retrouve pas
// avec deux implémentations qui divergent —, la logique descend ici et la route
// devient un mince appelant.
//
// CE QUE CE MODULE NE FAIT PAS
// ----------------------------
// Il n'invalide PAS `INBOX_COUNTS_TAG`. Le cache des compteurs porte déjà
// `{ revalidate: 30 }` (`features/admin-inbox/counters.ts`), donc la console
// rattrape seule en 30 s au pire — et un worker, qui tourne dans un AUTRE
// conteneur que le serveur Next, ne peut de toute façon pas invalider le cache
// de celui-ci. L'appelant HTTP, lui, continue de le faire : c'est gratuit pour
// lui puisqu'il EST le serveur Next.

import { prisma } from "@/lib/prisma";
import { ERASED_PLACEHOLDER } from "@/lib/rgpd-erase";
import { enrichCalendlyEvent } from "./enrich";
import { isCalendlyApiConfigured } from "./api";

/**
 * Nombre maximum de réservations revues par passage.
 *
 * Borne dure, pour deux raisons : ne pas marteler l'API Calendly (qui applique
 * ses propres quotas — 60 requêtes/minute sur le plan gratuit), et garantir une
 * durée d'exécution prévisible. Si ça déborde, `overflow` le dit au lieu de
 * tronquer en silence.
 */
export const MAX_PER_RUN = 25;

/**
 * Fenêtre de rattrapage après l'heure prévue.
 *
 * 2 h jusqu'au 2026-08-18, au motif qu'« au-delà, le rendez-vous a eu lieu (ou
 * non) et ce n'est plus l'API qui le dira ». La seconde moitié de cette phrase
 * était fausse : l'invitee Calendly porte `no_show`, que l'hôte coche APRÈS le
 * créneau — souvent le lendemain matin, en faisant le point sur sa semaine.
 * Avec 2 h, la déclaration arrivait systématiquement hors fenêtre et personne ne
 * la voyait jamais ; il fallait ressaisir l'absence à la main dans la console.
 *
 * 48 h couvre « marqué le lendemain », qui est le cas réel. Le coût est borné :
 * le sondage passe toutes les 10 min, `MAX_PER_RUN` plafonne à 25 lignes par
 * passage (≤ 50 appels API, quota Calendly 60/min) et `overflow` le dit si le
 * plafond est atteint — jamais de troncature muette. Une ligne qui ne bouge plus
 * quitte la fenêtre d'elle-même au bout de 48 h.
 */
export const GRACE_HOURS = 48;

export interface RefreshOutcome {
  readonly ok: boolean;
  readonly examined: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly failures: Record<string, number>;
  /** Vrai si le plafond `MAX_PER_RUN` a été atteint — jamais de troncature muette. */
  readonly overflow: boolean;
  readonly reason?: string;
}

const EMPTY: Omit<RefreshOutcome, "ok" | "reason"> = {
  examined: 0,
  updated: 0,
  unchanged: 0,
  failures: {},
  overflow: false,
};

/**
 * Repasse sur les réservations à venir encore marquées « planifié » et
 * réinterroge Calendly pour chacune (annulations, déplacements, enrichissement).
 *
 * Ne throw jamais : l'appelant est soit un cron, soit un worker — aucun des deux
 * ne doit rougir parce que Calendly a hoqueté.
 */
export async function refreshUpcomingCalendlyEvents(): Promise<RefreshOutcome> {
  // Sans jeton API, il n'y a rien à interroger. Ce n'est pas une erreur, c'est
  // une configuration absente.
  if (!isCalendlyApiConfigured()) {
    return { ok: true, ...EMPTY, reason: "not_configured" };
  }

  const cutoff = new Date(Date.now() - GRACE_HOURS * 3600_000);

  // Candidats : ce qui peut ENCORE changer.
  //   • statut `scheduled` — un rendez-vous déjà annulé, honoré ou constaté
  //     absent est figé ;
  //   • une URI d'invitee — sans elle, rien à demander à Calendly ;
  //   • à venir ou passé de moins de `GRACE_HOURS` (une annulation de dernière
  //     minute et un no-show coché le lendemain sont tous deux dans la fenêtre),
  //     OU sans horaire connu (capture jamais enrichie : c'est justement le cas
  //     qu'on veut rattraper).
  let candidates: Array<{ id: string }>;
  try {
    candidates = await prisma.calendlyEvent.findMany({
      where: {
        status: "scheduled",
        inviteeUri: { not: null },
        OR: [{ startTime: null }, { startTime: { gte: cutoff } }],
        // 🔴 SANS CETTE LIGNE, L'EFFACEMENT RGPD EST DÉFAIT EN DIX MINUTES.
        //
        // `eraseCalendlyEventsForEmail` (art. 17) anonymise les colonnes ET
        // écrase `rawPayload` par un marqueur `_erasedAt`. Mais `enrich`, appelé
        // juste après par ce cron, REMPLACE `rawPayload` en entier avec ce que
        // Calendly renvoie — nom, adresse et téléphone reviennent en clair. Et
        // `rawPayload` est volontairement absent du journal des champs modifiés :
        // le retour de la donnée ne produit ni trace, ni alerte.
        //
        // Une ligne effacée n'a plus rien à enrichir. On l'exclut ici, c'est le
        // second des deux verrous — le test `l-effacement-resiste-au-cron`
        // rougit si l'un des deux disparaît.
        //
        // Le marqueur est le nom anonymisé, IMPORTÉ de la chaîne d'effacement et
        // jamais recopié : si quelqu'un change le placeholder là-bas, ce filtre
        // le suit. `enrich` ne réécrit pas un champ déjà rempli (`setIfEmpty`
        // n'écrit que sur `null`), donc le marqueur survit à tout passage.
        NOT: { inviteeName: ERASED_PLACEHOLDER },
      },
      // Les plus proches d'abord : c'est là que l'information a le plus de valeur.
      orderBy: [{ startTime: "asc" }, { capturedAt: "desc" }],
      take: MAX_PER_RUN + 1,
      select: { id: true },
    });
  } catch {
    return { ok: false, ...EMPTY, reason: "db_read_failed" };
  }

  const overflow = candidates.length > MAX_PER_RUN;
  const batch = candidates.slice(0, MAX_PER_RUN);

  let updated = 0;
  let unchanged = 0;
  const failures: Record<string, number> = {};

  // Séquentiel et non parallèle : on préfère être lent et poli avec l'API
  // Calendly plutôt que rapide et rate-limité.
  for (const c of batch) {
    const res = await enrichCalendlyEvent(c.id);
    if (res.ok) {
      if (res.updatedFields.length > 0) updated += 1;
      else unchanged += 1;
    } else {
      failures[res.reason] = (failures[res.reason] ?? 0) + 1;
    }
  }

  return { ok: true, examined: batch.length, updated, unchanged, failures, overflow };
}
