/**
 * Qualiopi — Helpers de PÉRIODE (module PUR, extrait de pilotage-service LOT 4).
 *
 * Aucun import DB/next/auth : dérivation de plages de dates en heure de Paris
 * (Europe/Paris, gère l'heure d'été) + libellés/clés d'export. Réutilisé par le
 * pilotage (14 métriques) ET le cockpit financier (marge par période) sans
 * traîner le graphe lourd (prisma/redis/auth) dans les tests unitaires.
 */

/** Période de pilotage : année entière (défaut), trimestre ou mois. */
export interface PilotagePeriode {
  type: "annee" | "trimestre" | "mois";
  /** 1..4 — requis si type = "trimestre". */
  trimestre?: number;
  /** 1..12 — requis si type = "mois". */
  mois?: number;
}

/** Clé de période compacte pour le cache + les noms de fichiers d'export. */
export function periodeKey(periode: PilotagePeriode): string {
  if (periode.type === "trimestre" && periode.trimestre) return `t${periode.trimestre}`;
  if (periode.type === "mois" && periode.mois) return `m${String(periode.mois).padStart(2, "0")}`;
  return "annee";
}

/** Libellé FR de la période (affichage + exports). */
export function periodeLabel(annee: number, periode: PilotagePeriode): string {
  if (periode.type === "trimestre" && periode.trimestre) return `T${periode.trimestre} ${annee}`;
  if (periode.type === "mois" && periode.mois) {
    const nom = new Date(Date.UTC(annee, periode.mois - 1, 15)).toLocaleDateString("fr-FR", {
      month: "long",
      timeZone: "UTC",
    });
    return `${nom} ${annee}`;
  }
  return `année ${annee}`;
}

/** Décalage UTC (minutes) d'Europe/Paris à l'instant donné (gère heure d'été). */
function parisOffsetMinutes(instant: Date): number {
  try {
    const part = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      timeZoneName: "longOffset",
    })
      .formatToParts(instant)
      .find((p) => p.type === "timeZoneName")?.value;
    const m = part ? /([+-])(\d{2}):(\d{2})/.exec(part) : null;
    if (!m) return 60; // fallback UTC+1
    const sign = m[1] === "-" ? -1 : 1;
    return sign * (parseInt(m[2] ?? "0", 10) * 60 + parseInt(m[3] ?? "0", 10));
  } catch {
    return 60;
  }
}

/** Instant UTC correspondant à minuit Europe/Paris du jour donné. */
function parisMidnightUtc(annee: number, moisIndex0: number, jour: number): Date {
  const guess = new Date(Date.UTC(annee, moisIndex0, jour));
  return new Date(guess.getTime() - parisOffsetMinutes(guess) * 60 * 1000);
}

/** Plage [gte, lt) dérivée de la période, bornes à minuit Europe/Paris. */
export function derivePlage(annee: number, periode: PilotagePeriode): { gte: Date; lt: Date } {
  if (periode.type === "trimestre" && periode.trimestre) {
    const moisDebut = (periode.trimestre - 1) * 3; // index 0
    return {
      gte: parisMidnightUtc(annee, moisDebut, 1),
      lt: parisMidnightUtc(annee, moisDebut + 3, 1),
    };
  }
  if (periode.type === "mois" && periode.mois) {
    return {
      gte: parisMidnightUtc(annee, periode.mois - 1, 1),
      lt: parisMidnightUtc(annee, periode.mois, 1),
    };
  }
  return { gte: parisMidnightUtc(annee, 0, 1), lt: parisMidnightUtc(annee + 1, 0, 1) };
}
