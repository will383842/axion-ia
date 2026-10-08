/**
 * FICHIERS PARTAGÉS — les règles PURES (Candidatures unifiées, lot L4, ADR 0065).
 *
 * Aucune entrée/sortie ici : tailles, morceaux, catégories, noms de fichier,
 * clé R2, lien externe. Le serveur (`depot.ts`), le navigateur
 * (`DeposeurFichier.tsx`) et les tests lisent les MÊMES constantes ; la base
 * les répète en CHECK (`fichiers_partages_taille`, `…_hors_limite_equipe`),
 * vérifiées par `__tests__/les-bornes-du-code-et-de-la-base-concordent.spec.ts`.
 */

const GIO = 1024 * 1024 * 1024;
const MIO = 1024 * 1024;

/** Un fichier envoyé par l'équipe : 20 Gio au plus (décision 3 de Will). */
export const TAILLE_MAX_EQUIPE_OCTETS = 20 * GIO;

/** Un fichier renvoyé par un candidat (L5b) : 4 Gio, limite de l'antivirus (décision 4). */
export const TAILLE_MAX_PERSONNE_OCTETS = 4 * GIO;

/**
 * Ce qu'un candidat peut DÉPOSER par son lien (L5b) : 4 Go tels qu'il les lit
 * (4 000 000 000 octets, unités décimales comme `tailleLisible`), donc un
 * fichier affiché « 4,1 Go » est refusé. Sous le plafond de la base (4 Gio).
 */
export const TAILLE_MAX_DEPOT_PERSONNE_OCTETS = 4_000_000_000;

/** Au-delà, un fichier de l'ÉQUIPE n'est pas analysé (décision 7) — `hors_limite`. */
export const SEUIL_ANTIVIRUS_EQUIPE_OCTETS = 200 * MIO;

/**
 * Taille d'un morceau : 64 Mio. R2 exige des morceaux ÉGAUX sauf le dernier, et
 * au plus 10 000 morceaux : 20 Gio = 320 morceaux. Un morceau perdu se renvoie
 * seul — une coupure ne coûte jamais plus de 64 Mio.
 */
export const TAILLE_MORCEAU_OCTETS = 64 * MIO;

/** Envois simultanés depuis le navigateur. */
export const ENVOIS_PARALLELES = 3;

/** Au plus, adresses signées demandées d'un coup (une requête serveur par lot). */
export const MORCEAUX_PAR_SIGNATURE = 24;

/** Durée d'une adresse d'envoi signée : une heure (un morceau de 64 Mio y tient largement). */
export const DUREE_SIGNATURE_MORCEAU_S = 60 * 60;

/** Depuis un téléphone, on prévient au-delà de 500 Mo (I10). */
export const SEUIL_AVERTISSEMENT_MOBILE_OCTETS = 500 * 1000 * 1000;

/** Le nombre de morceaux d'un fichier (au moins un). */
export function nombreMorceaux(taille: number): number {
  return Math.max(1, Math.ceil(taille / TAILLE_MORCEAU_OCTETS));
}

/** La taille attendue du morceau `numero` (1-indexé). */
export function tailleMorceau(taille: number, numero: number): number {
  const n = nombreMorceaux(taille);
  if (numero < n) return TAILLE_MORCEAU_OCTETS;
  return taille - (n - 1) * TAILLE_MORCEAU_OCTETS;
}

// ── Catégories ─────────────────────────────────────────────────────────────

export const CATEGORIES_FICHIER = [
  "lut",
  "video_exemple",
  "rushs",
  "consignes",
  "musique",
  "kit_apporteur",
  "presentation",
  "essai_rendu",
  "autre",
] as const;

export type CategorieFichier = (typeof CATEGORIES_FICHIER)[number];

export const LIBELLE_CATEGORIE: Readonly<Record<CategorieFichier, string>> = {
  lut: "LUT",
  video_exemple: "Vidéo d'exemple",
  rushs: "Rushs",
  consignes: "Consignes",
  musique: "Musique",
  kit_apporteur: "Kit apporteur",
  presentation: "Présentation",
  essai_rendu: "Essai rendu",
  autre: "Autre",
};

