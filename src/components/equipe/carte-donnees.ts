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

/** Les cinq départements d'outre-mer présentables dans l'encart. */
export const CODES_OUTRE_MER = ["971", "972", "973", "974", "976"] as const;
export type CodeOutreMer = (typeof CODES_OUTRE_MER)[number];

export const ENCART = { x: 12, largeurFente: 62, hauteur: 104, marge: 12 } as const;
/** Haut de l'encart d'outre-mer (bas-gauche, hors du tracé de la métropole). */
export const ENCART_HAUT = HAUTEUR_CARTE - ENCART.hauteur - ENCART.marge;

export interface Amas {
  /** Identifiant stable (ancre de la liste) : « equipe-ville-… ». */
  ancre: string;
  libelle: string;
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

const normalise = (c: string | null | undefined): string => (c ?? "").trim().toUpperCase();
const regionDe = new Map<string, { cle: string; libelle: string }>();
for (const r of REGIONS) {
  for (const d of r.departements) regionDe.set(d.toUpperCase(), { cle: r.slug, libelle: r.nameFr });
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
export function estPlacable(f: FichePublique): boolean {
  return f.afficherSurCarte && !f.estDirigeantPrincipal && !SLUGS_RESERVES.includes(f.slug);
}

export function preparerCarte(
  fiches: ReadonlyArray<FichePublique>,
  villes: ReadonlyArray<VilleConnue> = [],
): DonneesCarte {
  type Place = {
    f: FichePublique;
    dep: string;
    ville: string;
    outreMer: CodeOutreMer | null;
    pos: PointCarte | null;
  };
  const places: Place[] = [];
  for (const f of fiches.filter(estPlacable)) {
    const lieu = { ville: f.ville ?? null, departement: f.departement ?? null };
    const dep = normalise(f.departement);
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
      libelle: libellesRegion.get(cle) ?? cle,
      villes: [...vs.values()].sort((a, b) => a.libelle.localeCompare(b.libelle, "fr")),
    }))
    .sort(
      (a, b) => rangRegion(a.cle) - rangRegion(b.cle) || a.libelle.localeCompare(b.libelle, "fr"),
    );

  // Carte : un amas par point projeté (métropole) ou par département d'outre-mer.
  const groupes = new Map<string, Place[]>();
  for (const p of places) {
    const cle = p.outreMer ?? `${p.pos?.x}:${p.pos?.y}`;
    groupes.set(cle, [...(groupes.get(cle) ?? []), p]);
  }
  const presentsOM = CODES_OUTRE_MER.filter((c) => groupes.has(c));
  const amas: Amas[] = [...groupes.entries()].flatMap(([, ps]) => {
    const premier = ps[0];
    if (!premier) return [];
    const outreMer = premier.outreMer;
    const centre = outreMer
      ? {
          x: ENCART.x + ENCART.largeurFente * (presentsOM.indexOf(outreMer) + 0.5),
          y: ENCART_HAUT + 44,
        }
      : (premier.pos as PointCarte);
    return [
      {
        ancre: `equipe-ville-${premier.dep || "x"}-${slugifier(premier.ville) || "departement"}`,
        libelle: outreMer
          ? (regionDe.get(outreMer)?.libelle ?? premier.ville)
          : premier.ville || `Département ${premier.dep}`,
        centre,
        personnes: ps.map((p) => p.f),
        decalages: decalagesCouronne(ps.length, RAYON_COURONNE),
        outreMer,
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
