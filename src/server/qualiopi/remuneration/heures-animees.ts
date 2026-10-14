/**
 * Qualiopi — DEMI-JOURNÉES ANIMÉES, découpées par MOIS CIVIL (lot L15b, pur).
 *
 * Source unique du « combien de demi-journées ce formateur a-t-il animées, et
 * quand » pour le paiement par mission (ADR 0066 v2 (e), plan 08 §2.7 règle 2) :
 *
 *   - les demi-journées PAYÉES sont celles que le formateur a CONTRESIGNÉES
 *     (`EmargementContresignature`, non révoquée ; une feuille papier validée y
 *     est rangée en `papier_scanne`) — jamais la ligne `SessionFormateur`, qui
 *     disparaît au changement de principal ;
 *   - les demi-journées PRÉVUES sont lues dans les journées de la session
 *     (`SessionJour`) qui reviennent à ce formateur ;
 *   - une contresignature « journée » vaut le matin ET l'après-midi ; deux
 *     contresignatures du même créneau ne comptent qu'une fois ;
 *   - une session sur trois mois donne trois mois, chacun avec SES demi-journées
 *     et SA dernière journée (décision 68 : un paiement par mois de journées faites).
 *
 * Aucun accès à la base : l'appelant lit, ce module compte.
 */

export type Creneau = "matin" | "apres_midi";

/** Une contresignature telle que lue en base (jour civil + demi-journée). */
export interface ContresignatureLue {
  /** Jour civil « AAAA-MM-JJ » (colonne `@db.Date`). */
  readonly jour: string;
  readonly demiJournee: "matin" | "apres_midi" | "journee";
  /** Une contresignature révoquée ne compte pas. */
  readonly revoquee?: boolean;
}

/** Une journée prévue de la session, déjà filtrée sur CE formateur. */
export interface JourneePrevue {
  readonly jour: string;
  /** « HH:MM », horaires de la journée. */
  readonly heureDebut: string;
  readonly heureFin: string;
}

export interface DemiJourneeDatee {
  readonly jour: string;
  readonly creneau: Creneau;
}

export interface MoisAnime {
  /** « AAAA-MM ». */
  readonly mois: string;
  readonly demiJournees: number;
  /** Jours distincts du mois (une demi-journée hors département = une journée de déplacement). */
  readonly journees: number;
  /** Dernier jour du mois portant une demi-journée : il fixe l'échéance de CE mois. */
  readonly derniereJournee: string;
  readonly detail: ReadonlyArray<DemiJourneeDatee>;
}

const ORDRE: Record<Creneau, number> = { matin: 0, apres_midi: 1 };

function trier(xs: Iterable<DemiJourneeDatee>): DemiJourneeDatee[] {
  return [...xs].sort((a, b) =>
    a.jour === b.jour ? ORDRE[a.creneau] - ORDRE[b.creneau] : a.jour < b.jour ? -1 : 1,
  );
}

function dedoublonner(xs: Iterable<DemiJourneeDatee>): DemiJourneeDatee[] {
  const vus = new Map<string, DemiJourneeDatee>();
  for (const x of xs) vus.set(`${x.jour}|${x.creneau}`, x);
  return trier(vus.values());
}

/** Demi-journées SIGNÉES par le formateur (révoquées exclues, doublons fusionnés). */
export function demiJourneesSignees(
  contresignatures: ReadonlyArray<ContresignatureLue>,
): DemiJourneeDatee[] {
  const out: DemiJourneeDatee[] = [];
  for (const c of contresignatures) {
    if (c.revoquee) continue;
    if (c.demiJournee === "journee" || c.demiJournee === "matin")
      out.push({ jour: c.jour, creneau: "matin" });
    if (c.demiJournee === "journee" || c.demiJournee === "apres_midi")
      out.push({ jour: c.jour, creneau: "apres_midi" });
  }
  return dedoublonner(out);
}

/** « 9:00 » → « 09:00 » ; tout autre format est refusé (jamais deviné). */
function heure(h: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(h.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new Error(`horaire illisible : ${h}`);
  return `${m[1]!.padStart(2, "0")}:${m[2]}`;
}

export interface BornesDemiJournee {
  readonly matinAvant: string;
  readonly apresMidiApres: string;
  readonly milieuDeJournee: string;
}

/**
 * 🔑 LE découpage d'une journée en créneaux — SEULE règle, lue par le paiement,
 * la lettre de mission et la proposition chiffrée (étape 4 : ce qui est annoncé
 * est ce qui est versé). Le matin si elle commence avant `matinAvant`,
 * l'après-midi si elle finit après `apresMidiApres` ; ni l'un ni l'autre
 * (horaires incohérents) : UN créneau, celui de son début.
 */
export function creneauxDuJour(
  heureDebut: string,
  heureFin: string,
  bornes: BornesDemiJournee,
): Creneau[] {
  // Comparaison de chaînes : sûre seulement sur « HH:MM » à deux chiffres.
  const debut = heure(heureDebut);
  const fin = heure(heureFin);
  const out: Creneau[] = [];
  if (debut < bornes.matinAvant) out.push("matin");
  if (fin > bornes.apresMidiApres) out.push("apres_midi");
  if (out.length === 0) out.push(debut < bornes.milieuDeJournee ? "matin" : "apres_midi");
  return out;
}

/**
 * Demi-journées PRÉVUES d'une journée : le matin si elle commence avant
 * `matinAvant`, l'après-midi si elle finit après `apresMidiApres`. Une journée
 * qui ne coche aucune borne (horaires incohérents) compte UNE demi-journée, au
 * créneau de son début : ne jamais prévoir zéro pour une journée qui existe.
 */
export function demiJourneesPrevues(
  journees: ReadonlyArray<JourneePrevue>,
  bornes: BornesDemiJournee,
): DemiJourneeDatee[] {
  const out: DemiJourneeDatee[] = [];
  for (const j of journees) {
    for (const creneau of creneauxDuJour(j.heureDebut, j.heureFin, bornes))
      out.push({ jour: j.jour, creneau });
  }
  return dedoublonner(out);
}

/** Découpage par mois civil, mois triés. */
export function parMoisCivil(demi: ReadonlyArray<DemiJourneeDatee>): MoisAnime[] {
  const groupes = new Map<string, DemiJourneeDatee[]>();
  for (const d of dedoublonner(demi)) {
    const mois = d.jour.slice(0, 7);
    groupes.set(mois, [...(groupes.get(mois) ?? []), d]);
  }
  return [...groupes.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([mois, detail]) => ({
      mois,
      demiJournees: detail.length,
      journees: new Set(detail.map((d) => d.jour)).size,
      derniereJournee: detail[detail.length - 1]!.jour,
      detail,
    }));
}

/** Les demi-journées prévues d'un mois qui n'ont PAS (encore) de signature. */
export function demiJourneesSansSignature(
  prevues: ReadonlyArray<DemiJourneeDatee>,
  signees: ReadonlyArray<DemiJourneeDatee>,
): DemiJourneeDatee[] {
  const s = new Set(signees.map((d) => `${d.jour}|${d.creneau}`));
  return trier(prevues.filter((d) => !s.has(`${d.jour}|${d.creneau}`)));
}
