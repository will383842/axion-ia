/**
 * Entonnoir du tunnel apporteurs — l'AGRÉGATION, pure et testée (2026-10-06).
 *
 * Aucune lecture base ici : `apporteurs.ts` charge, ce module calcule. Ce qu'il
 * garantit, parce que c'est ce qui rend un tableau de pilotage trompeur :
 *
 * 🔴 « NON MESURÉ » N'EST JAMAIS UN ZÉRO. Une cellule vaut `null` quand sa source
 * n'a rien enregistré (aucune visite, aucune inscription) ou n'a pas pu être
 * lue. Une mesure ET son témoin à zéro disent « panne de mesure », pas « zéro
 * conversion ». L'écran écrit alors « non mesuré » (total) ou « — » (semaine).
 *
 * 🔴 AUCUNE MOYENNE SUR PEU DE CAS. Le coût par apporteur actif n'est calculé
 * qu'à partir de `SEUIL_CONCLURE` cas ; en dessous, on affiche l'effectif et
 * « trop peu de cas pour conclure ». Un coût divisé par zéro est « — ».
 *
 * Deux sources, deux unités, dites à l'écran :
 *   · les marches du HAUT (visites → page merci) viennent des balises anonymes
 *     (`funnel_events`) et se comptent en SESSIONS, par semaine d'arrivée ;
 *   · les marches du BAS (réservation → présentation) viennent des fiches et se
 *     comptent en PERSONNES, par semaine d'inscription.
 */

export const SEUIL_CONCLURE = 10;
/** Sous ce nombre de visites, un taux de comparaison est du bruit. */
export const SEUIL_COMPARAISON = 30;
export const MAX_SEMAINES = 12;

export type Page = "video" | "court";

/** Une balise lue en base (`funnel_events`, clé `apporteur`). */
export interface LigneBalise {
  readonly event: string;
  readonly sessionId: string;
  readonly route: string | null;
  readonly utmCampaign: string | null;
  readonly createdAt: Date;
}

/** Une personne entrée par la page (fiche) et ce qui lui est arrivé depuis. */
export interface LeadSuivi {
  readonly id: string;
  readonly page: Page;
  readonly inscritLe: Date;
  readonly campagne: string | null;
  readonly annonce: string | null;
  /** Source de la campagne (`facebook`, `linkedin`…) : seule Facebook compte pour le coût. */
  readonly canal: string | null;
  readonly etape2: boolean;
  readonly reserve: boolean;
  readonly tenu: boolean;
  readonly retenu: boolean;
  readonly dossier: boolean;
  readonly contrat: boolean;
  readonly presente: boolean;
  /** Contrat signé ET au moins une entreprise présentée sous 60 jours. */
  readonly actif: boolean;
}

/** Quelles lectures ont réussi : une lecture en échec rend « non mesuré », jamais 0. */
export interface SourcesLues {
  readonly balises: boolean;
  readonly fiches: boolean;
  readonly reservations: boolean;
  readonly reseau: boolean;
}

export interface Depense {
  readonly spentOn: Date;
  readonly canal: string;
  readonly campagne: string | null;
  readonly montantCentimes: number;
}

export type Cellule = number | null;

export interface Marche {
  readonly cle: string;
  readonly libelle: string;
  readonly unite: "sessions" | "personnes";
  /** `null` = non mesuré. */
  readonly total: Cellule;
  /** Une cellule par semaine de `semaines` ; `null` = « — ». */
  readonly parSemaine: Cellule[];
}

export interface EntonnoirApporteurs {
  /** Lundis (AAAA-MM-JJ, UTC), du plus ancien au plus récent. */
  readonly semaines: string[];
  readonly marches: Marche[];
  /** Dépenses par semaine (centimes), alignées sur `semaines`, et total de la période. */
  readonly depenseSemaine: number[];
  readonly depenseTotale: number;
}

const EV = {
  vue: "Landing Viewed",
  film: "Landing Video Played",
  clic: "Landing CTA Clicked",
  etape1: "Lead Email Captured",
  etape2: "Lead Apporteur Submitted",
  merci: "Call Booking Viewed",
} as const;

