// Fonctions PURES du script `scripts/villes/donnees-factuelles.ts` (tâche X-4, vague 3).
//
// Séparées du script pour être testées sans fichier réel ni réseau. Aucune fonction ici ne
// lit le disque ni le réseau : le script leur passe les lignes déjà lues.
//
// Règle : on ne produit QUE des faits lus dans une source publique, chacun avec sa source et
// sa date. Un champ sans source reste absent (jamais d'« ordre de grandeur »).
import type { VilleData } from "../../../src/content/villes/data/types";
import type {
  Fait,
  SecteurNaf,
  VilleDonneesFactuelles,
} from "../../../src/content/villes/donnees-factuelles/schema";

export const SOURCE_GEO = {
  population: "INSEE, population municipale, via l'API Découpage administratif (geo.api.gouv.fr)",
  cog: "INSEE, Code officiel géographique, via l'API Découpage administratif (geo.api.gouv.fr)",
  url: "https://geo.api.gouv.fr/decoupage-administratif/communes",
} as const;

export const SOURCE_SIRENE = {
  libelle: "INSEE, base Sirene, fichier Stock des établissements (données ouvertes)",
  url: "https://www.data.gouv.fr/fr/datasets/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret/",
} as const;

/** Nombre maximal de divisions NAF retenues comme « secteurs dominants ». */
export const NB_SECTEURS = 5;

/**
 * Découpe une ligne CSV (séparateur `,` par défaut) en respectant les guillemets doubles
 * et l'échappement `""`. Suffisant pour le Stock Sirene, qui n'a pas de retour à la ligne
 * dans ses champs.
 */
export function decouperLigneCsv(ligne: string, separateur = ","): string[] {
  const champs: string[] = [];
  let courant = "";
  let entreGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (entreGuillemets) {
      if (c === '"') {
        if (ligne[i + 1] === '"') {
          courant += '"';
          i++;
        } else {
          entreGuillemets = false;
        }
      } else {
        courant += c;
      }
    } else if (c === '"') {
      entreGuillemets = true;
    } else if (c === separateur) {
      champs.push(courant);
      courant = "";
    } else {
      courant += c;
    }
  }
  champs.push(courant);
  return champs;
}

/**
 * Sirene code les établissements de Paris, Lyon et Marseille par ARRONDISSEMENT
 * (75101-75120, 69381-69389, 13201-13216) ; les données villes du dépôt utilisent le code
 * de la commune (75056, 69123, 13055). On rattache donc l'arrondissement à sa commune.
 */
export function communeDeRattachement(codeCommune: string): string {
  if (/^751(0[1-9]|1\d|20)$/.test(codeCommune)) return "75056";
  if (/^6938[1-9]$/.test(codeCommune)) return "69123";
  if (/^132(0[1-9]|1[0-6])$/.test(codeCommune)) return "13055";
  return codeCommune;
}

/** Division NAF (2 chiffres) d'un code d'activité `62.01Z`, ou `null` s'il est illisible. */
export function divisionNaf(codeActivite: string): string | null {
  const m = /^(\d{2})\.\d{2}[A-Z]$/.exec(codeActivite.trim());
  return m?.[1] ?? null;
}

export interface AgregatCommune {
  total: number;
  parDivision: Map<string, number>;
}

/**
 * Agrège des lignes du Stock Sirene établissements, déjà indexées par nom de colonne.
 * Ne compte que les établissements ACTIFS (`etatAdministratifEtablissement === "A"`) des
 * communes demandées. Un établissement sans code NAF lisible compte dans le total mais dans
 * aucune division.
 */
export class AgregateurSirene {
  private readonly communes = new Map<string, AgregatCommune>();

  constructor(private readonly codesCibles: ReadonlySet<string>) {}

  ajouter(ligne: Readonly<Record<string, string | undefined>>): void {
    if (ligne.etatAdministratifEtablissement !== "A") return;
    const brut = ligne.codeCommuneEtablissement;
    if (!brut) return;
    const code = communeDeRattachement(brut.trim());
    if (!this.codesCibles.has(code)) return;
    let agregat = this.communes.get(code);
    if (!agregat) {
      agregat = { total: 0, parDivision: new Map() };
      this.communes.set(code, agregat);
    }
    agregat.total++;
    const division = divisionNaf(ligne.activitePrincipaleEtablissement ?? "");
    if (division) {
      agregat.parDivision.set(division, (agregat.parDivision.get(division) ?? 0) + 1);
    }
  }

  resultat(): ReadonlyMap<string, AgregatCommune> {
    return this.communes;
  }
}

