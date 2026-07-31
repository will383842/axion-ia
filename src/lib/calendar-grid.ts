// Util pur : grille mensuelle lundi→dimanche pour les vues calendrier admin.
// Neuf (n'altère pas CalendrierV2/Booking → 0 régression). Générique, sans
// dépendance domaine ni lib tierce.

/**
 * Construit la grille d'un mois (semaines lundi→dimanche).
 * @param year  année (ex 2026)
 * @param month mois 1-12
 * @returns tableau de `Date | null` (null = case de remplissage avant le 1er /
 *          après le dernier jour), longueur multiple de 7. Les `Date` sont à
 *          minuit UTC du jour concerné (usage : extraire year/month/day, pas
 *          l'heure).
 */
export function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // getUTCDay : 0=dimanche…6=samedi → on décale pour lundi=0.
  const firstWeekday = (first.getUTCDay() + 6) % 7;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(Date.UTC(year, month - 1, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Clé jour « YYYY-MM-DD » d'une date, calculée en **Europe/Paris** (jamais UTC
 * — sinon décalage d'un jour à minuit). Sert de clé de regroupement calendrier.
 */
export function dayKeyInParis(date: Date): string {
  // "en-CA" formate en YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Clé jour d'une `Date` de la grille (déjà à minuit UTC → composants UTC). */
export function dayKeyOfGridDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Heure « HH:MM » Europe/Paris (pour l'affichage d'un créneau). */
export function timeInParis(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// ── Conversion Europe/Paris ⇄ UTC pour les champs `datetime-local` ───────────
//
// Un `<input type="datetime-local">` ne connaît AUCUN fuseau : il rend et
// renvoie « YYYY-MM-DDTHH:mm » que l'utilisateur lit comme une heure locale.
// Deux erreurs symétriques en découlent si on l'alimente naïvement :
//
//   • à l'affichage, `date.toISOString().slice(0, 16)` montre l'heure UTC —
//     un rendez-vous de 11 h 30 à Paris s'affiche « 09:30 » ;
//   • à l'enregistrement, `new Date("2026-07-23T09:30")` est interprété dans le
//     fuseau du NAVIGATEUR : un simple aller-retour sans rien modifier décale
//     le créneau de l'offset. Enregistrer deux fois le décale deux fois.
//
// Constaté en production le 2026-07-29 sur la première réservation enrichie :
// la liste affichait 11:30 (correct) pendant que la fiche affichait 09:30.
// Le bug était inoffensif tant que tous les horaires étaient nuls.
//
// Tout passe donc par ces deux fonctions, réciproques l'une de l'autre.

/** Décalage Europe/Paris à un instant donné, en ms (DST-aware). */
function parisOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? "0");
  // `hour12: false` peut rendre « 24 » à minuit selon le moteur → on borne.
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - instant.getTime();
}

/**
 * Instant UTC → valeur d'un `<input type="datetime-local">`, en heure de Paris.
 * @example toParisLocalInput(new Date("2026-07-23T09:30:00Z")) === "2026-07-23T11:30"
 */
export function toParisLocalInput(date: Date): string {
  return new Date(date.getTime() + parisOffsetMs(date)).toISOString().slice(0, 16);
}

/**
 * Valeur d'un `<input type="datetime-local">` (lue comme heure de Paris) →
 * instant UTC. Indépendant du fuseau du navigateur, contrairement à `new Date()`.
 *
 * @returns `null` si la saisie est vide ou illisible (jamais de `Invalid Date`).
 */
export function fromParisLocalInput(local: string): Date | null {
  // Format vérifié explicitement : `Date.parse` est laxiste et accepte des
  // chaînes arbitraires (« pas une date » → 1999-12-31 sur V8), ce qui
  // produirait un rendez-vous silencieusement daté n'importe quand.
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const naive = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00Z`);
  if (Number.isNaN(naive)) return null;
  // Deux passes : la première estime l'offset, la seconde le corrige lorsque
  // l'estimation tombe de l'autre côté d'un changement d'heure.
  let utc = naive - parisOffsetMs(new Date(naive));
  utc = naive - parisOffsetMs(new Date(utc));
  return new Date(utc);
}
