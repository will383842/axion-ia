import type { CanalRendezVous } from "@/server/calendly/canal";
// Module RV téléphonique — view-model unifié des rendez-vous (read-only).
//
// V1 = source `CalendlyEvent` (seul canal public actif). La couche est conçue
// extensible : ajouter `Booking` (legacy gelé) plus tard = un mapper de plus
// dans normalize.ts, sans changer ce type ni les pages.

export type RdvSource = "calendly" | "booking";

/**
 * Les états d'un rendez-vous à l'écran.
 *
 * 🔑 `past` est DÉRIVÉ, il n'existe pas en base. Voir `estTermine` dans
 * `normalize.ts` pour la raison — et surtout pour pourquoi il ne s'appelle pas
 * `completed`.
 */
export type RdvStatus = "scheduled" | "pending" | "past" | "completed" | "canceled" | "no_show";

export interface UnifiedRdv {
  /** Clé namespacée anti-collision entre sources : `cal_<id>` / `bk_<id>`. */
  key: string;
  source: RdvSource;
  /** Id brut de l'enregistrement source (pour le deep-link détail). */
  sourceRecordId: string;
  /** Lien vers la page détail existante de la source. */
  detailHref: string;

  title: string;
  /** Souvent null côté Calendly Embed JS (heure non fournie). */
  startTime: Date | null;
  endTime: Date | null;
  /** false si `startTime` null → badge « heure à confirmer ». */
  timeConfirmed: boolean;
  /** « YYYY-MM-DD » Europe/Paris — clé de placement calendrier. */
  dayKey: string;

  status: RdvStatus;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  location: string | null;
  /**
   * Téléphone ou visio — **dérivé** de `location`, jamais stocké.
   *
   * Deux champs qui doivent dire la même chose finissent par diverger : le
   * format se recalcule à chaque lecture, donc les lignes déjà en base
   * répondent correctement sans migration. Cf. `src/server/calendly/canal.ts`.
   *
   * 🔑 IL S'APPELLE `format`, ET PAS `canal`. Arbitré par Will le 2026-08-31,
   * et le champ portait pourtant `canal` jusqu'au 2026-09-01 — un même concept
   * nommé de deux façons entre `admin-rendezvous` et `admin-agenda`, ce qui est
   * précisément la divergence que la dérivation cherche à éviter. Le mot
   * « canal » est en outre déjà pris trois fois ailleurs dans ce dépôt : type
   * de message entrant, circuit de signature, canal de recrutement.
   */
  format: CanalRendezVous;
  notes: string | null;
  /** Date de tri de repli quand `startTime` est null (capture/création). */
  createdAt: Date;
}

export interface RdvFilters {
  source?: RdvSource;
  status?: RdvStatus;
  /** ISO « YYYY-MM-DD » inclusif. */
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export const RDV_STATUS_LABELS: Record<RdvStatus, string> = {
  scheduled: "Planifié",
  // « Passé », et surtout PAS « Terminé » : on sait que l'heure est écoulée, on
  // ne sait pas que l'échange a eu lieu. Un rendez-vous manqué sans que
  // personne coche « absent » porterait sinon une affirmation fausse.
  past: "Passé",
  pending: "En attente",
  completed: "Terminé",
  canceled: "Annulé",
  no_show: "Absent",
};
