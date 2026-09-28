// « SES VIDÉOS » — les liens vers le travail d'un candidat, rassemblés.
//
// Demande Will (2026-09-28) : « ils m'ont envoyé des liens de leurs vidéos,
// c'est ça que je voudrais garder ». Ces liens étaient bien en base, mais
// éparpillés : réponses au formulaire, petit mot, champ portfolio, et — pour ce
// qui arrive par e-mail — corps des lignes de journal recopiées. Personne ne
// pouvait dire d'un coup d'œil « qu'a-t-il montré ? ». Module PUR : aucun accès
// base, il ne fait que lire des textes.

export interface SourceTexte {
  /** D'où vient le texte, dit au recruteur : « formulaire », « e-mail du 28/09 »… */
  readonly source: string;
  readonly texte: string | null | undefined;
}

export interface LienVideo {
  readonly url: string;
  readonly plateforme: string;
  /** Première source où le lien apparaît. */
  readonly source: string;
}

const URL_RE = /https?:\/\/[^\s"'<>)\]]+/g;

/** Liens qui ne montrent pas le travail : les nôtres, les signatures, les agendas. */
const BRUIT =
  /(^|\.)(axion-ia\.com|calendly\.com|zoho\.(eu|com)|malt\.fr)$|google\.[a-z.]+\/maps|linkedin\.com\/(comm|feed)/i;

const PLATEFORMES: ReadonlyArray<[RegExp, string]> = [
  [/(^|\.)(youtube\.com|youtu\.be)$/i, "YouTube"],
  [/(^|\.)vimeo\.com$/i, "Vimeo"],
  [/(^|\.)tiktok\.com$/i, "TikTok"],
  [/(^|\.)instagram\.com$/i, "Instagram"],
  [/(^|\.)facebook\.com$|(^|\.)fb\.watch$/i, "Facebook"],
  [/(^|\.)drive\.google\.com$/i, "Google Drive"],
  [/(^|\.)dropbox\.com$/i, "Dropbox"],
  [/(^|\.)(wetransfer\.com|we\.tl)$/i, "WeTransfer"],
  [/(^|\.)frame\.io$/i, "Frame.io"],
  [/(^|\.)icloud\.com$/i, "iCloud"],
  [/(^|\.)(canva\.com|canva\.link)$/i, "Canva"],
  [/(^|\.)behance\.net$/i, "Behance"],
  [/(^|\.)linkedin\.com$/i, "LinkedIn"],
  [/(^|\.)imdb\.com$/i, "IMDb"],
];

/** Plateformes qui HÉBERGENT des vidéos — les autres sont des profils ou des sites. */
const VIDEO = new Set([
  "YouTube",
  "Vimeo",
  "TikTok",
  "Instagram",
  "Facebook",
  "Google Drive",
  "Dropbox",
  "WeTransfer",
  "Frame.io",
  "iCloud",
  "Canva",
]);

function hote(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function plateformeDe(url: string): string {
  const h = hote(url);
  if (!h) return "Lien";
  for (const [re, nom] of PLATEFORMES) if (re.test(h)) return nom;
  return "Site / portfolio";
}

/** Vrai si le lien montre (ou peut montrer) du travail vidéo, pas un simple profil. */
export function montreDuTravail(l: LienVideo): boolean {
  return VIDEO.has(l.plateforme) || l.plateforme === "Site / portfolio";
}

/**
 * Tous les liens, dans l'ordre des sources, sans doublon (une même vidéo citée
 * dans le formulaire puis dans un e-mail n'apparaît qu'une fois, sous sa
 * PREMIÈRE source). La ponctuation collée en fin d'URL est retirée.
 */
export function extraireLiensVideo(sources: readonly SourceTexte[]): LienVideo[] {
  const vus = new Set<string>();
  const out: LienVideo[] = [];
  for (const { source, texte } of sources) {
    if (!texte) continue;
    for (const m of texte.matchAll(URL_RE)) {
      const url = m[0].replace(/&amp;/g, "&").replace(/[.,;:!?]+$/, "");
      const h = hote(url);
      if (!h || BRUIT.test(h) || BRUIT.test(url)) continue;
      const cle = url.replace(/\/+$/, "").toLowerCase();
      if (vus.has(cle)) continue;
      vus.add(cle);
      out.push({ url, plateforme: plateformeDe(url), source });
    }
  }
  return out;
}
