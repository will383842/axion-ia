/**
 * Arithmétique de calendrier de l'Agenda — mois, semaines, navigation (2026-08-27).
 *
 * POURQUOI CE FICHIER EXISTE SÉPARÉMENT
 * --------------------------------------
 * Tout ce qui suit est du calcul pur sur des clés `AAAA-MM-JJ` : aucune requête,
 * aucun composant, aucun client Prisma. C'est donc testable sans monter la
 * moindre infrastructure — et ça compte, parce que la version précédente de
 * l'agenda est tombée en production sur exactement ce genre de calcul, faute
 * d'un test qui l'exerce (cf. `bornes-du-jour-paris.spec.ts`).
 *
 * LA RÈGLE QUI GOUVERNE TOUT LE FICHIER
 * --------------------------------------
 * 🔴 On manipule des CLÉS DE JOUR (« 2026-08-27 »), jamais des instants, tant
 * qu'on fait de l'arithmétique de calendrier. Un jour civil n'est pas une durée :
 * il dure 23 h, 24 h ou 25 h selon les changements d'heure. Ajouter
 * `24 * 3600 * 1000` à un instant pour « passer au lendemain » se trompe deux
 * fois par an, silencieusement, et décale toute une grille de mois.
 *
 * La conversion clé → instant réel se fait donc en UN SEUL endroit,
 * `bornesPlageParis`, qui délègue à `fromParisLocalInput` — lequel corrige
 * l'offset en deux passes et ne rend jamais d'`Invalid Date`.
 *
 * L'ancrage à midi UTC revient partout : il place l'arithmétique loin de toute
 * frontière de jour, donc hors d'atteinte de n'importe quelle bascule horaire.
 */

import { dayKeyInParis, fromParisLocalInput } from "@/lib/calendar-grid";

/** Une clé de jour civil, `AAAA-MM-JJ`. */
export type CleJour = string;

/** Vues disponibles. L'ordre est celui de la barre d'onglets. */
export const VUES = ["mois", "semaine", "jour"] as const;
export type VueAgenda = (typeof VUES)[number];

export function estVue(v: string | undefined): v is VueAgenda {
  return v === "mois" || v === "semaine" || v === "jour";
}

/** `AAAA-MM-JJ` bien formé ? Ne dit pas que la date existe (« 2026-02-31 » passe). */
export function estCleJour(v: string | undefined): v is CleJour {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** Clé du jour courant à Paris. */
export function aujourdhuiParis(maintenant: Date = new Date()): CleJour {
  return dayKeyInParis(maintenant);
}

/**
 * Date ancrée à midi UTC pour une clé — support de toute l'arithmétique.
 *
 * Midi : les bascules d'heure ont lieu au petit matin, donc aucune addition de
 * jours ne peut faire basculer la date d'un cran.
 */
function ancre(cle: CleJour): Date {
  const [a, m, j] = cle.split("-").map(Number);
  return new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, j ?? 1, 12, 0, 0));
}

function versCle(d: Date): CleJour {
  return d.toISOString().slice(0, 10);
}

/** Décale d'un nombre de jours civils (négatif accepté). */
export function decalerJours(cle: CleJour, n: number): CleJour {
  const d = ancre(cle);
  d.setUTCDate(d.getUTCDate() + n);
  return versCle(d);
}

/** Décale d'un nombre de mois, en bornant le quantième au dernier jour du mois cible. */
export function decalerMois(cle: CleJour, n: number): CleJour {
  const d = ancre(cle);
  const quantieme = d.getUTCDate();
  // On passe par le 1er : sinon « 31 janvier + 1 mois » déborde sur le 3 mars.
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const dernier = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12, 0, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(quantieme, dernier));
  return versCle(d);
}

/**
 * Lundi de la semaine contenant `cle`.
 *
 * Semaine française : lundi → dimanche. `getUTCDay()` rend 0 pour dimanche,
 * qu'il faut donc traiter comme le 7ᵉ jour et non le 1ᵉʳ.
 */
