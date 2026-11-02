/**
 * Filtre CLIENT de la base d'audit (2026-11-02) — module PUR, sans effet de bord.
 *
 * `BaseAudit` est le document complet, INTERNE. `VueClient` est ce que le client peut lire :
 *   · ni contradictions brutes, ni doutes sur les personnes, ni notes internes, ni annexe ;
 *   · ni fiche individuelle, ni citation attribuée : les difficultés sont présentées PAR SERVICE ;
 *   · rien dont la confiance soit « hypothèse » : seuls « établi » et « probable » passent ;
 *   · les noms de personnes connus de la base sont retirés de tout texte libre, et une citation qui
 *     en contient un est écartée plutôt que caviardée (un mot caviardé reste identifiable).
 *
 * Générique : aucune section ni formulation propre à un client ou à un secteur.
 */

import type { BaseAudit, Besoin, Source } from "../base-audit-schema";

export const VERSION_VUE_CLIENT = "vue-client/1";

/** Les confiances qu'un client peut lire. « hypothèse » n'en fait jamais partie. */
const CONFIANCES_VISIBLES: ReadonlySet<string> = new Set(["etabli", "probable"]);

export type Confiance = "etabli" | "probable";

export interface BesoinClient {
  readonly id: string;
  readonly categorie: Besoin["categorie"];
  readonly enonce: string;
  /** Leurs mots, sans nom ni fonction. */
  readonly motsDesEquipes: readonly string[];
  readonly nbPersonnes: number;
  readonly intensite: Besoin["intensite"];
}

export interface ElementClient {
  readonly libelle: string;
  readonly valeur: string;
  readonly confiance: Confiance;
}

export interface SectionClient {
  readonly cle: string;
  readonly titre: string;
  readonly elements: readonly ElementClient[];
}

export interface ExerciceClient {
  readonly annee: number;
  readonly chiffreAffairesEur: number | null;
  readonly resultatNetEur: number | null;
  readonly effectif: string | null;
  readonly confiance: Confiance;
}

export interface DifficultesService {
  readonly service: string;
  readonly difficultes: readonly string[];
  readonly tachesRepetitives: readonly string[];
}

export interface PisteClient {
  readonly id: string;
  readonly titre: string;
  readonly description: string;
  /** Les besoins que la piste sert, rappelés en toutes lettres. */
  readonly besoinsServis: readonly { readonly id: string; readonly enonce: string }[];
  readonly gain: Besoin["intensite"];
  readonly effort: Besoin["intensite"];
  /** 1 = d'abord. Toujours renseigné pour une piste retenue. */
  readonly rang: number;
}

export interface PisteHorsDemandeClient {
  readonly id: string;
  readonly titre: string;
  readonly description: string;
}

export interface QuestionVenue {
  readonly question: string;
  /** Besoin déclaré auquel la question se rattache, s'il y en a un. */
  readonly besoin: string | null;
}

export interface SourceClient {
  readonly reference: string;
  readonly url: string | null;
}

export interface VueClient {
  readonly version: typeof VERSION_VUE_CLIENT;
  readonly raisonSociale: string;
  readonly genereLe: string;
  /** « Ce que vous nous avez dit » — toujours en premier. */
  readonly besoins: readonly BesoinClient[];
  readonly comprehension: readonly SectionClient[];
  readonly evolution: {
    readonly exercices: readonly ExerciceClient[];
    readonly tendance: BaseAudit["evolution_financiere"]["tendance"];
    readonly tauxAnnuelMoyenPct: number | null;
    readonly lecture: string;
  };
  readonly difficultesParService: readonly DifficultesService[];
  readonly pistes: readonly PisteClient[];
  readonly pistesHorsDemande: readonly PisteHorsDemandeClient[];
  readonly preparationVenue: readonly QuestionVenue[];
  readonly sources: readonly SourceClient[];
}

/**
 * Titres lisibles des sections de compréhension, dans l'ordre du rapport.
 * `organisation_equipe` n'en fait PAS partie : elle décrit des personnes (qui fait quoi), pas
 * l'entreprise.
 */
export const TITRES_COMPREHENSION: ReadonlyArray<readonly [BaseAudit_SectionCle, string]> = [
  ["identite", "Qui vous êtes"],
  ["activite_offre", "Votre activité et votre offre"],
  ["processus", "Vos façons de travailler"],
  ["outils_systeme_information", "Vos outils"],
  ["donnees", "Vos données"],
  ["commercial_clients", "Vos clients et votre commercial"],
  ["marche_concurrence", "Votre marché"],
  ["presence_numerique", "Votre présence en ligne"],
  ["maturite_ia", "Où vous en êtes avec l'IA"],
];

