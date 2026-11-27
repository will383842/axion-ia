import { CATEGORIES } from "./categories";
import type { FicheCollaborateur, FichePublique } from "./types";

/** Seul le dirigeant principal est nommé en entier. Son slug est figé. */
export const SLUG_DIRIGEANT_PRINCIPAL = "williams";
/** Slugs réservés : jamais attribués à un autre collaborateur. */
export const SLUGS_RESERVES: ReadonlyArray<string> = [SLUG_DIRIGEANT_PRINCIPAL, "manon"];

const LONGUEUR_REPONSE_MIN = 280;
const LONGUEUR_REPONSE_MAX = 450;
const ELEMENTS_DISTINCTIFS_MIN = 3;

/** Formulations refusées dans les textes d'une fiche (règles de communication). */
export const FORMULATIONS_INTERDITES: ReadonlyArray<RegExp> = [
  /€/,
  /\bcommissions?\b/i,
  /frais de d[ée]placement/i,
  /top\s*1\s*%/i,
  /grandes?\s+[ée]coles?/i,
  /CAC\s*40/i,
  /grenoble/i,
];

function nettoyer(valeur: string | null | undefined): string {
  return (valeur ?? "").replace(/\s+/g, " ").trim();
}

/** Vrai si cette fiche est celle du dirigeant principal (drapeau ET slug figé). */
function estDirigeantNomme(f: Pick<FicheCollaborateur, "estDirigeantPrincipal" | "slug">): boolean {
  return f.estDirigeantPrincipal === true && f.slug === SLUG_DIRIGEANT_PRINCIPAL;
}

/**
 * Nom affiché : PRÉNOM SEUL pour tous, nom complet seulement pour le dirigeant
 * principal. Un `nomComplet` posé sur n'importe quelle autre fiche est ignoré.
 */
export function nomAffiche(
  f: Pick<FicheCollaborateur, "prenom" | "nomComplet" | "estDirigeantPrincipal" | "slug">,
): string {
  if (estDirigeantNomme(f)) {
    const complet = nettoyer(f.nomComplet);
    if (complet) return complet;
  }
  return nettoyer(f.prenom);
}

/**
 * Initiales de l'avatar : une lettre (le prénom), « WJ » pour le dirigeant
 * principal. Prénom vide → « ? ».
 */
export function initiales(
  f: Pick<FicheCollaborateur, "prenom" | "nomComplet" | "estDirigeantPrincipal" | "slug">,
): string {
  const premiere = (t: string) => Array.from(t)[0]?.toLocaleUpperCase("fr") ?? "";
  if (estDirigeantNomme(f)) {
    const mots = nettoyer(f.nomComplet).split(" ").filter(Boolean);
    if (mots.length >= 2) return premiere(mots[0] ?? "") + premiere(mots[mots.length - 1] ?? "");
  }
  return premiere(nettoyer(f.prenom)) || "?";
}

/** Transforme un libellé en fragment d'URL : minuscules, sans accents, tirets. */
export function slugifier(texte: string | null | undefined): string {
  return nettoyer(texte)
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Slug d'un collaborateur : prénom normalisé ; en cas de collision
 * `prenom-ville` ; puis `-2`, `-3`… Jamais le nom de famille.
 * Rend `null` si le prénom ne donne rien d'utilisable.
 */
export function slugCollaborateur(
  prenom: string,
  ville: string | null | undefined,
  existants: Iterable<string> = [],
): string | null {
  const base = slugifier(prenom);
  if (!base) return null;
  const pris = new Set<string>([...SLUGS_RESERVES, ...existants]);
  if (!pris.has(base)) return base;
  const villeSlug = slugifier(ville);
  const avecVille = villeSlug ? `${base}-${villeSlug}` : base;
  if (!pris.has(avecVille)) return avecVille;
  for (let n = 2; ; n++) {
    const candidat = `${avecVille}-${n}`;
    if (!pris.has(candidat)) return candidat;
  }
}

/** Texte « propre » : aucune formulation interdite. */
export function estTextePropre(texte: string | null | undefined): boolean {
  const t = nettoyer(texte);
  return t.length > 0 && !FORMULATIONS_INTERDITES.some((re) => re.test(t));
}

function aVraiePhoto(f: FicheCollaborateur): boolean {
  const p = f.photo;
  return Boolean(p && nettoyer(p.src) && nettoyer(p.consentementLe));
}

/** Nombre d'éléments distinctifs (chaque famille compte une fois). */
export function elementsDistinctifs(f: FicheCollaborateur): number {
  const communs = CATEGORIES[f.categorie]?.metiersCommuns ?? [];
  const parcoursDate =
    (f.parcours?.avant?.some((a) => Number.isInteger(a.annee) && nettoyer(a.libelle)) ?? false) ||
    Number.isInteger(f.parcours?.chezAxionDepuis);
  return [
    parcoursDate,
    (f.citations ?? []).some((c) => nettoyer(c)),
    (f.metiers ?? []).some((m) => nettoyer(m.id) && !communs.includes(m.id)),
    (f.publications ?? 0) > 0,
    (f.parcours?.attestations ?? []).some((a) => nettoyer(a)),
  ].filter(Boolean).length;
}

/**
 * Indexable = vraie photo (avec consentement) + réponse propre de 280 à 450
 * caractères + au moins 3 éléments distinctifs. Le dirigeant principal l'est
 * toujours.
 */
export function estIndexable(f: FicheCollaborateur): boolean {
  if (estDirigeantNomme(f)) return true;
  const reponse = nettoyer(f.reponseQui);
  return (
    aVraiePhoto(f) &&
    reponse.length >= LONGUEUR_REPONSE_MIN &&
    reponse.length <= LONGUEUR_REPONSE_MAX &&
    estTextePropre(reponse) &&
    elementsDistinctifs(f) >= ELEMENTS_DISTINCTIFS_MIN
  );
}

/**
 * Seule sortie à transmettre à une page : le nom de famille (`nomComplet`) et
 * le champ `prenom` brut n'y figurent pas. Les clés inconnues sont écartées.
 */
export function fichePublique(f: FicheCollaborateur): FichePublique {
  const publique: FichePublique = {
    slug: f.slug,
    categorie: f.categorie,
    estDirigeantPrincipal: estDirigeantNomme(f),
    accord: f.accord,
    fonction: f.fonction,
    reponseQui: f.reponseQui,
    afficherSurCarte: f.afficherSurCarte,
    nom: nomAffiche(f),
    initiales: initiales(f),
  };
  if (f.ville !== undefined) publique.ville = f.ville;
  if (f.departement !== undefined) publique.departement = f.departement;
  if (f.photo !== undefined) publique.photo = f.photo;
  if (f.metiers !== undefined) publique.metiers = f.metiers;
  if (f.parcours !== undefined) publique.parcours = f.parcours;
  if (f.citations !== undefined) publique.citations = f.citations;
  if (f.publications !== undefined) publique.publications = f.publications;
  return publique;
}