/**
 * Ce que l'équipe peut DÉPOSER depuis son ordinateur dans la bibliothèque.
 *
 * - `essai_rendu` : seul un candidat le renvoie (L5b).
 * - `kit_apporteur` : le kit a UNE seule source, celui qui est déjà publié
 *   [C3] — il entre dans la bibliothèque comme un LIEN vers lui, jamais comme
 *   une copie qui divergerait.
 */
export const CATEGORIES_DEPOT: ReadonlyArray<CategorieFichier> = [
  "lut",
  "video_exemple",
  "rushs",
  "consignes",
  "musique",
  "presentation",
  "autre",
];

/** Ce qu'on peut ranger comme lien externe (Drive, WeTransfer, kit publié). */
export const CATEGORIES_LIEN: ReadonlyArray<CategorieFichier> = CATEGORIES_FICHIER.filter(
  (c) => c !== "essai_rendu",
);

/**
 * Ce qu'on propose d'envoyer, selon le monde de la personne (D8, décision 10).
 * DÉRIVÉ, jamais stocké : un futur apporteur ne se voit proposer que le kit et
 * la présentation — une consigne envoyée à un apporteur est le motif 10 de
 * l'ANTI-REQUALIFICATION.
 */
export function categoriesProposees(
  monde: "emploi" | "apporteur",
): ReadonlyArray<CategorieFichier> {
  if (monde === "apporteur") return ["kit_apporteur", "presentation"];
  return CATEGORIES_FICHIER.filter((c) => c !== "kit_apporteur" && c !== "essai_rendu");
}

// ── Noms, clé R2, type ─────────────────────────────────────────────────────

/**
 * Le nom affiché : sans chemin, sans caractère de contrôle, 255 caractères au
 * plus (CHECK `fichiers_partages_nom_fichier`). `null` s'il ne reste rien.
 */
export function nomAffichable(brut: string): string | null {
  const dernier = brut.split(/[/\\]/).pop() ?? "";
  const propre = dernier.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!propre) return null;
  return propre.slice(0, 255);
}

/**
 * Le nom ASCII de la clé R2 : lettres, chiffres, `.`, `_`, `-` (CHECK
 * `fichiers_partages_r2_cle_prefixe`). Les accents sont retirés, le reste
 * devient `-`. Garde l'extension. Jamais vide.
 */
export function nomAscii(nom: string): string {
  const sansAccents = nom.normalize("NFD").replace(/[̀-ͯ]/g, "");
  let s = sansAccents
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  if (s.length > 200) {
    const point = s.lastIndexOf(".");
    const ext = point > 0 && s.length - point <= 12 ? s.slice(point) : "";
    s = s.slice(0, 200 - ext.length) + ext;
  }
  return s || "fichier";
}

/** La clé R2, choisie par le serveur : `partages/<id>/<nom-ascii>`. */
export function cleR2Fichier(id: string, nom: string): string {
  return `partages/${id}/${nomAscii(nom)}`;
}

/** Un type MIME de forme sûre, sinon le type neutre. */
export function typeMimeSur(brut: string | null | undefined): string {
  const t = (brut ?? "").trim().toLowerCase();
  if (t.length > 0 && t.length <= 150 && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(t)) return t;
  return "application/octet-stream";
}

/** Un titre par défaut : le nom sans son extension. */
export function titreParDefaut(nom: string): string {
  const point = nom.lastIndexOf(".");
  const base = point > 0 ? nom.slice(0, point) : nom;
  return base.slice(0, 200);
}

/**
 * Un lien externe accepté : https, un hôte, sans identifiants, sans espace ni
 * caractère de contrôle (même règle que le CHECK `fichiers_partages_url_https`).
 */
