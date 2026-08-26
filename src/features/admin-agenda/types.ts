/**
 * Agenda de la console — vue unifiée de TOUS les rendez-vous (2026-08-26).
 *
 * POURQUOI DEUX SOURCES ET PAS UNE
 * ---------------------------------
 * L'agenda Google contient déjà tout : Calendly y écrit ses réservations,
 * l'iPhone de Will y écrit les siennes. Le lire suffirait donc à remplir un
 * calendrier. Mais il ne contient que ce qu'un agenda sait porter — un titre,
 * une heure, une description en texte libre.
 *
 * La base, elle, détient la version RICHE des réservations Calendly : téléphone
 * de l'invité, réponses aux trois questions du formulaire, statut (annulé,
 * absent), liens d'annulation et de replanification, et le lien vers la fiche
 * de contact. Afficher la version Google d'un rendez-vous Calendly reviendrait à
 * remplacer une fiche par son ombre.
 *
 * D'où la règle de fusion : **la base gagne sur Google pour tout ce qui vient de
 * Calendly**, Google apporte le reste (rendez-vous personnels, iPhone, blocages).
 * La déduplication se fait sur la signature « Alimenté par Calendly.com » que
 * Calendly laisse dans chaque événement qu'il crée — cf. `google-calendar/events`.
 */

/** D'où vient la ligne — détermine ce qu'on peut en faire, pas seulement son badge. */
export type AgendaSource =
  /** Réservation Calendly, enrichie depuis la base. Lecture seule ici. */
  | "calendly"
  /** Événement personnel de l'agenda Google (saisi sur ordinateur ou iPhone). */
  | "google"
  /** Indisponibilité posée depuis cette console — la seule qu'on propose de retirer. */
  | "console";

export interface AgendaItem {
  /** Clé stable et sans collision entre sources : `cal_<id>` / `gg_<id>`. */
  readonly key: string;
  readonly source: AgendaSource;
  readonly titre: string;
  /** Null pour un événement « journée entière » — il occupe la journée sans horaire. */
  readonly debut: Date | null;
  readonly fin: Date | null;
  readonly journeeEntiere: boolean;
  /**
   * `false` quand l'événement est marqué « disponible » dans Google.
   *
   * Ces événements-là ne ferment RIEN, ni la réservation en ligne ni la vue
   * d'occupation — mesuré le 2026-08-26 sur un rendez-vous annulé qui laissait
   * bien son créneau ouvert chez Calendly. Les afficher comme occupés serait un
   * mensonge visuel, et le pire genre : celui qui fait renoncer à un créneau
   * libre.
   */
  readonly occupe: boolean;
  /** « AAAA-MM-JJ » à Paris — clé de placement dans la grille. */
  readonly jour: string;
  readonly contact: string | null;
  readonly telephone: string | null;
  readonly lieu: string | null;
  /** Fiche de détail dans la console, quand elle existe (réservations Calendly). */
  readonly detailHref: string | null;
  /** Identifiant Google — présent seulement pour ce qui est retirable. */
  readonly googleEventId: string | null;
  readonly annule: boolean;
}

/**
 * Ce que la lecture a RÉELLEMENT pu faire.
 *
 * Sans ça, un agenda Google injoignable est indiscernable d'un agenda vide : les
 * deux rendent une journée sans rendez-vous. C'est exactement le piège qui a
 * coûté treize minutes de décalage invisible sur `/appel` — un repli silencieux
 * se lit comme une vérité.
 */
export interface AgendaDiagnostics {
  /** `false` tant que les variables Google ne sont pas posées : cas nominal. */
  readonly googleConfigure: boolean;
  /** `true` quand Google a répondu. `false` avec une raison sinon. */
  readonly googleOk: boolean;
  readonly googleRaison?: string;
  /** `true` si le plafond de l'API a coupé la fenêtre — des lignes manquent. */
  readonly googleTronque: boolean;
  readonly nbCalendly: number;
  readonly nbGoogle: number;
}

export interface AgendaFenetre {
  readonly items: readonly AgendaItem[];
  readonly diagnostics: AgendaDiagnostics;
}

export const AGENDA_SOURCE_LABELS: Record<AgendaSource, string> = {
  calendly: "Réservation en ligne",
  google: "Agenda personnel",
  console: "Indisponibilité",
};
