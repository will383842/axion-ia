/**
 * Sondage Calendly — worker BullMQ (2026-08-09).
 *
 * POURQUOI CE WORKER EXISTE
 * -------------------------
 * Calendly Free n'émet aucun webhook, et depuis l'ADR 0038 le visiteur réserve
 * sur calendly.com dans un nouvel onglet : plus aucun signal ne revient au site
 * au moment de la réservation. La découverte se faisait donc par un cron GitHub
 * Actions horaire — sauf que GitHub ne garantit pas l'heure. Relevé le
 * 2026-08-09 sur 8 passages consécutifs : un trou de **2 h 44** entre 23:45 et
 * 02:29, et un rendez-vous du 06/08 à 16:30 découvert à 15:29. Une réservation
 * prise 30 min avant le créneau pouvait donc être signalée APRÈS le début du
 * rendez-vous.
 *
 * BullMQ, lui, déclenche à la minute. La latence passe de « jusqu'à 2 h 44 » à
 * « moins de 60 s ».
 *
 * DEUX RYTHMES, ET C'EST DÉLIBÉRÉ
 * -------------------------------
 * L'API Calendly plafonne à **60 requêtes/minute** (plan gratuit comme Standard).
 * Les deux passes n'ont pas du tout le même coût, donc pas la même cadence :
 *
 *   · `discover` — toutes les MINUTES. Coût : 2 requêtes (`/users/me` + la liste
 *     des évènements), plus 1 par réservation réellement nouvelle. C'est ce qui
 *     doit être rapide : une réservation qui n'existe pas encore en base
 *     n'apparaît nulle part et ne déclenche aucune alerte.
 *   · `refresh` — toutes les 10 MINUTES. Coût : jusqu'à `MAX_PER_RUN` (25)
 *     enrichissements, chacun 1 à 2 requêtes, soit ~50 requêtes. À la minute, on
 *     saturerait le quota à lui seul. Une annulation connue avec 10 min de retard
 *     reste très en deçà de l'heure d'avant.
 *   · `revalidate-slots` — toutes les 2 MINUTES. Coût côté Calendly : ZÉRO. Cette
 *     passe n'appelle pas Calendly, elle demande au site d'oublier ses créneaux ;
 *     les 4 requêtes de re-résolution partent du site, au prochain rendu, et
 *     seulement s'il y a un visiteur.
 *
 * 🔴 NE PAS passer `refresh` à la minute « pour aller plus vite » : on
 * dépasserait le quota, Calendly répondrait 429, et c'est `discover` — la passe
 * qui compte — qui serait rejetée en premier.
 *
 * POURQUOI UNE TROISIÈME PASSE, ALORS QUE LE WEBHOOK EXISTE
 * ---------------------------------------------------------
 * Parce que le webhook ne voit QUE ce qui se passe chez Calendly. Un rendez-vous
 * posé à la main dans Google Agenda ou sur l'iPhone ferme bien le créneau côté
 * Calendly — mesuré le 2026-08-26 : **11 secondes** — mais **personne ne nous
 * prévient**. Aucun webhook, aucun évènement. Le site gardait donc ses créneaux
 * jusqu'à l'expiration de son TTL de 900 s : 13 minutes mesurées, pendant
 * lesquelles `/appel` proposait un horaire que Calendly refusait déjà. C'est le
 * cas qui a déclenché l'audit, et c'est le seul que le webhook ne couvre pas.
 * Pour le voir, il faut aller regarder — donc un cron.
 *
 * INERTE PAR DÉFAUT
 * -----------------
 * Sans `CALENDLY_API_TOKEN`, `discoverNewCalendlyEvents()` et
 * `refreshUpcomingCalendlyEvents()` sortent immédiatement sans émettre la
 * moindre requête. ⚠️ Cette variable est présente sur l'application WEB mais
 * devait être AJOUTÉE sur l'application WORKER (deux applications Coolify
 * distinctes) — sans elle ce worker tourne à vide en silence.
 */

import { Worker, type Job } from "bullmq";
import { discoverNewCalendlyEvents } from "@/server/calendly/discover";
import { refreshUpcomingCalendlyEvents } from "@/server/calendly/refresh";
import { envoyerRappelsH1 } from "@/server/calendly/rappel-h1";
import { isCalendlyApiConfigured } from "@/server/calendly/api";
import { CALENDLY_SLOTS_TAG } from "@/server/calendly/availability";
import { CALENDLY_SLOTS_PATHS } from "@/server/calendly/revalider-creneaux";
import { revalidateContent } from "@/server/content-gen/shared/revalidate-content";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";