/** Lundi (UTC) de la semaine d'une date, `AAAA-MM-JJ`. */
export function lundiDe(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const jour = (x.getUTCDay() + 6) % 7; // lundi = 0
  x.setUTCDate(x.getUTCDate() - jour);
  return x.toISOString().slice(0, 10);
}

/** Les lundis de `depuis` à `jusqua` inclus, au plus `MAX_SEMAINES` (les plus récents). */
export function listerSemaines(depuis: Date, jusqua: Date): string[] {
  const res: string[] = [];
  const cur = new Date(`${lundiDe(depuis)}T00:00:00.000Z`);
  const fin = lundiDe(jusqua);
  while (cur.toISOString().slice(0, 10) <= fin) {
    res.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return res.slice(-MAX_SEMAINES);
}

/** La page d'une balise, déduite de sa ROUTE (jamais d'une valeur envoyée par le navigateur). */
export function pageDeLaRoute(route: string | null): Page {
  return route?.includes("/apporteur-affaires/video") ? "video" : "court";
}

interface SessionApporteur {
  page: Page;
  debut: Date;
  campagne: string | null;
  evenements: Set<string>;
}

export function grouperSessions(lignes: readonly LigneBalise[]): SessionApporteur[] {
  const m = new Map<string, SessionApporteur>();
  for (const l of lignes) {
    let s = m.get(l.sessionId);
    if (!s) {
      s = {
        page: pageDeLaRoute(l.route),
        debut: l.createdAt,
        campagne: null,
        evenements: new Set(),
      };
      m.set(l.sessionId, s);
    }
    s.evenements.add(l.event);
    // La page et la date d'ENTRÉE sont celles de la balise la plus ancienne,
    // jamais celles de l'ordre d'arrivée des lignes.
    if (l.createdAt.getTime() < s.debut.getTime()) {
      s.debut = l.createdAt;
      s.page = pageDeLaRoute(l.route);
    }
    s.campagne ??= l.utmCampaign;
  }
  return [...m.values()];
}

function compterParSemaine(
  semaines: readonly string[],
  dates: readonly Date[],
): { total: number; parSemaine: number[] } {
  const idx = new Map(semaines.map((s, i) => [s, i]));
  const parSemaine = semaines.map(() => 0);
  let total = 0;
  for (const d of dates) {
    total += 1; // le total couvre TOUTE la période, même hors des colonnes affichées
    const i = idx.get(lundiDe(d));
    if (i !== undefined) parSemaine[i] = (parSemaine[i] ?? 0) + 1;
  }
  return { total, parSemaine };
}

export interface EntreeEntonnoir {
  readonly lignes: readonly LigneBalise[];
  readonly leads: readonly LeadSuivi[];
  readonly depenses: readonly Depense[];
  readonly sources: SourcesLues;
  readonly depuis: Date;
  readonly jusqua: Date;
}

export function construireEntonnoir(e: EntreeEntonnoir): EntonnoirApporteurs {
  const semaines = listerSemaines(e.depuis, e.jusqua);
  const sessions = grouperSessions(e.lignes).filter((s) => s.page === "video");
  const leads = e.leads.filter((l) => l.page === "video");

  const marche = (
    cle: string,
    libelle: string,
    unite: Marche["unite"],
    dates: readonly Date[],
    lue: boolean,
    temoin: { total: number; parSemaine: number[] },
  ): Marche => {
    const c = compterParSemaine(semaines, dates);
    // Non mesuré : source illisible, ou témoin à zéro (rien n'est entré dans le
    // haut de cette partie de l'entonnoir : un zéro ici ne prouverait rien).
    if (!lue || temoin.total === 0) {
      return { cle, libelle, unite, total: null, parSemaine: semaines.map(() => null) };
    }
    return {
      cle,
      libelle,
      unite,
      total: c.total,
      parSemaine: c.parSemaine.map((n, i) =>
        (temoin.parSemaine[i] ?? 0) === 0 && n === 0 ? null : n,
      ),
    };
  };

  // ── HAUT : sessions, par semaine d'arrivée ────────────────────────────────
  const datesAvec = (ev: string): Date[] =>
    sessions.filter((s) => s.evenements.has(ev)).map((s) => s.debut);
  const visites = compterParSemaine(
    semaines,
    sessions.filter((s) => s.evenements.has(EV.vue)).map((s) => s.debut),
  );
  const haut = (cle: string, libelle: string, ev: string): Marche =>
    marche(cle, libelle, "sessions", datesAvec(ev), e.sources.balises, visites);

  // ── BAS : personnes, par semaine d'inscription ────────────────────────────
  const inscrits = compterParSemaine(
    semaines,
    leads.map((l) => l.inscritLe),
  );
  const bas = (
    cle: string,
    libelle: string,
    pred: (l: LeadSuivi) => boolean,
    lue: boolean,
  ): Marche =>
    marche(
      cle,
      libelle,
      "personnes",
      leads.filter(pred).map((l) => l.inscritLe),
      lue && e.sources.fiches,
      inscrits,
    );

  const marches: Marche[] = [
    // Visites : le témoin lui-même. Zéro visite = non mesuré (panne de balise).
    (() => {
      const lue = e.sources.balises;
      return lue && visites.total > 0
        ? {
            cle: "visites",
            libelle: "Visites de la page",
            unite: "sessions" as const,
            total: visites.total,
            parSemaine: visites.parSemaine,
          }
        : {
            cle: "visites",
            libelle: "Visites de la page",
            unite: "sessions" as const,
            total: null,
            parSemaine: semaines.map(() => null),
          };
    })(),
    haut("film", "Film lu", EV.film),
    haut("clic", "Clic sur un bouton", EV.clic),
    haut("etape1", "Étape 1 (prénom + e-mail)", EV.etape1),
    haut("etape2", "Étape 2 (téléphone + question)", EV.etape2),
    haut("merci", "Page de remerciement vue", EV.merci),
    bas("reserve", "Créneau réservé", (l) => l.reserve, e.sources.reservations),
    bas("tenu", "Échange tenu", (l) => l.tenu, e.sources.reservations),
    bas("retenu", "Retenu", (l) => l.retenu, e.sources.reservations),
    bas("dossier", "Dossier complet", (l) => l.dossier, true),
    bas("contrat", "Contrat signé", (l) => l.contrat, e.sources.reseau),
    bas("presente", "A présenté une entreprise", (l) => l.presente, e.sources.reseau),
  ];

  // ── Dépenses par semaine ──────────────────────────────────────────────────
  const idx = new Map(semaines.map((s, i) => [s, i]));
  const depenseSemaine = semaines.map(() => 0);
  let depenseTotale = 0;
  for (const d of e.depenses) {
    depenseTotale += d.montantCentimes;
    const i = idx.get(lundiDe(d.spentOn));
    if (i !== undefined) depenseSemaine[i] = (depenseSemaine[i] ?? 0) + d.montantCentimes;
  }

  return { semaines, marches, depenseSemaine, depenseTotale };
}

/** Part, en %, d'une marche sur la précédente. `null` si l'une des deux n'est pas mesurée. */
export function partDepuisPrecedente(courant: Cellule, precedent: Cellule): number | null {
  if (courant === null || precedent === null || precedent <= 0) return null;
  return Math.round((courant / precedent) * 1000) / 10;
}

/**
 * Coût d'une marche : dépenses ÷ nombre, en centimes. `null` (affiché « — ») si
 * rien n'a été saisi, si la marche n'est pas mesurée ou si elle vaut zéro : on ne
 * divise jamais par zéro, et on n'affiche pas « 0 € » pour une dépense absente.
 */
export function coutParMarche(depenseCentimes: number, n: Cellule): number | null {
  if (n === null || n <= 0 || depenseCentimes <= 0) return null;
  return Math.round(depenseCentimes / n);
}

export type CoutActif =
  | { etat: "aucun"; actifs: 0 }
  | { etat: "trop-peu"; actifs: number }
  | { etat: "ok"; actifs: number; coutCentimes: number | null };

/**
 * Coût par apporteur actif (contrat signé + au moins une entreprise présentée
 * sous 60 jours). Jamais une moyenne sur moins de `SEUIL_CONCLURE` cas.
 */
export function coutParApporteurActif(depenseCentimes: number, actifs: number): CoutActif {
  if (actifs <= 0) return { etat: "aucun", actifs: 0 };
  if (actifs < SEUIL_CONCLURE) return { etat: "trop-peu", actifs };
  return { etat: "ok", actifs, coutCentimes: coutParMarche(depenseCentimes, actifs) };
}

// ── Comparaison nouvelle page / ancienne page ────────────────────────────────

export interface ComparaisonPage {
  readonly page: Page;
  readonly libelle: string;
  readonly visites: number;
  readonly etape1: number;
  readonly etape2: number;
  /** Part des visites, en % ; `null` sous `SEUIL_COMPARAISON` visites. */
  readonly etape1ParVisite: number | null;
  readonly etape2ParVisite: number | null;
}

/**
 * Nouvelle page contre ancienne, sur « étape 1 par visite » et « étape 2 par
 * visite ». ⚠️ L'ancienne page n'a qu'UN formulaire : son seul envoi compte pour
 * les deux étapes (la comparaison sur l'étape 2 est la seule strictement
 * comparable ; l'écran le dit).
 */
export function comparerPages(lignes: readonly LigneBalise[]): ComparaisonPage[] {
  const sessions = grouperSessions(lignes);
  const calc = (page: Page, libelle: string): ComparaisonPage => {
    const s = sessions.filter((x) => x.page === page && x.evenements.has(EV.vue));
    const visites = s.length;
    const etape2 = s.filter((x) => x.evenements.has(EV.etape2)).length;
    const etape1 = page === "video" ? s.filter((x) => x.evenements.has(EV.etape1)).length : etape2;
    const taux = (n: number): number | null =>
      visites >= SEUIL_COMPARAISON ? Math.round((n / visites) * 1000) / 10 : null;
    return {
      page,
      libelle,
      visites,
      etape1,
      etape2,
      etape1ParVisite: taux(etape1),
      etape2ParVisite: taux(etape2),
    };
  };
  return [calc("video", "Nouvelle page (vidéo)"), calc("court", "Ancienne page (témoin)")];
}

// ── Découpage par campagne et par annonce ───────────────────────────────────

export interface LigneDecoupage {
  readonly cle: string;
  /** `null` = non mesuré (l'annonce n'est pas portée par les balises). */
  readonly visites: Cellule;
  readonly etape1: number;
  readonly etape2: number;
  readonly reserves: number;
  readonly depenseCentimes: number | null;
}

const SANS = "(sans repère)";

export function decouperParCampagne(
  lignes: readonly LigneBalise[],
  leads: readonly LeadSuivi[],
  depenses: readonly Depense[],
  baliseLue: boolean,
): LigneDecoupage[] {
  const cles = new Set<string>();
  const sessions = grouperSessions(lignes).filter(
    (s) => s.page === "video" && s.evenements.has(EV.vue),
  );
  for (const s of sessions) cles.add(s.campagne ?? SANS);
  const vids = leads.filter((l) => l.page === "video");
  for (const l of vids) cles.add(l.campagne ?? SANS);
  for (const d of depenses) if (d.campagne) cles.add(d.campagne);
  return [...cles].sort().map((cle) => {
    const ls = vids.filter((l) => (l.campagne ?? SANS) === cle);
    const dep = depenses
      .filter((d) => (d.campagne ?? SANS) === cle)
      .reduce((a, d) => a + d.montantCentimes, 0);
    return {
      cle,
      visites: baliseLue ? sessions.filter((s) => (s.campagne ?? SANS) === cle).length : null,
      etape1: ls.length,
      etape2: ls.filter((l) => l.etape2).length,
      reserves: ls.filter((l) => l.reserve).length,
      depenseCentimes: dep > 0 ? dep : null,
    };
  });
}

/** Par annonce (`utm_content`). Les visites ne sont pas mesurables : la balise ne porte pas l'annonce. */
export function decouperParAnnonce(leads: readonly LeadSuivi[]): LigneDecoupage[] {
  const vids = leads.filter((l) => l.page === "video");
  const cles = [...new Set(vids.map((l) => l.annonce ?? SANS))].sort();
  return cles.map((cle) => {
    const ls = vids.filter((l) => (l.annonce ?? SANS) === cle);
    return {
      cle,
      visites: null,
      etape1: ls.length,
      etape2: ls.filter((l) => l.etape2).length,
      reserves: ls.filter((l) => l.reserve).length,
      depenseCentimes: null,
    };
  });
}
