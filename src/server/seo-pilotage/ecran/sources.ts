/**
 * Écran « Pilotage SEO & IA » : état des sources de données. Module PUR.
 */

export type EtatSource = "disponible" | "en_retard" | "indisponible";

export interface RunImport {
  /** `YYYY-MM-DD` */
  readonly jour: string;
  readonly statut: string;
}

export interface SourceEtat {
  readonly etat: EtatSource;
  /** Date (`YYYY-MM-DD`) du dernier jour de données reçu ; `null` si aucune. */
  readonly donneesJusquAu: string | null;
  readonly explication: string;
}

/** Search Console publie avec ~2-3 jours de décalage : au-delà de 5 jours, on parle de retard. */
export const RETARD_TOLERE_JOURS = 5;
const JOUR_MS = 86_400_000;

function t(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}
function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function etatSourceSearchConsole(
  runs: ReadonlyArray<RunImport>,
  aujourdhui: string,
): SourceEtat {
  const reussis = runs.filter((r) => r.statut === "reussi").map((r) => r.jour);
  if (reussis.length === 0) {
    return {
      etat: "indisponible",
      donneesJusquAu: null,
      explication:
        runs.length === 0
          ? "Aucun import de Search Console pour l'instant."
          : "Les imports de Search Console ont échoué : aucune donnée reçue.",
    };
  }
  const dernier = reussis.reduce((a, b) => (a > b ? a : b));
  const ecart = Math.floor((t(aujourdhui) - t(dernier)) / JOUR_MS);
  if (ecart > RETARD_TOLERE_JOURS) {
    return {
      etat: "en_retard",
      donneesJusquAu: dernier,
      explication: `Dernières données reçues il y a ${ecart} jours.`,
    };
  }
  return { etat: "disponible", donneesJusquAu: dernier, explication: "Les données arrivent." };
}

/** Deux fenêtres contiguës de 28 jours, la courante finissant à `fin` (incluse). */
export function fenetres28Jours(fin: string): {
  courante: { debut: string; fin: string };
  precedente: { debut: string; fin: string };
} {
  const f = t(fin);
  return {
    courante: { debut: iso(f - 27 * JOUR_MS), fin },
    precedente: { debut: iso(f - 55 * JOUR_MS), fin: iso(f - 28 * JOUR_MS) },
  };
}