export function lundiDeLaSemaine(cle: CleJour): CleJour {
  const d = ancre(cle);
  const jourSemaine = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  return decalerJours(cle, 1 - jourSemaine);
}

/** Les 7 clés de la semaine contenant `cle`, du lundi au dimanche. */
export function semaineDe(cle: CleJour): readonly CleJour[] {
  const lundi = lundiDeLaSemaine(cle);
  return Array.from({ length: 7 }, (_, i) => decalerJours(lundi, i));
}

/**
 * Grille de mois : 6 semaines de 7 jours, soit 42 cellules.
 *
 * Toujours 6 lignes, jamais 5 : une grille dont la hauteur change d'un mois à
 * l'autre fait sauter tout ce qui la suit à chaque navigation. Le budget de la
 * console impose `CLS = 0`, et un décalage de mise en page est précisément ce
 * qu'il interdit. Le prix est une ligne parfois entièrement hors du mois — elle
 * est rendue en retrait, ce qui la rend lisible comme telle.
 */
export function grilleDuMois(cle: CleJour): readonly CleJour[] {
  const d = ancre(cle);
  const premier = versCle(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12, 0, 0)));
  const depart = lundiDeLaSemaine(premier);
  return Array.from({ length: 42 }, (_, i) => decalerJours(depart, i));
}

/** `true` si les deux clés tombent dans le même mois civil. */
export function memeMois(a: CleJour, b: CleJour): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/**
 * Bornes réelles `[début, fin[` d'une plage de jours civils parisiens.
 *
 * `finExclue` est la clé du PREMIER jour non couvert. On ne calcule donc jamais
 * une fin par addition de durée : les jours de 23 h et 25 h restent justes.
 */
export function bornesPlageParis(
  debutCle: CleJour,
  finExclueCle: CleJour,
): { debut: Date; fin: Date } {
  const debut = fromParisLocalInput(`${debutCle}T00:00`);
  const fin = fromParisLocalInput(`${finExclueCle}T00:00`);
  if (!debut || !fin) {
    // Jamais d'`Invalid Date` transmise à Prisma : la page doit s'afficher.
    const maintenant = new Date();
    return { debut: maintenant, fin: new Date(maintenant.getTime() + 24 * 3_600_000) };
  }
  return { debut, fin };
}

/** Plage couverte par une vue, en clés. La fin est EXCLUE. */
export function plageDeLaVue(vue: VueAgenda, cle: CleJour): { debut: CleJour; finExclue: CleJour } {
  if (vue === "jour") return { debut: cle, finExclue: decalerJours(cle, 1) };
  if (vue === "semaine") {
    const lundi = lundiDeLaSemaine(cle);
    return { debut: lundi, finExclue: decalerJours(lundi, 7) };
  }
  const cellules = grilleDuMois(cle);
  const premiere = cellules[0] ?? cle;
  const derniere = cellules[41] ?? cle;
  return { debut: premiere, finExclue: decalerJours(derniere, 1) };
}

/** Cible du bouton « précédent » / « suivant », selon la vue affichée. */
export function naviguer(vue: VueAgenda, cle: CleJour, sens: -1 | 1): CleJour {
  if (vue === "jour") return decalerJours(cle, sens);
  if (vue === "semaine") return decalerJours(cle, 7 * sens);
  return decalerMois(cle, sens);
}

/** « août 2026 », « semaine du 24 août », « jeudi 27 août » — l'en-tête de la vue. */
export function libelleDeLaVue(vue: VueAgenda, cle: CleJour): string {
  if (vue === "mois") {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    }).format(ancre(cle));
  }
  if (vue === "semaine") {
    const jours = semaineDe(cle);
    const debut = ancre(jours[0] ?? cle);
    const fin = ancre(jours[6] ?? cle);
    const fmtJour = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
    });
    return `${fmtJour.format(debut)} – ${fmtJour.format(fin)}`;
  }
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(ancre(cle));
}

/** Libellé court d'une cellule de mois : le quantième seul. */
export function quantieme(cle: CleJour): string {
  return String(ancre(cle).getUTCDate());
}