export function lienExterneValide(brut: string): string | null {
  const s = brut.trim();
  if (s.length === 0 || s.length > 2000) return null;
  if (/[\s\u0000-\u001f\u007f]/.test(s)) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !u.hostname || u.username || u.password) return null;
  if (!/^https:\/\/[^/?#@]+([/?#].*)?$/.test(s)) return null;
  return s;
}

/** Taille lisible en français : « 3,8 Go », « 640 Mo », « 12 ko ». Unités décimales. */
export function tailleLisible(octets: number): string {
  const f = (n: number, d: number) =>
    n.toLocaleString("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: 0 });
  if (octets >= 1e9) return `${f(octets / 1e9, 1)} Go`;
  if (octets >= 1e6) return `${f(octets / 1e6, octets >= 1e8 ? 0 : 1)} Mo`;
  if (octets >= 1e3) return `${f(octets / 1e3, 0)} ko`;
  return `${octets} octets`;
}

// ── Fichier renvoyé par un candidat (L5b) ──────────────────────────────────

/**
 * Familles de fichiers qu'un candidat peut renvoyer, reconnues à leurs
 * PREMIERS OCTETS (jamais au type annoncé par le navigateur) :
 *   - `isobmff` : MP4, M4V, MOV (`ftyp`, ou un vieil atome QuickTime, aux octets 4 à 7) ;
 *   - `ebml`    : WebM, MKV (1A 45 DF A3) ;
 *   - `avi`     : RIFF….AVI ;
 *   - `zip`     : archive ZIP (PK 03 04).
 */
export type FamilleFichierRendu = "isobmff" | "ebml" | "avi" | "zip";

/** Extensions acceptées, leur famille et le type servi (choisi par le SERVEUR). */
export const EXTENSIONS_RENDU: Readonly<
  Record<string, { readonly famille: FamilleFichierRendu; readonly mime: string }>
> = {
  mp4: { famille: "isobmff", mime: "video/mp4" },
  m4v: { famille: "isobmff", mime: "video/mp4" },
  mov: { famille: "isobmff", mime: "video/quicktime" },
  webm: { famille: "ebml", mime: "video/webm" },
  mkv: { famille: "ebml", mime: "video/x-matroska" },
  avi: { famille: "avi", mime: "video/x-msvideo" },
  zip: { famille: "zip", mime: "application/zip" },
};

/** Octets lus pour reconnaître un fichier. */
export const OCTETS_SIGNATURE = 16;

const ATOMES_ISOBMFF = new Set(["ftyp", "moov", "mdat", "wide", "free", "skip", "pnot"]);

function ascii(o: Uint8Array, debut: number, fin: number): string {
  let s = "";
  for (let i = debut; i < fin && i < o.length; i++) s += String.fromCharCode(o[i]!);
  return s;
}

/** La famille reconnue aux premiers octets, ou `null`. Pure. */
export function familleSignature(o: Uint8Array): FamilleFichierRendu | null {
  if (o.length >= 4 && o[0] === 0x1a && o[1] === 0x45 && o[2] === 0xdf && o[3] === 0xa3) {
    return "ebml";
  }
  if (o.length >= 4 && o[0] === 0x50 && o[1] === 0x4b && o[2] === 0x03 && o[3] === 0x04) {
    return "zip";
  }
  if (o.length >= 12 && ascii(o, 0, 4) === "RIFF" && ascii(o, 8, 12) === "AVI ") return "avi";
  if (o.length >= 8 && ATOMES_ISOBMFF.has(ascii(o, 4, 8))) return "isobmff";
  return null;
}

/** L'extension acceptée d'un nom de fichier, ou `null`. */
export function extensionRendu(nom: string): {
  readonly extension: string;
  readonly famille: FamilleFichierRendu;
  readonly mime: string;
} | null {
  const point = nom.lastIndexOf(".");
  if (point < 0) return null;
  const extension = nom.slice(point + 1).toLowerCase();
  const e = Object.prototype.hasOwnProperty.call(EXTENSIONS_RENDU, extension)
    ? EXTENSIONS_RENDU[extension]
    : undefined;
  return e ? { extension, ...e } : null;
}

/** Les premiers octets sont-ils ceux qu'annonce l'extension ? */
export function signatureConforme(nom: string, octets: Uint8Array | null): boolean {
  const e = extensionRendu(nom);
  return !!e && !!octets && familleSignature(octets) === e.famille;
}

/** Une vidéo (lisible dans la console), par opposition à une archive. */
export function estVideoRendue(nom: string | null): boolean {
  const e = nom ? extensionRendu(nom) : null;
  return !!e && e.famille !== "zip";
}

export const MSG_TROP_GROS_PERSONNE =
  "Ce fichier dépasse 4 Go : il ne peut pas être déposé ici. Écrivez-nous pour convenir d'un autre moyen.";
export const MSG_FORMAT_PERSONNE =
  "Seuls une vidéo (MP4, MOV, M4V, WebM, MKV ou AVI) ou une archive ZIP peuvent être déposées.";
export const MSG_SIGNATURE_PERSONNE =
  "Ce fichier ne ressemble pas à une vidéo ni à une archive ZIP : vérifiez qu'il s'agit du bon fichier.";

export interface DemandeDepotPersonne {
  readonly nom: string;
  readonly taille: number;
  /** Les premiers octets du fichier, lus par le navigateur (revérifiés à la fin dans le stockage). */
  readonly entete: Uint8Array | null;
}

/**
 * Contrôles purs d'un dépôt de candidat, AVANT le premier morceau : nom,
 * taille (4 Go au plus), extension acceptée, premiers octets conformes. Le
 * type servi vient de l'extension, jamais du navigateur.
 */
export function verifierDemandeDepotPersonne(d: DemandeDepotPersonne):
  | {
      ok: true;
      nom: string;
      titre: string;
      taille: number;
      typeMime: string;
    }
  | { ok: false; erreur: string } {
  const nom = nomAffichable(d.nom ?? "");
  if (!nom) return { ok: false, erreur: "Le nom du fichier est vide." };
  if (!Number.isSafeInteger(d.taille) || d.taille < 1) {
    return { ok: false, erreur: "Ce fichier est vide." };
  }
  if (d.taille > TAILLE_MAX_DEPOT_PERSONNE_OCTETS) {
    return { ok: false, erreur: MSG_TROP_GROS_PERSONNE };
  }
  const e = extensionRendu(nom);
  if (!e) return { ok: false, erreur: MSG_FORMAT_PERSONNE };
  if (!signatureConforme(nom, d.entete)) return { ok: false, erreur: MSG_SIGNATURE_PERSONNE };
  return {
    ok: true,
    nom,
    titre: titreParDefaut(nom) || nom.slice(0, 200),
    taille: d.taille,
    typeMime: e.mime,
  };
}

// ── Morceaux reçus ─────────────────────────────────────────────────────────

export interface MorceauRecu {
  readonly numero: number;
  readonly etag: string;
  readonly taille: number;
}

/**
 * Les morceaux listés par R2 forment-ils EXACTEMENT le fichier annoncé ?
 * Tous présents de 1 à n, chacun à sa taille. Rend la raison d'un refus, ou
 * `null`. Pure : c'est elle qui décide qu'un dépôt peut être assemblé.
 */
export function defautMorceaux(taille: number, recus: ReadonlyArray<MorceauRecu>): string | null {
  const n = nombreMorceaux(taille);
  const parNumero = new Map(recus.map((m) => [m.numero, m]));
  const manquants: number[] = [];
  for (let i = 1; i <= n; i++) {
    const m = parNumero.get(i);
    if (!m) {
      manquants.push(i);
      continue;
    }
    if (m.taille !== tailleMorceau(taille, i)) return `le morceau ${i} n'a pas la bonne taille`;
  }
  if (manquants.length > 0) {
    return `${manquants.length} morceau${manquants.length > 1 ? "x" : ""} manquant${manquants.length > 1 ? "s" : ""}`;
  }
  if (recus.some((m) => m.numero > n)) return "des morceaux en trop";
  return null;
}

/**
 * Le premier morceau REÇU dont la taille n'est pas celle attendue, ou `null`.
 * Chaque adresse d'envoi est signée à la longueur exacte du morceau : un tel
 * écart n'arrive pas par accident, et l'envoi s'arrête (relecture sécurité).
 */
export function morceauHorsTaille(
  taille: number,
  recus: ReadonlyArray<MorceauRecu>,
): number | null {
  const n = nombreMorceaux(taille);
  const fautif = recus
    .filter((m) => m.numero >= 1 && m.numero <= n && m.taille !== tailleMorceau(taille, m.numero))
    .map((m) => m.numero)
    .sort((a, b) => a - b)[0];
  return fautif ?? null;
}

/** Les numéros de morceaux déjà reçus et justes (reprise d'un envoi interrompu). */
export function morceauxDejaRecus(taille: number, recus: ReadonlyArray<MorceauRecu>): number[] {
  const n = nombreMorceaux(taille);
  return recus
    .filter((m) => m.numero >= 1 && m.numero <= n && m.taille === tailleMorceau(taille, m.numero))
    .map((m) => m.numero)
    .sort((a, b) => a - b);
}
