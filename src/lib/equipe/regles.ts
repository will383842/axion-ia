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
  /grenobl/i,
  /\$/,
  /\bTJM\b/i,
  /\b(HT|TTC)\b/,
  /\btarifs?\b/i,
];

function nettoyer(valeur: string | null | undefined): string {
  return (valeur ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Vrai si cette fiche est celle du dirigeant principal (drapeau ET slug figé). */
function estDirigeantNomme(f: Pick<FicheCollaborateur, "estDirigeantPrincipal" | "slug">): boolean {
  return f.estDirigeantPrincipal === true && f.slug === SLUG_DIRIGEANT_PRINCIPAL;
}

const PARTICULES = new Set([
  "le",
  "la",
  "les",
  "de",
  "du",
  "des",
  "van",
  "von",
  "der",
  "den",
  "el",
  "al",
]);

/**
 * Fragments du nom de famille (slugifiés) : le nom complet moins les mots qui
 * répondent au prénom saisi ; à défaut, son dernier mot. Sert à repérer toute
 * fuite, jamais à l'afficher.
 */
function famille(f: Pick<FicheCollaborateur, "prenom" | "nomComplet">): string[] {
  const nom = nettoyer(f.nomComplet).split(" ").filter(Boolean);
  if (nom.length === 0) return [];
  const prenomMots = nettoyer(f.prenom)
    .split(" ")
    .filter(Boolean)
    .map((m) => cle(m));
  // Les mots du nom complet qui ne répondent à aucun mot du prénom, où qu'ils soient
  // (« Prénom NOM » comme « NOM Prénom »).
  let reste = nom.filter((m) => !prenomMots.includes(cle(m)));
  // Le prénom couvre tout : repli sur le dernier mot s'il y a au moins deux mots.
  if (reste.length === 0) reste = nom.length >= 2 ? nom.slice(-1) : [];
  const parts = new Set<string>();
  const complet = slugifier(reste.join(" "));
  if (complet && !PARTICULES.has(complet) && Array.from(complet).length >= 2) parts.add(complet);
  for (const mot of reste) {
    const brut = mot.toLocaleLowerCase("fr");
    const sl = slugifier(mot);
    if (!sl) {
      // Écriture non latine : comparaison sur le mot lui-même.
      if (Array.from(brut).length >= 2) parts.add(brut);
      continue;
    }
    for (const frag of sl.split("-")) {
      if (frag.length >= 2 && !PARTICULES.has(frag)) parts.add(frag);
    }
  }
  return [...parts];
}

/** Clé de comparaison d'un mot : slug, ou le mot en minuscules s'il n'est pas latin. */
function cle(mot: string): string {
  return slugifier(mot) || nettoyer(mot).toLocaleLowerCase("fr");
}

/**
 * Vrai si le texte contient un fragment du nom de famille : mot entier, ou mot
 * collé au prénom ou à des chiffres (« jeandupont », « dupont2 »). Jamais à
 * l'intérieur d'un autre mot (« approche » ne contient pas « roche »).
 * `prenoms` : prénoms (slugifiés) qui peuvent être collés au nom.
 */
function contientFamille(
  texte: string | undefined,
  parts: ReadonlyArray<string>,
  prenoms: ReadonlyArray<string> = [],
): boolean {
  if (!texte || parts.length === 0) return false;
  const norm = `-${slugifier(texte)}-`;
  const jetons = nettoyer(texte)
    .toLocaleLowerCase("fr")
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean);
  return parts.some((p) => {
    if (norm.includes(`-${p}-`)) return true;
    const c = p.replace(/-/g, "");
    return jetons.some((j) => {
      if (j === p) return true;
      const sj = slugifier(j) || j;
      if (c.length < 4 || sj === c) return sj === c;
      const reste = sj.startsWith(c)
        ? sj.slice(c.length)
        : sj.endsWith(c)
          ? sj.slice(0, -c.length)
          : null;
      return reste !== null && (/^\d*$/.test(reste) || prenoms.includes(reste));
    });
  });
}

function prenomsCles(prenom: string): string[] {
  return nettoyer(prenom)
    .split(" ")
    .filter(Boolean)
    .map((m) => cle(m));
}

/**
 * Prénom SEUL : dans un prénom à plusieurs mots, un mot qui est un fragment
 * du nom de famille connu est retiré. Les prénoms composés sont conservés.
 */
function prenomSeul(f: Pick<FicheCollaborateur, "prenom" | "nomComplet">): string {
  const mots = nettoyer(f.prenom).split(" ").filter(Boolean);
  if (mots.length < 2) return mots.join(" ");
  const parts = famille(f);
  const gardes = mots.filter((m) => !contientFamille(m, parts));
  return (gardes.length > 0 ? gardes : mots.slice(0, 1)).join(" ");
}

/** Motifs de refus d'un prénom saisi dans la console. */
export type MotifPrenomRefuse = "vide" | "caracteres" | "trop-long" | "contient-nom-de-famille";

const PRENOM_LONGUEUR_MAX = 40;

/**
 * Validation du champ prénom (à appeler par la console avant d'enregistrer).
 * Refuse : vide, chiffres ou signes autres que lettres, espace, apostrophe et
 * tiret, plus de 40 caractères, ou un mot qui répond au nom de famille connu
 * (`nomComplet`). Rend `null` si le prénom est acceptable.
 */
export function validerPrenom(
  prenom: string | null | undefined,
  nomComplet?: string | null,
): MotifPrenomRefuse | null {
  const p = nettoyer(prenom);
  if (!p) return "vide";
  if (!/^[\p{L}\p{M}][\p{L}\p{M}' ’-]*$/u.test(p)) return "caracteres";
  if (p.length > PRENOM_LONGUEUR_MAX) return "trop-long";
  const parts = famille({ prenom: p, nomComplet: nomComplet ?? "" });
  if (p.split(" ").some((m) => contientFamille(m, parts))) return "contient-nom-de-famille";
  // Ordre présumé : « Prénom Nom », ou « NOM Prénom » quand seul le premier mot est en capitales.
  const mots = nettoyer(nomComplet).split(" ").filter(Boolean);
  const majuscules = (m: string) => m.length > 1 && m === m.toLocaleUpperCase("fr");
  const presume =
    mots.length >= 2 && majuscules(mots[0] ?? "") && !majuscules(mots[mots.length - 1] ?? "")
      ? mots[0]
      : mots.length >= 2
        ? mots[mots.length - 1]
        : undefined;
  if (presume && p.split(" ").some((m) => cle(m) === cle(presume))) {
    return "contient-nom-de-famille";
  }
  // Le prénom saisi est le nom complet : refusé même si le repli ne trouve rien.
  const complet = nettoyer(nomComplet);
  if (complet && p.includes(" ") && cle(p) === cle(complet)) return "contient-nom-de-famille";
  return null;
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
  const parts = famille({ prenom, nomComplet: nomComplet ?? "" });
  const villeSlug =
    estTextePropre(ville) && !contientFamille(ville ?? "", parts, prenomsCles(prenom))
      ? slugifier(ville)
      : "";
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

const DATE_ISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** Date de consentement valide : ISO strict, jamais dans le futur. */
function consentementValide(brut: string | null | undefined): boolean {
  const d = nettoyer(brut);
  if (!DATE_ISO.test(d)) return false;
  const t = Date.parse(d);
  const [y, m, j] = d.slice(0, 10).split("-").map(Number);
  const calendrier = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, j ?? 1));
  // Jour inexistant (30 février) : refusé.
  if (calendrier.getUTCMonth() !== (m ?? 1) - 1 || calendrier.getUTCDate() !== j) return false;
  return Number.isFinite(t) && t <= Date.now() + 24 * 3600 * 1000;
}

function aVraiePhoto(f: Pick<FicheCollaborateur, "photo">): boolean {
  const p = f.photo;
  return Boolean(p && nettoyer(p.src) && consentementValide(p.consentementLe));
}

/** Nombre d'éléments distinctifs (chaque famille compte une fois). */
export function elementsDistinctifs(
  f: Pick<FicheCollaborateur, "categorie" | "parcours" | "citations" | "metiers" | "publications">,
): number {
  const communs = CATEGORIES[f.categorie]?.metiersCommuns ?? [];
  const parcoursDate =
    (f.parcours?.avant?.some((a) => Number.isInteger(a?.annee) && estTextePropre(a?.libelle)) ??
      false) ||
    Number.isInteger(f.parcours?.chezAxionDepuis);
  return [
    parcoursDate,
    (f.citations ?? []).some((c) => estTextePropre(c)),
    (f.metiers ?? []).some((m) => nettoyer(m?.id) && !communs.includes(m.id)),
    (f.publications ?? 0) > 0,
    (f.parcours?.attestations ?? []).some((a) => estTextePropre(a)),
  ].filter(Boolean).length;
}

/**
 * Indexable = vraie photo (avec consentement) + réponse propre de 280 à 450
 * caractères + au moins 3 éléments distinctifs. Le dirigeant principal l'est
 * toujours.
 */
export function estIndexable(f: FicheCollaborateur): boolean {
  // Jugée sur ce qui serait réellement publié, jamais sur la fiche brute.
  const p = fichePublique(f);
  if (!p) return false;
  const reponse = nettoyer(p.reponseQui);
  if (p.estDirigeantPrincipal) return estTextePropre(reponse);
  return (
    aVraiePhoto(p) &&
    reponse.length >= LONGUEUR_REPONSE_MIN &&
    reponse.length <= LONGUEUR_REPONSE_MAX &&
    elementsDistinctifs(p) >= ELEMENTS_DISTINCTIFS_MIN
  );
}

/**
 * Seule sortie à transmettre à une page : ni `nomComplet`, ni `prenom` brut,
 * ni clé inconnue (objets imbriqués recopiés champ par champ). Rend `null` si
 * la fiche n'a pas de prénom. Le dirigeant principal n'a jamais de point sur la
 * carte. Pour les autres : tout texte qui contient un fragment du nom de
 * famille, ou une formulation interdite, est écarté ; un slug qui le contient
 * (ou réservé) est régénéré depuis le prénom (`existants` = slugs déjà pris) ;
 * la photo n'existe que si le consentement est daté.
 */
export function fichePublique(
  f: FicheCollaborateur,
  existants: Iterable<string> = [],
): FichePublique | null {
  const nom = nomAffiche(f);
  if (!nom) return null;
  const dirigeant = estDirigeantNomme(f);
  const parts = dirigeant ? [] : famille(f);
  const pren = prenomsCles(f.prenom);
  const propre = (t: string | null | undefined): string | undefined =>
    estTextePropre(t) && !contientFamille(t ?? "", parts, pren) ? (t as string) : undefined;

  let slug = f.slug;
  const slugConforme = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug ?? "");
  if (
    !dirigeant &&
    (!slugConforme || contientFamille(f.slug, parts, pren) || SLUGS_RESERVES.includes(f.slug))
  ) {
    const neuf = slugCollaborateur(f.prenom, propre(f.ville), existants, f.nomComplet);
    if (!neuf) return null;
    slug = neuf;
  }

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
  // Ville écartée : pas de département non plus (le chef-lieu la redonnerait). Dirigeant : aucun lieu.
  const villeEcartee = nettoyer(f.ville) !== "" && !ville;
  if (f.departement != null && !dirigeant && !villeEcartee) publique.departement = f.departement;
  if (f.photo && aVraiePhoto(f) && propre(f.photo.src)) {
    publique.photo = {
      src: f.photo.src,
      largeur: f.photo.largeur,
      hauteur: f.photo.hauteur,
      alt: propre(f.photo.alt) ?? `Portrait de ${nom}`,
      consentementLe: f.photo.consentementLe ?? null,
    };
  }
  if (f.metiers) {
    publique.metiers = f.metiers
      .filter((m) => m && propre(m.nom))
      .map((m) => ({ id: m.id, nom: m.nom }));
  }
  if (f.parcours) {
    const p = f.parcours;
    publique.parcours = {
      ...(p.avant
        ? {
            avant: p.avant
              .filter((a) => a && propre(a.libelle))
              .map((a) => ({ annee: a.annee, libelle: a.libelle })),
          }
        : {}),
      ...(p.chezAxionDepuis != null ? { chezAxionDepuis: p.chezAxionDepuis } : {}),
      ...(p.attestations ? { attestations: p.attestations.filter((a) => propre(a)) } : {}),
    };
  }
  if (f.citations) publique.citations = f.citations.filter((c) => propre(c));
  if (f.publications != null) publique.publications = f.publications;
  return publique;
}
