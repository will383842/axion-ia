/**
 * Jours ouvrés en France métropolitaine : lundi à vendredi, hors jours fériés légaux.
 * Fonctions pures, calendrier de Paris. Sert à l'échéance « dix jours ouvrés » (art. 5.3).
 */

/** Clé « AAAA-MM-JJ ». */
function cle(annee: number, mois: number, jour: number): string {
  return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

/** Dimanche de Pâques (algorithme grégorien anonyme, Meeus/Jones/Butcher). */
function dimancheDePaques(annee: number): { mois: number; jour: number } {
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
  return { mois, jour };
}

/** Les onze jours fériés de la métropole pour l'année, en clés « AAAA-MM-JJ ». */
export function joursFeriesFrance(annee: number): string[] {
  const p = dimancheDePaques(annee);
  const base = Date.UTC(annee, p.mois - 1, p.jour);
  const decale = (jours: number): string => {
    const d = new Date(base + jours * 86_400_000);
    return cle(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  };
  return [
    cle(annee, 1, 1),
    decale(1), // lundi de Pâques
    cle(annee, 5, 1),
    cle(annee, 5, 8),
    decale(39), // Ascension
    decale(50), // lundi de Pentecôte
    cle(annee, 7, 14),
    cle(annee, 8, 15),
    cle(annee, 11, 1),
    cle(annee, 11, 11),
    cle(annee, 12, 25),
  ].sort();
}

const PARTIES_PARIS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
});

function dateParis(d: Date): { cle: string; annee: number; weekend: boolean } {
  const parts = Object.fromEntries(PARTIES_PARIS.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    cle: `${parts.year}-${parts.month}-${parts.day}`,
    annee: Number(parts.year),
    weekend: parts.weekday === "Sat" || parts.weekday === "Sun",
  };
}

/** Vrai si le jour (calendrier de Paris) est un jour férié métropolitain. */
export function estJourFerieFrance(d: Date): boolean {
  const p = dateParis(d);
  return joursFeriesFrance(p.annee).includes(p.cle);
}

/** Ajoute `jours` jours ouvrés : week-ends et jours fériés ne comptent pas. */
export function ajouterJoursOuvres(depuis: Date, jours: number): Date {
  const d = new Date(depuis.getTime());
  let restant = jours;
  while (restant > 0) {
    d.setTime(d.getTime() + 86_400_000);
    const p = dateParis(d);
    if (!p.weekend && !joursFeriesFrance(p.annee).includes(p.cle)) restant -= 1;
  }
  return d;
}

/**
 * Jour civil « AAAA-MM-JJ » ouvré ? (week-end et jours fériés de métropole exclus).
 * Travaille sur la clé du jour, sans fuseau : la clé est déjà un jour de Paris.
 */
export function estJourCivilOuvre(jour: string): boolean {
  const d = new Date(`${jour}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`jour civil invalide : ${jour}`);
  const jourSemaine = d.getUTCDay();
  if (jourSemaine === 0 || jourSemaine === 6) return false;
  return !joursFeriesFrance(d.getUTCFullYear()).includes(jour);
}

/**
 * Le dernier jour ouvré au plus tard à `jour` (lui-même s'il est ouvré). Sert à la
 * date cible d'un virement : une échéance qui tombe un samedi se paie le vendredi.
 */
export function dernierJourOuvreAuPlusTard(jour: string): string {
  let x = jour;
  // Au plus quatre jours chômés d'affilée en métropole (vendredi férié, week-end, lundi férié).
  for (let i = 0; i < 10 && !estJourCivilOuvre(x); i += 1) {
    const d = new Date(`${x}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    x = d.toISOString().slice(0, 10);
  }
  return x;
}
