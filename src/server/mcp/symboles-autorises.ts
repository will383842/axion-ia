/**
 * **LA LISTE NOMMÉE DES SYMBOLES DE COUCHE SERVICE** (§ 09, contrôle 3).
 *
 * Un adaptateur ne contourne jamais sa couche service : pas de `prisma`
 * direct, pas de requête SQL, pas d'action serveur qui commence par `auth()`.
 * Ce qu'il a le droit d'importer hors de `src/server/mcp/` est écrit ICI, par
 * module et par symbole — et le harnais échoue quand une entrée ne correspond
 * plus à aucun symbole exporté. Même cliquet que `CONSOMMATEURS_ASSUMES`.
 *
 * Ajouter une ligne est une décision de revue, pas une commodité : chaque
 * symbole est une porte vers la base. Les imports de TYPES ne sont pas listés :
 * un type n'existe pas à l'exécution et ne peut contourner aucune couche.
 */

export interface AutorisationDImport {
  /** Le spécificateur EXACT tel qu'il apparaît dans l'`import`. */
  readonly module: string;
  readonly symboles: readonly string[];
  /** Pourquoi cette porte existe. */
  readonly motif: string;
}

export const SYMBOLES_AUTORISES: readonly AutorisationDImport[] = [
  {
    module: "@/features/admin-inbox/queries",
    symboles: ["listInbox", "PER_CHANNEL_FETCH"],
    motif: "l'agrégateur des quatre canaux, rendu sans session au lot 4a",
  },
  {
    module: "@/features/admin-agenda/queries",
    symboles: ["getAgendaFenetre"],
    motif: "l'agrégateur agenda (base + Google), prêt en l'état",
  },
  {
    module: "@/lib/calendar-grid",
    symboles: ["fromParisLocalInput"],
    motif: "minuit à Paris pour un jour civil — la seule conversion de fuseau admise",
  },
  {
    module: "@/features/admin-rendezvous/queries",
    symboles: ["listRendezVous", "MAX_FETCH_CALENDLY"],
    motif: "les rendez-vous réservés, et le plafond de lecture de la source",
  },
  {
    module: "@/features/admin-rendezvous/types",
    symboles: ["RDV_STATUS_LABELS"],
    motif: "dériver l'énumération des statuts, jamais la recopier",
  },
  {
    module: "@/features/admin-planning/hub-queries",
    symboles: ["getHubSignaux"],
    motif: "le hub de pilotage, consommé par pilotage-dashboard.ts",
  },
  {
    module: "@/server/qualiopi/alertes/alertes-service",
    symboles: ["listAlertes"],
    motif: "la lecture PERSISTÉE des alertes — jamais l'évaluateur (47 règles sans take)",
  },
  {
    module: "../../../../prisma/generated/client",
    symboles: ["AlerteNiveau"],
    motif: "dériver l'énumération des niveaux d'alerte depuis le schéma Prisma",
  },
  {
    module: "@/features/admin-calendly/acces",
    symboles: ["peutVoirLesAppels"],
    motif: "le pont d'identité : la même fonction que la console (W-6)",
  },
];
