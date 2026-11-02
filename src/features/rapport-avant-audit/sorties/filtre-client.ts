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

/** Titres lisibles des sections de compréhension, dans l'ordre du rapport. */
export const TITRES_COMPREHENSION: ReadonlyArray<readonly [BaseAudit_SectionCle, string]> = [
  ["identite", "Qui vous êtes"],
  ["activite_offre", "Votre activité et votre offre"],
  ["organisation_equipe", "Votre organisation"],
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

function normaliser(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Les noms de personnes que la base connaît : identité des fiches et clés `attendu:<nom>`.
 * On garde le nom entier ET ses éléments d'au moins trois lettres (prénom, nom de famille).
 */
export function nomsConnus(base: BaseAudit): string[] {
  const bruts: string[] = [];
  for (const f of base.fiches_personnes) {
    if (f.identite.nom) bruts.push(f.identite.nom);
    if (f.personne.startsWith("attendu:")) bruts.push(f.personne.slice("attendu:".length));
  }
  for (const nom of base.couverture.personnesAttenduesSansReponse) bruts.push(nom);
  const jetons = new Set<string>();
  for (const n of bruts) {
    const propre = n.trim();
    if (propre.length >= 3) jetons.add(propre);
    for (const part of propre.split(/[\s,;/()'’-]+/)) if (part.length >= 3) jetons.add(part);
  }
  return [...jetons].sort((a, b) => b.length - a.length);
}

function motifNoms(noms: readonly string[]): RegExp | null {
  if (noms.length === 0) return null;
  return new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${noms.map(echapper).join("|")})(?![\\p{L}\\p{N}])`,
    "iu",
  );
}

function visible(c: string): c is Confiance {
  return CONFIANCES_VISIBLES.has(c);
}

function unique<T>(xs: readonly T[]): T[] {
  return [...new Set(xs)];
}

/** Construit la vue client. Ne modifie jamais la base. */
export function filtrerPourClient(base: BaseAudit): VueClient {
  const noms = nomsConnus(base);
  const motif = motifNoms(noms);
  const motifG = motif ? new RegExp(motif.source, "giu") : null;

  /** Retire les noms connus d'un texte libre. */
  const propre = (t: string): string =>
    (motifG ? t.replace(motifG, "un collaborateur") : t).replace(/\s+/g, " ").trim();
  const contientUnNom = (t: string): boolean =>
    motif ? motif.test(normaliser(t)) || motif.test(t) : false;

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

  // Difficultés PAR SERVICE : jamais la personne, jamais le temps individuel.
  const parService = new Map<string, { difficultes: string[]; taches: string[] }>();
  for (const f of base.fiches_personnes) {
    if (f.statut !== "a_repondu") continue;
    const service = f.identite.service?.trim() ? propre(f.identite.service) : SERVICE_NON_PRECISE;
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

  const pistes: PisteClient[] = base.pistes
    .filter((p) => !p.horsDemande && p.rang !== null)
    .sort((a, b) => (a.rang ?? 0) - (b.rang ?? 0))
    .map((p) => ({
      id: p.id,
      titre: propre(p.titre),
      description: propre(p.description),
      besoinsServis: p.besoinsServis
        .filter((id) => enonces.has(id))
        .map((id) => ({ id, enonce: enonces.get(id) ?? "" })),
      gain: p.gain,
      effort: p.effort,
      rang: p.rang ?? 0,
    }));

  const pistesHorsDemande: PisteHorsDemandeClient[] = base.pistes
    .filter((p) => p.horsDemande)
    .map((p) => ({ id: p.id, titre: propre(p.titre), description: propre(p.description) }));

  const preparationVenue: QuestionVenue[] = base.questions_jour_j.map((q) => ({
    question: propre(q.question),
    besoin: q.besoinId ? (enonces.get(q.besoinId) ?? null) : null,
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
