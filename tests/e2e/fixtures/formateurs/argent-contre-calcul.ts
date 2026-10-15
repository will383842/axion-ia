// Banc @formateurs, équipe ARGENT — le CONTRE-CALCUL INDÉPENDANT.
//
// 🔑 Ce module n'importe RIEN de `src/`. Un test d'argent qui comparerait le code à
// lui-même ne prouverait rien : chaque montant (en centimes) et chaque date (jour
// civil de Paris) est recalculé ici à partir du contrat, avec d'autres outils
// (arithmétique entière, `Date.UTC`, `Intl`, calcul de Pâques de Meeus), puis
// comparé à ce que le serveur a écrit.

export type JourCivil = string;

/** Le jour civil de Paris d'un instant (Intl, pas le module de dates du dépôt). */
export function jourDeParis(instant: Date): JourCivil {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  return p;
}

/** `jour` + `n` jours civils (arithmétique sur `Date.UTC`, sans heure ni fuseau). */
export function plusJours(jour: JourCivil, n: number): JourCivil {
  const [a, m, j] = jour.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
}

/** Nombre de jours civils de `a` à `b`. */
export function ecartJours(a: JourCivil, b: JourCivil): number {
  const t = (x: JourCivil) => {
    const [y, m, d] = x.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/** Honoraires d'animation : une demi-journée vaut la moitié du tarif journée, centime plancher. */
export function honorairesAnimationCents(demiJournees: number, tarifJourneeCents: number): number {
  return Math.floor((demiJournees * tarifJourneeCents) / 2);
}

/** Contrat, art. 11.1 : 50 % des honoraires des demi-journées annulées, hors forfait. */
export function indemniteAnnulationCents(demiJournees: number, tarifJourneeCents: number): number {
  return Math.floor((honorairesAnimationCents(demiJournees, tarifJourneeCents) * 50) / 100);
}

/** TTC : franchise 293 B et exonération formation sans TVA ; assujetti à 20 %. */
export function ttcCents(
  htCents: number,
  regime: "franchise_293b" | "exonere_formation" | "assujetti_20",
): number {
  return regime === "assujetti_20" ? htCents + Math.round(htCents / 5) : htCents;
}

/** Contrat v4, art. 16 : virement au plus tard 30 jours après la date de l'autofacture. */
export function echeanceDepuisFacture(jourFacture: JourCivil): JourCivil {
  return plusJours(jourFacture, 30);
}

/** Dimanche de Pâques (algorithme anonyme grégorien, Meeus/Jones/Butcher). */
function paques(annee: number): JourCivil {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

/** Les onze jours fériés de métropole. */
export function joursFeries(annee: number): Set<JourCivil> {
  const p = paques(annee);
  const fixes = ["01-01", "05-01", "05-08", "07-14", "08-15", "11-01", "11-11", "12-25"];
  return new Set([
    ...fixes.map((x) => `${annee}-${x}`),
    plusJours(p, 1), // lundi de Pâques
    plusJours(p, 39), // Ascension
    plusJours(p, 50), // lundi de Pentecôte
  ]);
}

export function estJourOuvre(jour: JourCivil): boolean {
  const [a, m, j] = jour.split("-").map(Number) as [number, number, number];
  const js = new Date(Date.UTC(a, m - 1, j)).getUTCDay();
  return js !== 0 && js !== 6 && !joursFeries(a).has(jour);
}

/** Le dernier jour ouvré au plus tard à `jour` (la date cible d'un virement). */
export function dernierJourOuvreAuPlusTard(jour: JourCivil): JourCivil {
  let d = jour;
  while (!estJourOuvre(d)) d = plusJours(d, -1);
  return d;
}

/** Un instant à `hh:mm` heure de Paris, le jour `jour` (DST compris, par essai). */
export function aParis(jour: JourCivil, hhmm: string): Date {
  const [h, mi] = hhmm.split(":").map(Number) as [number, number];
  for (const decalage of [1, 2]) {
    const essai = new Date(
      `${jour}T${String(h - decalage).padStart(2, "0")}:${String(mi).padStart(2, "0")}:00Z`,
    );
    const lu = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(essai);
    if (lu === hhmm && jourDeParis(essai) === jour) return essai;
  }
  throw new Error(`aParis : ${jour} ${hhmm} introuvable`);
}