type BaseAudit_SectionCle =
  | "identite"
  | "activite_offre"
  | "organisation_equipe"
  | "processus"
  | "outils_systeme_information"
  | "donnees"
  | "commercial_clients"
  | "marche_concurrence"
  | "presence_numerique"
  | "maturite_ia";

export const SERVICE_NON_PRECISE = "Autres services";

function echapper(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Retire les accents en gardant la casse (« Solène » → « Solene »). */
function sansAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function normaliser(s: string): string {
  return sansAccents(s).toLowerCase();
}

/**
 * Version sans accents d'un texte, avec la correspondance des positions : `debut[i]` est la
 * position, dans le texte d'origine, du caractère d'indice `i` du texte sans accents
 * (`debut[texte.length]` = longueur d'origine). Sert à remplacer dans l'ORIGINAL ce qu'on a
 * trouvé dans la version sans accents.
 */
function versionSansAccents(t: string): { texte: string; debut: number[] } {
  let texte = "";
  const debut: number[] = [];
  let pos = 0;
  for (const c of t) {
    const s = sansAccents(c);
    for (let k = 0; k < s.length; k++) debut.push(pos);
    texte += s;
    pos += c.length;
  }
  debut.push(t.length);
  return { texte, debut };
}

/** Particules de noms : jamais cherchées seules (« de », « van »…). */
const PARTICULES: ReadonlySet<string> = new Set([
  "de",
  "des",
  "du",
  "van",
  "der",
  "von",
  "del",
  "dos",
  "ben",
  "mac",
]);

interface NomsAChercher {
  /** Noms entiers (plusieurs mots) : cherchés sans tenir compte de la casse ni des accents. */
  readonly entiers: readonly string[];
  /**
   * Morceaux (prénom, nom de famille) : cherchés SENSIBLES à la casse, seulement avec leur
   * majuscule initiale (ou tout en capitales) — « Pierre » est un nom, « pierre » un mot courant.
   */
  readonly morceaux: readonly string[];
}

function nomsAChercher(base: BaseAudit): NomsAChercher {
  const bruts: string[] = [];
  for (const f of base.fiches_personnes) {
    if (f.identite.nom) bruts.push(f.identite.nom);
    if (f.personne.startsWith("attendu:")) bruts.push(f.personne.slice("attendu:".length));
  }
  for (const nom of base.couverture.personnesAttenduesSansReponse) bruts.push(nom);

  // Les mots de la raison sociale ne sont pas des noms de personne : on ne les cherche pas seuls.
  const motsSociete = new Set(
    normaliser(base.meta.raisonSociale)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((m) => m.length > 0),
  );
  const entiers = new Set<string>();
  const morceaux = new Set<string>();
  for (const n of bruts) {
    const propre = n.trim().replace(/\s+/g, " ");
    const parts = propre.split(/[\s,;/()'’-]+/).filter((p) => p.length > 0);
    if (parts.length > 1 && propre.length >= 3) entiers.add(sansAccents(propre));
    for (const part of parts) {
      const cle = normaliser(part);
      if (part.length < 3 || PARTICULES.has(cle) || motsSociete.has(cle)) continue;
      if (/^\p{Lu}/u.test(part)) morceaux.add(sansAccents(part));
      // Nom d'un seul mot saisi en minuscules : on le cherche quand même, sans casse.
      else if (parts.length === 1) entiers.add(sansAccents(part));
    }
  }
  const parLongueur = (a: string, b: string) => b.length - a.length;
  return {
    entiers: [...entiers].sort(parLongueur),
    morceaux: [...morceaux].sort(parLongueur),
  };
}

/**
 * Les noms de personnes que la base connaît : identité des fiches et clés `attendu:<nom>`.
 * Noms entiers ET leurs éléments (prénom, nom de famille), sans accents, hors particules et
 * hors mots de la raison sociale.
 */
export function nomsConnus(base: BaseAudit): string[] {
  const n = nomsAChercher(base);
  return [...n.entiers, ...n.morceaux];
}

const AVANT = "(?<![\\p{L}\\p{N}])";
const APRES = "(?![\\p{L}\\p{N}])";

/** Motifs (drapeau `g`) à appliquer au texte SANS ACCENTS. */
function motifsNoms(n: NomsAChercher): RegExp[] {
  const motifs: RegExp[] = [];
  if (n.entiers.length > 0) {
    motifs.push(new RegExp(`${AVANT}(?:${n.entiers.map(echapper).join("|")})${APRES}`, "giu"));
  }
  if (n.morceaux.length > 0) {
    const variantes = n.morceaux.flatMap((m) => [m, m.toUpperCase()]);
    motifs.push(
      new RegExp(`${AVANT}(?:${[...new Set(variantes)].map(echapper).join("|")})${APRES}`, "gu"),
    );
  }
  return motifs;
}

/** Remplace, dans le texte d'ORIGINAL, chaque passage trouvé par `motif` dans sa version sans accents. */
function remplacerSansAccents(t: string, motif: RegExp, par: string): string {
  const { texte, debut } = versionSansAccents(t);
  let sortie = "";
  let curseur = 0;
  motif.lastIndex = 0;
  for (const m of texte.matchAll(motif)) {
    const d = debut[m.index]!;
    const f = debut[m.index + m[0].length]!;
    sortie += t.slice(curseur, d) + par;
    curseur = f;
  }
  return sortie + t.slice(curseur);
}

/** Termes significatifs d'un texte (sans accents, minuscules) : nombres, et mots de 4 lettres ou plus. */
function termes(t: string): string[] {
  return normaliser(t)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((m) => /^\p{N}+$/u.test(m) || m.length >= 4);
}

function visible(c: string): c is Confiance {
  return CONFIANCES_VISIBLES.has(c);
}

function unique<T>(xs: readonly T[]): T[] {
  return [...new Set(xs)];
}

/** Construit la vue client. Ne modifie jamais la base. */
export function filtrerPourClient(base: BaseAudit): VueClient {
  const motifs = motifsNoms(nomsAChercher(base));

  /** Retire les noms connus d'un texte libre (comparaison sans accents, positions conservées). */
  const propre = (t: string): string =>
    motifs
      .reduce((acc, m) => remplacerSansAccents(acc, m, "un collaborateur"), t)
      .replace(/\s+/g, " ")
      .trim();
  const contientUnNom = (t: string): boolean => {
    const s = sansAccents(t);
    return motifs.some((m) => {
      m.lastIndex = 0;
      return m.test(s);
    });
  };

  const enonces = new Map(base.besoins_declares.map((b) => [b.id, propre(b.enonce)] as const));

  const besoins: BesoinClient[] = base.besoins_declares.map((b) => ({
    id: b.id,
    categorie: b.categorie,
    enonce: propre(b.enonce),
    // Les mots, jamais l'auteur. Une citation qui nomme quelqu'un est écartée, pas caviardée.
    motsDesEquipes: unique(
      b.citations.map((c) => c.texte.trim()).filter((t) => t.length > 0 && !contientUnNom(t)),
    ),
    nbPersonnes: b.nbPersonnes,
    intensite: b.intensite,
  }));

  const comprehension: SectionClient[] = [];
  for (const [cle, titre] of TITRES_COMPREHENSION) {
    const elements: ElementClient[] = [];
    for (const e of base[cle].elements) {
      if (!visible(e.confiance)) continue;
      elements.push({
        libelle: propre(e.libelle),
        valeur: propre(e.valeur),
        confiance: e.confiance,
      });
    }
    if (elements.length > 0) comprehension.push({ cle, titre, elements });
  }

  const ev = base.evolution_financiere;
  const exercices: ExerciceClient[] = [...ev.exercices]
    .filter((x) => visible(x.confiance))
    .sort((a, b) => a.annee - b.annee)
    .map((x) => ({
      annee: x.annee,
      chiffreAffairesEur: x.chiffreAffairesEur,
      resultatNetEur: x.resultatNetEur,
      effectif: x.effectif,
      confiance: x.confiance as Confiance,
    }));
  // Tendance fondée sur des chiffres qu'on ne montre pas : on ne la montre pas non plus.
  const tendanceLisible = exercices.length >= 2 && ev.exercices.length === exercices.length;

  // Difficultés PAR SERVICE : jamais la personne, jamais le temps individuel. Un service où
  // moins de deux personnes ont répondu désignerait quelqu'un : il rejoint « Autres services ».
  const repondants = base.fiches_personnes.filter((f) => f.statut === "a_repondu");
  const nomService = (f: (typeof repondants)[number]): string =>
    f.identite.service?.trim() ? propre(f.identite.service) : SERVICE_NON_PRECISE;
  const effectifs = new Map<string, number>();
  for (const f of repondants) {
    const s = nomService(f);
    effectifs.set(s, (effectifs.get(s) ?? 0) + 1);
  }
  const parService = new Map<string, { difficultes: string[]; taches: string[] }>();
  for (const f of repondants) {
    const brut = nomService(f);
    const service = (effectifs.get(brut) ?? 0) >= 2 ? brut : SERVICE_NON_PRECISE;
    const entree = parService.get(service) ?? { difficultes: [], taches: [] };
    for (const d of f.douleurs) entree.difficultes.push(propre(d.enonce));
    for (const t of f.taches) {
      if (t.repetitive === true || t.ressaisie === true) entree.taches.push(propre(t.libelle));
    }
    parService.set(service, entree);
  }
  const difficultesParService: DifficultesService[] = [...parService.entries()]
    .map(([service, v]) => ({
      service,
      difficultes: unique(v.difficultes),
      tachesRepetitives: unique(v.taches),
    }))
    .filter((s) => s.difficultes.length + s.tachesRepetitives.length > 0)
    .sort((a, b) =>
      a.service === SERVICE_NON_PRECISE
        ? 1
        : b.service === SERVICE_NON_PRECISE
          ? -1
          : a.service.localeCompare(b.service, "fr"),
    );

  // Pistes retenues : par rang croissant, celles sans rang à la fin, puis renumérotées 1..n.
  const pistes: PisteClient[] = base.pistes
    .filter((p) => !p.horsDemande)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const x = a.p.rang ?? Infinity;
      const y = b.p.rang ?? Infinity;
      return x === y ? a.i - b.i : x < y ? -1 : 1;
    })
    .map(({ p }, i) => ({
      id: p.id,
      titre: propre(p.titre),
      description: propre(p.description),
      besoinsServis: p.besoinsServis
        .filter((id) => enonces.has(id))
        .map((id) => ({ id, enonce: enonces.get(id) ?? "" })),
      gain: p.gain,
      effort: p.effort,
      rang: i + 1,
    }));

  const pistesHorsDemande: PisteHorsDemandeClient[] = base.pistes
    .filter((p) => p.horsDemande)
    .map((p) => ({ id: p.id, titre: propre(p.titre), description: propre(p.description) }));

  // Préparation de la venue : seulement les questions rattachées à un besoin déclaré, et aucune
  // qui reprenne un terme d'une contradiction (elle trahirait un désaccord interne).
  const termesContradictions = new Set(
    base.contradictions.flatMap((c) => termes(`${c.versionA} ${c.versionB}`)),
  );
  const preparationVenue: QuestionVenue[] = base.questions_jour_j
    .filter((q) => q.besoinId !== undefined && enonces.has(q.besoinId))
    .filter((q) => !termes(q.question).some((t) => termesContradictions.has(t)))
    .map((q) => ({
      question: propre(q.question),
      besoin: enonces.get(q.besoinId ?? "") ?? null,
    }));

  // Seules les sources que nous avons trouvées : une source « questionnaire » désigne une personne.
  const vues = new Set<string>();
  const sources: SourceClient[] = [];
  for (const s of base.sources as readonly Source[]) {
    if (s.type === "questionnaire") continue;
    const cle = `${s.reference}|${s.url ?? ""}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    sources.push({ reference: propre(s.reference), url: s.url ?? null });
  }

  return {
    version: VERSION_VUE_CLIENT,
    raisonSociale: base.meta.raisonSociale,
    genereLe: base.meta.genereLe,
    besoins,
    comprehension,
    evolution: {
      exercices,
      tendance: tendanceLisible ? ev.tendance : "indeterminee",
      tauxAnnuelMoyenPct: tendanceLisible ? ev.tauxAnnuelMoyenPct : null,
      lecture: tendanceLisible ? propre(ev.lecture) : "",
    },
    difficultesParService,
    pistes,
    pistesHorsDemande,
    preparationVenue,
    sources,
  };
}

export const LIBELLE_CATEGORIE: Record<Besoin["categorie"], string> = {
  douleur: "Ce qui vous pèse",
  souhait: "Ce que vous souhaitez",
  objectif: "Ce que vous visez",
  contrainte: "Ce qui vous contraint",
  priorite: "Ce qui passe en premier",
};

export const LIBELLE_NIVEAU: Record<"faible" | "moyen" | "fort", string> = {
  faible: "faible",
  moyen: "moyen",
  fort: "fort",
};

export const LIBELLE_TENDANCE: Record<VueClient["evolution"]["tendance"], string> = {
  croissance: "en croissance",
  stabilite: "stable",
  decroissance: "en recul",
  indeterminee: "indéterminée",
};
