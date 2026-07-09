// Planning unifié admin — types partagés.
//
// Un `PlanningEvent` est la vue normalisée d'une prestation, quelle que soit sa
// source (formation collective, coaching 1-to-1, et plus tard audit). Les vues
// (calendrier, charge, prévisionnel) ne connaissent QUE ce type : elles ignorent
// de quelle table vient chaque événement.

export type PlanningEventType = "formation" | "coaching";

export const PLANNING_TYPE_LABELS: Record<PlanningEventType, string> = {
  formation: "Formation",
  coaching: "1-to-1",
};

/** Statuts (union des enums TrainingSessionStatut et CoachingSessionStatut). */
export type PlanningStatut = "planifiee" | "en_cours" | "realisee" | "annulee" | "reportee";

export const PLANNING_STATUT_LABELS: Record<PlanningStatut, string> = {
  planifiee: "Planifiée",
  en_cours: "En cours",
  realisee: "Réalisée",
  annulee: "Annulée",
  reportee: "Reportée",
};

export interface PlanningEvent {
  /** Clé stable inter-sources : `formation:<uuid>` / `coaching:<uuid>`. */
  key: string;
  type: PlanningEventType;
  id: string;
  titre: string;
  /** Début réel (horodaté). */
  debut: Date;
  /** Fin planifiée. Null = pas de fin connue → événement « journée entière ». */
  fin: Date | null;
  statut: PlanningStatut;
  /** Nom complet du formateur assigné, ou null si non assigné. */
  formateurNom: string | null;
  /** Raison sociale du client / entreprise du bénéficiaire. */
  clientNom: string | null;
  /** Lieu formaté (cf. `formatLieu`), ou null si non renseigné. */
  lieu: string | null;
}

export interface PlanningFilters {
  /** Filtre par formateur (id). */
  trainerId?: string;
  /** Filtre par type de prestation. */
  type?: PlanningEventType;
  /** Filtre par statut. */
  statut?: PlanningStatut;
}

/** Lien vers la fiche 360° de l'événement (entreprise, contact, financement…). */
export function planningDetailHref(
  adminPrefix: string,
  e: Pick<PlanningEvent, "type" | "id">,
): string {
  return `/fr/${adminPrefix}/planning/${e.type}/${e.id}`;
}