/**
 * Transforme un flux de lignes CSV (en-tête compris) en objets indexés par colonne et les
 * passe à l'agrégateur. Le séparateur est déduit de l'en-tête (`,` ou `;`).
 */
export function agregerLignesSirene(lignes: Iterable<string>, agregateur: AgregateurSirene): void {
  let entete: string[] | null = null;
  let separateur = ",";
  for (const brute of lignes) {
    const ligne = brute.replace(/\r$/, "");
    if (!ligne) continue;
    if (!entete) {
      separateur = ligne.includes(";") && !ligne.includes(",") ? ";" : ",";
      entete = decouperLigneCsv(ligne, separateur);
      continue;
    }
    const valeurs = decouperLigneCsv(ligne, separateur);
    const objet: Record<string, string | undefined> = {};
    entete.forEach((col, i) => {
      objet[col] = valeurs[i];
    });
    agregateur.ajouter(objet);
  }
}

/** Les `n` divisions les plus représentées, à égalité triées par code croissant. */
export function secteursDominants(
  agregat: AgregatCommune,
  libelles: ReadonlyMap<string, string> = new Map(),
  n = NB_SECTEURS,
): SecteurNaf[] {
  return [...agregat.parDivision.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([division, etablissements]) => {
      const libelle = libelles.get(division);
      return libelle ? { division, libelle, etablissements } : { division, etablissements };
    });
}

export interface EntreeConstruction {
  ville: VilleData;
  /** Nom de la région, lu dans `src/content/regions.ts` (absent = champ omis). */
  regionNom: string | undefined;
  /** Date (AAAA-MM-JJ) à laquelle les données INSEE versionnées ont été relevées. */
  releve: string;
  sirene?: {
    agregat: AgregatCommune | undefined;
    /** Millésime du fichier Stock Sirene utilisé (AAAA-MM). */
    millesime: string;
    libelles?: ReadonlyMap<string, string>;
  };
}

function fait<T>(
  valeur: T,
  source: string,
  url: string,
  date: string,
  nature: "millesime" | "releve",
): Fait<T> {
  return { valeur, source, url, date, natureDate: nature };
}

/** Construit l'entrée d'une ville. Tout champ sans valeur lue est OMIS. */
export function construireVille(e: EntreeConstruction): VilleDonneesFactuelles {
  const { ville, releve } = e;
  const sortie: VilleDonneesFactuelles = { slug: ville.slug, inseeCode: ville.inseeCode };
  if (Number.isInteger(ville.population) && ville.population > 0) {
    sortie.population = fait(
      ville.population,
      SOURCE_GEO.population,
      SOURCE_GEO.url,
      releve,
      "releve",
    );
  }
  if (ville.departement) {
    sortie.departement = fait(ville.departement, SOURCE_GEO.cog, SOURCE_GEO.url, releve, "releve");
  }
  if (e.regionNom) {
    sortie.region = fait(e.regionNom, SOURCE_GEO.cog, SOURCE_GEO.url, releve, "releve");
  }
  const agregat = e.sirene?.agregat;
  if (e.sirene && agregat && agregat.total > 0) {
    const { millesime } = e.sirene;
    sortie.etablissementsActifs = fait(
      agregat.total,
      SOURCE_SIRENE.libelle,
      SOURCE_SIRENE.url,
      millesime,
      "millesime",
    );
    const secteurs = secteursDominants(agregat, e.sirene.libelles);
    if (secteurs.length > 0) {
      sortie.secteursDominants = fait(
        secteurs,
        SOURCE_SIRENE.libelle,
        SOURCE_SIRENE.url,
        millesime,
        "millesime",
      );
    }
  }
  return sortie;
}

/**
 * Lit un fichier de libellés NAF `division;libellé` (ou `,`), téléchargé à la main depuis la
 * nomenclature INSEE. Les lignes dont la division n'a pas 2 chiffres sont ignorées.
 */
export function lireLibellesNaf(lignes: Iterable<string>): Map<string, string> {
  const libelles = new Map<string, string>();
  for (const brute of lignes) {
    const ligne = brute.replace(/\r$/, "");
    const sep = ligne.includes(";") ? ";" : ",";
    const [code, ...reste] = decouperLigneCsv(ligne, sep);
    const division = code?.trim().replace(/^(?:Division\s+)?/i, "");
    const libelle = reste.join(sep).trim();
    if (division && /^\d{2}$/.test(division) && libelle) libelles.set(division, libelle);
  }
  return libelles;
}
