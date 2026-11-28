/**
 * Composition PURE du hub `/fr/equipe` : sections par catégorie, fiches de la carte, entrées du
 * sitemap. Aucune lecture de base ici (les lecteurs sont dans `collaborateurs.ts`) : la page et le
 * sitemap lui passent des lignes déjà lues, ce qui rend le comportement testable sans Prisma.
 *
 * Williams est STATIQUE : toujours présent, en tête de « Direction », même sur la base stub.
 * Prénom seul pour tous les autres, jamais d'e-mail ni de nom de famille.
 */
import { FICHES_HUB_STATIQUES } from "@/content/equipe/hub";
import { evaluerIndexabilite } from "./donnees/indexabilite";
import { categoriePublique } from "./depuis-membre-categorie";
import { ficheDepuisMembre, type MembrePublic } from "./depuis-membre";
import { categoriesOrdonnees } from "./categories";
import { fichePublique, SLUG_DIRIGEANT_PRINCIPAL } from "./regles";
import type { PointCarteMembre } from "./collaborateurs";
import type { Categorie, FichePublique } from "./types";

/** Slugs de pages techniques qui ne sont jamais une fiche (jamais au sitemap). */
const SLUGS_TECHNIQUES: ReadonlyArray<string> = ["questionnaire", "retrait", "carte"];

export interface SectionHub {
  categorie: ReturnType<typeof categoriesOrdonnees>[number];
  fiches: FichePublique[];
}

export interface HubEquipe {
  sections: SectionHub[];
  /** Fiches à placer sur la carte (publiées, `afficherSurCarte`, avec un lieu). */
  fichesCarte: FichePublique[];
  /** Williams a une ligne facultative avec lieu : la carte doit alors accepter le dirigeant. */
  williamsSurCarte: boolean;
  /** Personnes de l'`ItemList` JSON-LD : Williams + fiches INDEXABLES seulement. */
  indexables: Array<{ slug: string; estDirigeantPrincipal: boolean }>;
  /** Nombre de collaborateurs affichés (Manon n'est jamais comptée). */
  total: number;
}

function fichesStatiques(): FichePublique[] {
  return FICHES_HUB_STATIQUES.map((f) => fichePublique(f)).filter(
    (f): f is FichePublique => f !== null,
  );
}

/** Points de la carte → fiches publiques (prénom seul). Sans lieu exploitable : écarté. */
export function fichesCarteDepuisPoints(points: ReadonlyArray<PointCarteMembre>): FichePublique[] {
  const out: FichePublique[] = [];
  for (const p of points) {
    const departement = (p.departmentCode ?? "").trim();
    if (departement === "") continue;
    const estWilliams = p.slug === SLUG_DIRIGEANT_PRINCIPAL;
    if (estWilliams) {
      // La ligne « williams » ne porte QUE le lieu : identité et contenu restent statiques.
      const w = fichesStatiques().find((f) => f.estDirigeantPrincipal);
      if (!w) continue;
      out.push({ ...w, afficherSurCarte: true, departement });
      continue;
    }
    const ville = (p.locationLabel ?? "").trim();
    const f = fichePublique({
      slug: p.slug,
      categorie: categoriePublique(p.category),
      prenom: p.firstName,
      estDirigeantPrincipal: false,
      accord: "n",
      fonction: "",
      reponseQui: "",
      afficherSurCarte: true,
      ...(ville ? { ville } : {}),
      departement,
    });
    if (f && f.slug === p.slug) out.push(f);
  }
  return out;
}

export function construireHubEquipe(
  membres: ReadonlyArray<MembrePublic>,
  points: ReadonlyArray<PointCarteMembre>,
): HubEquipe {
  const statiques = fichesStatiques();
  const deLaBase: Array<{ fiche: FichePublique; indexable: boolean }> = [];
  const vus = new Set(statiques.map((f) => f.slug));
  for (const m of membres) {
    const publique = fichePublique(ficheDepuisMembre(m).fiche);
    if (!publique || publique.slug !== m.slug || vus.has(publique.slug)) continue;
    vus.add(publique.slug);
    deLaBase.push({ fiche: publique, indexable: evaluerIndexabilite(m).indexable });
  }
  const toutes = [...statiques, ...deLaBase.map((d) => d.fiche)];
  const sections = categoriesOrdonnees()
    .map((categorie) => ({
      categorie,
      fiches: toutes.filter((f) => f.categorie === (categorie.id as Categorie)),
    }))
    .filter((s) => s.fiches.length > 0);
  const fichesCarte = fichesCarteDepuisPoints(points);
  return {
    sections,
    fichesCarte,
    williamsSurCarte: fichesCarte.some((f) => f.estDirigeantPrincipal),
    indexables: [
      ...statiques.map((f) => ({ slug: f.slug, estDirigeantPrincipal: f.estDirigeantPrincipal })),
      ...deLaBase
        .filter((d) => d.indexable)
        .map((d) => ({ slug: d.fiche.slug, estDirigeantPrincipal: false })),
    ],
    total: toutes.length,
  };
}

/** Fiches publiées ET indexables, pour le sitemap. Williams et Manon y ont déjà leur entrée. */
export function fichesSitemapEquipe(
  membres: ReadonlyArray<MembrePublic>,
): Array<{ slug: string; lastModified: Date }> {
  return membres
    .filter(
      (m) =>
        m.slug !== SLUG_DIRIGEANT_PRINCIPAL &&
        m.slug !== "manon" &&
        !SLUGS_TECHNIQUES.includes(m.slug) &&
        evaluerIndexabilite(m).indexable,
    )
    .map((m) => ({ slug: m.slug, lastModified: m.updatedAt }));
}
