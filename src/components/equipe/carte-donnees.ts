import { REGIONS } from "@/content/regions";
import {
  HAUTEUR_CARTE,
  SLUGS_RESERVES,
  decalagesCouronne,
  positionSurCarte,
  slugifier,
  coordonneesDe,
  type Categorie,
  type FichePublique,
  type PointCarte,
  type VilleConnue,
} from "@/lib/equipe";

/** Rayon de la couronne (repère de la carte) : deux cibles voisines de 12 de rayon ne se recouvrent presque pas. */
export const RAYON_COURONNE = 26;
/** Rayon de la couronne dans l'encart d'outre-mer (cases plus étroites). */
export const RAYON_COURONNE_ENCART = 22;
/** Deux amas dont les centres sont plus proches que cela sont fusionnés (cibles de 12 de rayon sans recouvrement). */
export const DISTANCE_FUSION = 2 * RAYON_COURONNE_ENCART;

/** Les cinq départements d'outre-mer présentables dans l'encart. */
export const CODES_OUTRE_MER = ["971", "972", "973", "974", "976"] as const;
export type CodeOutreMer = (typeof CODES_OUTRE_MER)[number];

export const ENCART = { x: 12, largeurFente: 76, hauteur: 104, marge: 12 } as const;
/** Haut de l'encart d'outre-mer (bas-gauche, hors du tracé de la métropole). */
export const ENCART_HAUT = HAUTEUR_CARTE - ENCART.hauteur - ENCART.marge;

export interface Amas {
  /** Identifiant stable (ancre de la liste) : « equipe-ville-… ». */
  ancre: string;
  libelle: string;
  /** Lieu de chaque personne (slug → ville ou département) : l'intitulé d'un point ne reprend jamais la ville d'une autre personne. */
  lieux: Readonly<Record<string, string>>;
  /** Centre du groupe sur la carte (ou dans l'encart). */
  centre: PointCarte;
  personnes: ReadonlyArray<FichePublique>;
  /** Positions de la couronne (relatives au centre) ; `null` au-delà de `COURONNE_MAX` : point « +N ». */
  decalages: PointCarte[] | null;
  /** `null` pour la métropole, sinon le code du département d'outre-mer. */
  outreMer: CodeOutreMer | null;
}

export interface GroupeVille {
  ancre: string;
  libelle: string;
  personnes: ReadonlyArray<FichePublique>;
}

export interface GroupeRegion {
  cle: string;
  ancre: string;
  libelle: string;
  villes: ReadonlyArray<GroupeVille>;
}

export interface DonneesCarte {
  amas: ReadonlyArray<Amas>;
  regions: ReadonlyArray<GroupeRegion>;
  total: number;
  parCategorie: ReadonlyArray<{ categorie: Categorie; nombre: number }>;
  outreMerPresent: boolean;
}

/** Code département normalisé (« 1 » → « 01 », casse indifférente), comme `coordonneesDe`. */
const normalise = (c: string | null | undefined): string => {
  const v = (c ?? "").trim().toUpperCase();
  return /^\d$/.test(v) ? `0${v}` : v;
};
const regionDe = new Map<string, { cle: string; libelle: string }>();
for (const r of REGIONS) {
  for (const d of r.departements) regionDe.set(d.toUpperCase(), { cle: r.slug, libelle: r.nameFr });
}

/** Département d'une ville connue du jeu, si un seul département la porte. */
function depDeLaVille(ville: string | undefined, villes: ReadonlyArray<VilleConnue>): string {
  const cle = slugifier(ville);
  if (!cle) return "";
  const deps = new Set(
    villes.filter((v) => slugifier(v.nameFr) === cle).map((v) => normalise(v.departement)),
  );
  return deps.size === 1 ? ([...deps][0] ?? "") : "";
}

const estOutreMer = (c: string): c is CodeOutreMer =>
  (CODES_OUTRE_MER as readonly string[]).includes(c);

/** Ordre de lecture : les régions métropolitaines par nom, puis l'outre-mer dans l'ordre des codes. */
function rangRegion(cle: string): number {
  const r = REGIONS.find((x) => x.slug === cle);
  if (!r) return 1000;
  if (r.type === "drom") return 500 + Number(r.departements[0]);
  return 0;
}

/** Une personne n'a de point que si elle est publiée pour la carte, n'est ni le dirigeant ni une identité réservée. */
export function estPlacable(f: FichePublique, avecDirigeant = false): boolean {
  if (!f.afficherSurCarte) return false;
  if (f.estDirigeantPrincipal) return avecDirigeant;
  return !SLUGS_RESERVES.includes(f.slug);
}

