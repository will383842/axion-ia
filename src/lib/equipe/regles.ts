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
  /\b(euros?|eur)\b/i,
  /\bcommissions?\b/i,
  /frais de d[ée]placement/i,
  /top\s*1\s*%/i,
  /grandes?\s+[ée]coles?/i,
  /CAC\s*40/i,
  /grenoble/i,
];

function nettoyer(valeur: string | null | undefined): string {
  return (valeur ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Vrai si cette fiche est celle du dirigeant principal (drapeau ET slug figé). */
function estDirigeantNomme(f: Pick<FicheCollaborateur, "estDirigeantPrincipal" | "slug">): boolean {
  return f.estDirigeantPrincipal === true && f.slug === SLUG_DIRIGEANT_PRINCIPAL;
}

/** Dernier mot du nom complet, slugifié : le nom de famille d'un collaborateur. */
function familleSlug(nomComplet: string | undefined): string {
  const mots = nettoyer(nomComplet).split(" ").filter(Boolean);
  return mots.length >= 2 ? slugifier(mots[mots.length - 1]) : "";
}

/** Vrai si le texte contient le nom de famille (mot entier, une fois slugifié). */
function contientFamille(texte: string, famille: string): boolean {
  return famille.length > 0 && `-${slugifier(texte)}-`.includes(`-${famille}-`);
}

/**
 * Prénom SEUL : si le champ « prénom » contient plusieurs mots dont le dernier
 * est le nom de famille connu, ce mot est retiré. Les prénoms composés
 * (« Marie Claire », « Jean-Pierre ») sont conservés.
 */
function prenomSeul(f: Pick<FicheCollaborateur, "prenom" | "nomComplet">): string {
  const mots = nettoyer(f.prenom).split(" ").filter(Boolean);
  const famille = familleSlug(f.nomComplet);
  if (mots.length > 1 && famille && slugifier(mots[mots.length - 1]) === famille) mots.pop();
  return mots.join(" ");
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
  return prenomSeul(f);
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
  return premiere(prenomSeul(f)) || "?";
}

/** Transforme un libellé en fragment d'URL : minuscules, sans accents, tirets. */
export function slugifier(texte: string | null | undefined): string {
  return nettoyer(texte)
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .replace(/ß/g, "ss")
    .replace(/[łŁ]/g, "l")
    .replace(/[øØ]/g, "o")
    .replace(/[đĐð]/g, "d")
    .replace(/[þÞ]/g, "th")
    .replace(/ı/g, "i")
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
  nomComplet?: string,
): string | null {
  const base = slugifier(prenomSeul({ prenom, nomComplet: nomComplet ?? "" }));
  if (!base) return null;
  const pris = new Set<string>([...SLUGS_RESERVES, ...existants]);
  if (!pris.has(base)) return base;
  const villeSlug = estTextePropre(ville) ? slugifier(ville) : "";
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
  return Boolean(p && nettoyer(p.src) && Number.isFinite(Date.parse(nettoyer(p.consentementLe))));
}

/** Nombre d'éléments distinctifs (chaque famille compte une fois). */
export function elementsDistinctifs(f: FicheCollaborateur): number {
  const communs = CATEGORIES[f.categorie]?.metiersCommuns ?? [];
  const parcoursDate =
    (f.parcours?.avant?.some((a) => Number.isInteger(a?.annee) && nettoyer(a?.libelle)) ?? false) ||
    Number.isInteger(f.parcours?.chezAxionDepuis);
  return [
    parcoursDate,
    (f.citations ?? []).some((c) => nettoyer(c)),
    (f.metiers ?? []).some((m) => nettoyer(m?.id) && !communs.includes(m.id)),
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
  const reponse = nettoyer(f.reponseQui);
  if (estDirigeantNomme(f)) return estTextePropre(reponse);
  return (
    aVraiePhoto(f) &&
    reponse.length >= LONGUEUR_REPONSE_MIN &&
    reponse.length <= LONGUEUR_REPONSE_MAX &&
    estTextePropre(reponse) &&
    elementsDistinctifs(f) >= ELEMENTS_DISTINCTIFS_MIN
  );
}

/**
 * Seule sortie à transmettre à une page : ni `nomComplet`, ni `prenom` brut,
 * ni clé inconnue (y compris dans les objets imbriqués, recopiés champ par
 * champ). Rend `null` si la fiche n'a pas de prénom. Le dirigeant principal
 * n'a jamais de point sur la carte ; un slug qui contient le nom de famille
 * est remplacé par celui du prénom ; un texte non « propre » est écarté.
 */
export function fichePublique(f: FicheCollaborateur): FichePublique | null {
  const nom = nomAffiche(f);
  if (!nom) return null;
  const dirigeant = estDirigeantNomme(f);
  const famille = familleSlug(f.nomComplet);
  const slug = !dirigeant && contientFamille(f.slug, famille) ? slugifier(prenomSeul(f)) : f.slug;
  const propre = (t: string | undefined) => (estTextePropre(t) ? (t as string) : undefined);
  const publique: FichePublique = {
    slug,
    categorie: f.categorie,
    estDirigeantPrincipal: dirigeant,
    accord: f.accord,
    fonction: propre(f.fonction) ?? "",
    reponseQui: propre(f.reponseQui) ?? "",
    afficherSurCarte: dirigeant ? false : f.afficherSurCarte,
    nom,
    initiales: initiales(f),
  };
  const ville = propre(f.ville);
  if (ville) publique.ville = ville;
  if (f.departement !== undefined) publique.departement = f.departement;
  if (f.photo) {
    publique.photo = {
      src: f.photo.src,
      largeur: f.photo.largeur,
      hauteur: f.photo.hauteur,
      alt: f.photo.alt,
      consentementLe: f.photo.consentementLe ?? null,
    };
  }
  if (f.metiers) {
    publique.metiers = f.metiers.filter(Boolean).map((m) => ({ id: m.id, nom: m.nom }));
  }
  if (f.parcours) {
    const p = f.parcours;
    publique.parcours = {
      ...(p.avant
        ? {
            avant: p.avant
              .filter((a) => a && estTextePropre(a.libelle))
              .map((a) => ({ annee: a.annee, libelle: a.libelle })),
          }
        : {}),
      ...(p.chezAxionDepuis !== undefined ? { chezAxionDepuis: p.chezAxionDepuis } : {}),
      ...(p.attestations ? { attestations: p.attestations.filter((a) => estTextePropre(a)) } : {}),
    };
  }
  if (f.citations) publique.citations = f.citations.filter((c) => estTextePropre(c));
  if (f.publications !== undefined) publique.publications = f.publications;
  return publique;
}
