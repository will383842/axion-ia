// Module RV téléphonique — view-model unifié des rendez-vous (read-only).
//
// V1 = source `CalendlyEvent` (seul canal public actif). La couche est conçue
// extensible : ajouter `Booking` (legacy gelé) plus tard = un mapper de plus
// dans normalize.ts, sans changer ce type ni les pages.

export type RdvSource = "calendly" | "booking";

export type RdvStatus = "scheduled" | "pending" | "completed" | "canceled" | "no_show";

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
  pending: "En attente",
  completed: "Terminé",
  canceled: "Annulé",
  no_show: "Absent",
};