export function preparerCarte(
  fiches: ReadonlyArray<FichePublique>,
  villes: ReadonlyArray<VilleConnue> = [],
  { avecDirigeant = false }: { avecDirigeant?: boolean } = {},
): DonneesCarte {
  type Place = {
    f: FichePublique;
    dep: string;
    ville: string;
    outreMer: CodeOutreMer | null;
    pos: PointCarte | null;
  };
  const places: Place[] = [];
  for (const f of fiches.filter((f) => estPlacable(f, avecDirigeant))) {
    const lieu = { ville: f.ville ?? null, departement: normalise(f.departement) || null };
    const dep = normalise(f.departement) || depDeLaVille(f.ville, villes);
    const coord = coordonneesDe(lieu, villes);
    if (!coord) continue;
    const outreMer = estOutreMer(dep) ? dep : null;
    const pos = outreMer ? null : positionSurCarte(lieu, villes);
    if (!outreMer && !pos) continue; // hors métropole sans département d'outre-mer connu : pas de point
    places.push({ f, dep, ville: (f.ville ?? "").trim(), outreMer, pos });
  }
  places.sort((a, b) => a.f.nom.localeCompare(b.f.nom, "fr") || a.f.slug.localeCompare(b.f.slug));

  // Liste : région puis ville.
  const parRegion = new Map<
    string,
    Map<string, { libelle: string; ancre: string; personnes: FichePublique[] }>
  >();
  const libellesRegion = new Map<string, string>();
  for (const p of places) {
    const reg = regionDe.get(p.dep) ?? { cle: "autres", libelle: "Autres localisations" };
    libellesRegion.set(reg.cle, reg.libelle);
    const cleVille = `${p.dep || "x"}-${slugifier(p.ville) || "departement"}`;
    const villes_ = parRegion.get(reg.cle) ?? new Map();
    const v = villes_.get(cleVille) ?? {
      libelle: p.ville || `Département ${p.dep}`,
      ancre: `equipe-ville-${cleVille}`,
      personnes: [],
    };
    v.personnes.push(p.f);
    villes_.set(cleVille, v);
    parRegion.set(reg.cle, villes_);
  }
  const regions: GroupeRegion[] = [...parRegion.entries()]
    .map(([cle, vs]) => ({
      cle,
      ancre: `equipe-region-${cle}`,
      libelle: libellesRegion.get(cle) ?? cle,
      villes: [...vs.values()].sort((a, b) => a.libelle.localeCompare(b.libelle, "fr")),
    }))
    .sort(
      (a, b) => rangRegion(a.cle) - rangRegion(b.cle) || a.libelle.localeCompare(b.libelle, "fr"),
    );

  // Carte : un amas par point projeté (métropole) ou par département d'outre-mer ;
  // en métropole, les amas trop proches (Île-de-France…) sont fusionnés.
  type Groupe = { centre: PointCarte | null; outreMer: CodeOutreMer | null; ps: Place[] };
  const groupes: Groupe[] = [];
  for (const p of places) {
    const proche = groupes.find((g) =>
      p.outreMer
        ? g.outreMer === p.outreMer
        : g.outreMer === null &&
          g.centre !== null &&
          p.pos !== null &&
          Math.hypot(g.centre.x - p.pos.x, g.centre.y - p.pos.y) < DISTANCE_FUSION,
    );
    if (proche) proche.ps.push(p);
    else groupes.push({ centre: p.pos, outreMer: p.outreMer, ps: [p] });
  }
  const presentsOM = CODES_OUTRE_MER.filter((c) => groupes.some((g) => g.outreMer === c));
  const cleVilleDe = (p: Place) => `${p.dep || "x"}-${slugifier(p.ville) || "departement"}`;
  const regionCleDe = (p: Place) => regionDe.get(p.dep)?.cle ?? "autres";
  const amas: Amas[] = groupes.flatMap((g) => {
    const premier = g.ps[0];
    if (!premier) return [];
    const centre =
      g.outreMer !== null
        ? {
            x: ENCART.x + ENCART.largeurFente * (presentsOM.indexOf(g.outreMer) + 0.5),
            y: ENCART_HAUT + 44,
          }
        : (g.centre as PointCarte);
    const villesDuGroupe = new Set(g.ps.map(cleVilleDe));
    const regionsDuGroupe = new Set(g.ps.map(regionCleDe));
    const ancre =
      villesDuGroupe.size === 1
        ? `equipe-ville-${cleVilleDe(premier)}`
        : regionsDuGroupe.size === 1
          ? `equipe-region-${regionCleDe(premier)}`
          : "equipe-liste";
    const lieuDe = (p: Place) =>
      p.ville || (p.outreMer ? (regionDe.get(p.outreMer)?.libelle ?? "") : `département ${p.dep}`);
    return [
      {
        ancre,
        libelle:
          villesDuGroupe.size === 1
            ? lieuDe(premier)
            : (regionDe.get(premier.dep)?.libelle ?? lieuDe(premier)),
        lieux: Object.fromEntries(g.ps.map((p) => [p.f.slug, lieuDe(p)])),
        centre,
        personnes: g.ps.map((p) => p.f),
        decalages: decalagesCouronne(
          g.ps.length,
          g.outreMer ? RAYON_COURONNE_ENCART : RAYON_COURONNE,
        ),
        outreMer: g.outreMer,
      },
    ];
  });

  const compte = new Map<Categorie, number>();
  for (const p of places) compte.set(p.f.categorie, (compte.get(p.f.categorie) ?? 0) + 1);
  return {
    amas,
    regions,
    total: places.length,
    parCategorie: [...compte.entries()].map(([categorie, nombre]) => ({ categorie, nombre })),
    outreMerPresent: presentsOM.length > 0,
  };
}
