// Les bornes de « la veille » en heure de Paris, pour le récap quotidien des demandes de clients.
//
// Module PUR (aucune base, aucune horloge cachée : `maintenant` est un paramètre). La veille se
// lit en heure LÉGALE de Paris : sa longueur varie (23 h au passage à l'heure d'été, 25 h au
// retour à l'heure d'hiver), donc on ne soustrait jamais 24 h — on cherche l'instant UTC du minuit
// parisien de chaque jour.

const FUSEAU = "Europe/Paris";

export interface BornesVeille {
  /** Minuit de Paris au début de la veille (inclus). */
  debut: Date;
  /** Minuit de Paris au début d'aujourd'hui (EXCLU) : fin de la veille. */
  fin: Date;
  /** La veille, « AAAA-MM-JJ » (clé du jobId : un seul récap par jour). */
  jour: string;
  /** La veille, « JJ/MM » (objet de l'e-mail). */
  jourCourt: string;
  /** La veille, « JJ/MM/AAAA ». */
  jourLong: string;
}

interface Jour {
  y: number;
  m: number;
  d: number;
}

const formateur = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSEAU,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function composantes(t: number): {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
  s: number;
} {
  const p: Record<string, number> = {};
  for (const part of formateur.formatToParts(new Date(t))) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return {
    y: p["year"]!,
    m: p["month"]!,
    d: p["day"]!,
    h: p["hour"]!,
    mi: p["minute"]!,
    s: p["second"]!,
  };
}

/** Décalage de Paris par rapport à UTC (ms) à l'instant `t`. */
function decalageParis(t: number): number {
  const c = composantes(t);
  return Date.UTC(c.y, c.m - 1, c.d, c.h, c.mi, c.s) - Math.floor(t / 1000) * 1000;
}

/** Instant UTC du minuit de Paris du jour donné. Les bascules d'heure ont lieu à 2 h/3 h : minuit n'est jamais ambigu. */
function minuitParis({ y, m, d }: Jour): number {
  const t0 = Date.UTC(y, m - 1, d, 0, 0, 0);
  let t = t0 - decalageParis(t0);
  t = t0 - decalageParis(t);
  return t;
}

/** Le jour calendaire d'avant (arithmétique de calendrier, sans fuseau). */
function jourPrecedent({ y, m, d }: Jour): Jour {
  const j = new Date(Date.UTC(y, m - 1, d - 1));
  return { y: j.getUTCFullYear(), m: j.getUTCMonth() + 1, d: j.getUTCDate() };
}

const deux = (n: number): string => String(n).padStart(2, "0");

/** Aujourd'hui à Paris, « AAAA-MM-JJ ». */
export function jourParis(maintenant: Date): string {
  const c = composantes(maintenant.getTime());
  return `${c.y}-${deux(c.m)}-${deux(c.d)}`;
}

/** Heure et minute de Paris à l'instant donné (sert au rattrapage de 7 h 30). */
export function heureMinuteParis(maintenant: Date): { heure: number; minute: number } {
  const c = composantes(maintenant.getTime());
  return { heure: c.h, minute: c.mi };
}

/** Le début et la fin de la veille, en heure de Paris, vus de `maintenant`. */
export function bornesVeilleParis(maintenant: Date): BornesVeille {
  const c = composantes(maintenant.getTime());
  const aujourdhui: Jour = { y: c.y, m: c.m, d: c.d };
  const veille = jourPrecedent(aujourdhui);
  return {
    debut: new Date(minuitParis(veille)),
    fin: new Date(minuitParis(aujourdhui)),
    jour: `${veille.y}-${deux(veille.m)}-${deux(veille.d)}`,
    jourCourt: `${deux(veille.d)}/${deux(veille.m)}`,
    jourLong: `${deux(veille.d)}/${deux(veille.m)}/${veille.y}`,
  };
}
