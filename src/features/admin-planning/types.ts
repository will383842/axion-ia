// Planning unifié admin — types partagés.
//
// Un `PlanningEvent` est la vue normalisée d'une prestation, quelle que soit sa
// source (formation collective, coaching 1-to-1, et plus tard audit). Les vues
// (calendrier, charge, prévisionnel) ne connaissent QUE ce type : elles ignorent
// de quelle table vient chaque événement.

export type PlanningEventType = "formation" | "coaching" | "audit";

export const PLANNING_TYPE_LABELS: Record<PlanningEventType, string> = {
  formation: "Formation",
  coaching: "1-to-1",
  audit: "Audit",
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
  /**
   * Id (UUID) du formateur assigné, ou null si non assigné.
   *
   * Optionnel au niveau du type pour rester rétro-compatible avec les
   * fabriques d'événements existantes (tests conflicts/queries) : la couche de
   * lecture `queries.ts` le renseigne TOUJOURS. Il est indispensable à la vue
   * « charge formateur », car deux formateurs peuvent être homonymes — on
   * regroupe donc par id, jamais par nom.
   */
  formateurId?: string | null;
  /** Raison sociale du client / entreprise du bénéficiaire. */
  clientNom: string | null;
  /** Lieu formaté (cf. `formatLieu`), ou null si non renseigné. */
  lieu: string | null;
  /**
   * Étape commerciale, pour la pastille « en devis » / « validé » du calendrier :
   *   - `"valide"`   : devis accepté ou convention signée ;
   *   - `"en_devis"` : devis envoyé, en attente de réponse ;
   *   - `null`       : pas de devis (ou brouillon), ou type sans devis (coaching).
   * Optionnel : les fabriques de test antérieures ne le fournissent pas.
   */
  commercialStatut?: "en_devis" | "valide" | null;
  /** Statut OPCO brut (`OpcoStatut`), pour la pastille financement. `null` = non concerné. */
  opcoStatut?: string | null;
  /** Un acompte a-t-il été reçu ? Pour la pastille acompte. */
  acompteRecu?: boolean;
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
/**
 * Lien vers la fiche d'une prestation du planning.
 *
 * 🔴 CLIQUER UN AUDIT MENAIT À UNE PAGE 404. Le calendrier, la timeline, le hub
 * et le calendrier prévisionnel affichent bien les audits (`queries.ts` en
 * produit avec `type: "audit"`), mais la route `/planning/[type]/[id]` n'accepte
 * que `formation` et `coaching` : tout audit tombait sur `notFound()`. Une
 * prestation visible et facturée n'avait aucune fiche atteignable.
 *
 * L'audit a déjà sa fiche complète, `/qualiopi/audits/[id]`, qui lit la même
 * table `AuditMission` — c'est là qu'on envoie, plutôt que de dupliquer une
 * fiche 360° de plus dans le planning.
 */
export function planningDetailHref(
  adminPrefix: string,
  e: Pick<PlanningEvent, "type" | "id">,
): string {
  if (e.type === "audit") return `/fr/${adminPrefix}/qualiopi/audits/${e.id}`;
  return `/fr/${adminPrefix}/planning/${e.type}/${e.id}`;
}

/** Statuts de devis Prisma pertinents pour l'étape commerciale d'une prestation. */
export type DevisStatutValue =
  "brouillon" | "envoye" | "accepte" | "refuse" | "expire" | "transforme_convention";

/**
 * Déduit l'étape commerciale affichée sur le calendrier à partir du statut du
 * devis lié et de la signature de convention.
 *
 * « Validé » l'emporte : une convention signée OU un devis accepté suffit. Sinon,
 * un devis simplement envoyé est « en devis ». Un brouillon, un refus, une
 * expiration, ou l'absence de devis ne donnent aucune pastille (rien à signaler).
 */
export function deduireCommercialStatut(
  devisStatut: DevisStatutValue | null,
  conventionSignee: boolean,
): "en_devis" | "valide" | null {
  if (conventionSignee) return "valide";
  if (devisStatut === "accepte" || devisStatut === "transforme_convention") return "valide";
  if (devisStatut === "envoye") return "en_devis";
  return null;
}