export const CALENDLY_POLL_QUEUE_NAME = "calendly-poll";

/** Les trois passes, à trois cadences différentes — voir l'en-tête. */
export type CalendlyPollJobType = "discover" | "refresh" | "revalidate-slots" | "rappel-h1";

export interface CalendlyPollJobData {
  readonly type: CalendlyPollJobType;
  /** Horodatage d'enfilement — purement diagnostique. */
  readonly tick?: string;
}

async function processJob(job: Job<CalendlyPollJobData>): Promise<void> {
  // Garde explicite en plus de celle des modules appelés : elle évite d'écrire
  // une ligne de log toutes les minutes sur une installation sans jeton. Elle
  // couvre aussi `revalidate-slots` à dessein — sans jeton, `/appel` rend le
  // repli sans créneaux, il n'y a donc rien à rafraîchir.
  if (!isCalendlyApiConfigured()) return;

  if (job.data.type === "revalidate-slots") {
    // ⚠️ CORRECTION 2026-08-27 : ce commentaire disait « no-op SILENCIEUX hors
    // contexte de requête ». C'est faux — la source lève une erreur explicite
    // (`Invariant: static generation store missing`, code E263), et trois
    // fichiers du dépôt répétaient l'affirmation. La conclusion pratique ne
    // change pas — on passe par la route interne, qui les exécute côté Next —
    // mais un « no-op silencieux » se diagnostique tout autrement d'un throw.
    // 🔴 `paths` MANQUAIT, ET C'ÉTAIT LE DÉFAUT — corrigé le 2026-08-27.
    //
    // Ce passage n'envoyait que l'étiquette. Or la route interne applique aux
    // étiquettes un profil de cache, tandis qu'elle passe les CHEMINS à
    // `revalidatePath`, qui expire en dur. Et l'entrée `fetch` des créneaux
    // porte l'étiquette implicite du chemin (`_N_T_/fr/appel`) : la purger par
    // le chemin la purge réellement.
    //
    // Autrement dit : le seul appelant VIVANT de cette chaîne était le seul à
    // n'envoyer que la moitié qui n'expire pas. Le webhook, lui, envoyait la
    // bonne moitié — mais il est éteint tant que le plan Calendly est gratuit.
    //
    // `purgeEdge: false` : `/fr/appel` répond `no-store` et sort en
    // `cf-cache-status: BYPASS`. Sans ça, ce cron de 2 minutes émettrait 720
    // purges Cloudflare par jour sur une page qui n'a pas de copie d'edge.
    const res = await revalidateContent({
      tags: [CALENDLY_SLOTS_TAG],
      paths: [...CALENDLY_SLOTS_PATHS],
      purgeEdge: false,
    });
    // On ne journalise QUE l'échec : 720 lignes/jour annonçant un succès
    // noieraient les logs du worker et rendraient invisible la seule qui compte.
    // `revalidateContent` a déjà écrit son propre JSON structuré ; cette ligne
    // ajoute l'identité de l'appelant, qu'il ne connaît pas.
    if (!res.ok) {
      console.warn(`[calendly-poll] créneaux non invalidés : ${res.reason ?? "inconnu"}`);
    }
    return;
  }

  if (job.data.type === "rappel-h1") {
    const res = await envoyerRappelsH1();
    // On ne journalise QUE ce qui s'est passe. Une ligne toutes les 5 minutes
    // annoncant « 0 rappel » noierait les logs et rendrait invisible la seule
    // qui compte.
    if (res.envoyes > 0) console.warn(`[appel-rappel] ${res.envoyes} rappel(s) envoye(s)`);
    if (res.echecs > 0) {
      console.warn(
        `[appel-rappel] ${res.echecs} mise(s) en file REFUSEE(s) — reessai au passage suivant`,
      );
    }
    if (!res.ok) console.warn(`[appel-rappel] passage en echec : ${res.raison ?? "inconnu"}`);
    if (res.plafondAtteint) {
      console.error(
        "[appel-rappel] PLAFOND ATTEINT — signe d'un emballement : le marqueur d'envoi n'est probablement plus pose",
      );
    }
    return;
  }

  if (job.data.type === "discover") {
    const res = await discoverNewCalendlyEvents();
    // 🔴 LE SIGNAL LE PLUS PRÉCOCE DONT ON DISPOSE, et il était jeté.
    //
    // Cette passe tourne à la MINUTE et sait exactement quand une réservation
    // vient d'arriver — donc quand un créneau vient de fermer. Elle créait la
    // ligne, synchronisait le CRM, envoyait l'alerte… et laissait `/appel`
    // vendre le créneau jusqu'au prochain passage de `revalidate-slots`, deux
    // minutes plus tard.
    //
    // Invalider ici ramène le délai à ~60 s sans une seule requête Calendly de
    // plus : la découverte a déjà payé l'aller-retour.
    //
    // Placé dans le worker et non dans `discover.ts` : cette fonction a deux
    // appelants, dont un hors contexte de requête, et le second invaliderait
    // par un chemin différent.
    if (res.created > 0) {
      const inval = await revalidateContent({
        tags: [CALENDLY_SLOTS_TAG],
        paths: [...CALENDLY_SLOTS_PATHS],
        purgeEdge: false,
      });
      if (!inval.ok) {
        console.warn(
          `[calendly-poll] réservation découverte mais créneaux NON invalidés : ${inval.reason ?? "inconnu"}`,
        );
      }
    }
    // On ne journalise QUE ce qui s'est passé. Une ligne par minute annonçant
    // « 0 nouvelle réservation » noierait les logs du worker (1440 lignes/jour)
    // et rendrait invisible la seule qui compte.
    if (res.created > 0) {
      console.warn(`[calendly-poll] ${res.created} réservation(s) découverte(s)`);
    }
    // 🔴 CE QUI RENDAIT UNE PANNE INVISIBLE. En régime normal, la profondeur de
    // rattrapage vaut son minimum (120 min). Si elle grimpe, c'est que cette
    // passe n'avait rien vu depuis longtemps — worker arrêté, base injoignable,
    // ou simplement aucune réservation. Les trois se ressemblaient dans les
    // journaux, et le premier est celui qui perd des rendez-vous.
    //
    // Le seuil est à 4 h et non au minimum : entre 2 et 4 h, l'élargissement est
    // le fonctionnement NORMAL d'un lundi matin sans réservation du week-end.
    // Alerter là-dessus apprendrait à ignorer la ligne.
    //
    // ⚠️ `undefined` = la passe a échoué avant de calculer sa fenêtre ; c'est
    // `res.reason` qui parle alors, pas ce compteur. On ne le traite donc pas
    // comme un zéro rassurant.
    const rattrapage = res.rattrapageMinutes;
    if (rattrapage !== undefined && rattrapage > 240) {
      console.warn(
        `[calendly-poll] rattrapage élargi à ${Math.round(rattrapage / 60)} h — ` +
          `aucune réservation vue depuis ce délai. Normal si le flux est calme, ` +
          `SIGNE D'ARRÊT si le worker a redémarré.`,
      );
    }
    if (res.pagesTronquees) {
      console.error(
        "[calendly-poll] PAGINATION TRONQUÉE — des rendez-vous lointains n'ont pas été examinés. " +
          "Augmenter MAX_PAGES ou resserrer l'horizon.",
      );
    }
    if (!res.ok) {
      console.warn(`[calendly-poll] découverte en échec : ${res.reason ?? "inconnu"}`);
    }
    if (res.remaining) console.warn(`[calendly-poll] ${res.remaining}`);
    return;
  }

  const res = await refreshUpcomingCalendlyEvents();
  if (res.updated > 0) {
    console.warn(`[calendly-poll] ${res.updated} réservation(s) mise(s) à jour`);
  }
  if (!res.ok) {
    console.warn(`[calendly-poll] rafraîchissement en échec : ${res.reason ?? "inconnu"}`);
  }
  if (res.overflow) {
    console.warn(
      "[calendly-poll] plafond MAX_PER_RUN atteint — des réservations n'ont pas été vues",
    );
  }
}

let workerInstance: Worker<CalendlyPollJobData> | null = null;

export function startCalendlyPollWorker(): Worker<CalendlyPollJobData> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — calendly-poll-worker cannot start");
  workerInstance = new Worker<CalendlyPollJobData>(CALENDLY_POLL_QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    // 🔴 concurrency 1, non négociable : deux `discover` en parallèle liraient la
    // même liste Calendly avant que l'un ait écrit, et créeraient deux lignes
    // pour la même réservation — donc DEUX alertes Telegram/WhatsApp. La
    // contrainte UNIQUE sur `invitee_uri` rattrape l'écriture (P2002 ignoré dans
    // `discover.ts`), mais elle ne rattrape pas l'alerte déjà partie.
    concurrency: 1,
    // Un passage `refresh` fait jusqu'à 25 appels séquentiels : 2 min de marge.
    lockDuration: 120_000,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[calendly-poll-worker] job ${job?.id} failed:`, err);
    captureWorkerError("calendly-poll", CALENDLY_POLL_QUEUE_NAME, job, err);
  });
  return workerInstance;
}

export async function stopCalendlyPollWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
