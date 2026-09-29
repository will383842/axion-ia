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

/** Ce qu'il faut d'une candidature pour trouver ses liens — lu par la fiche ET le passage hebdo. */
export interface CandidatureALiens {
  readonly answers: Record<string, unknown> | null;
  readonly motivation: string | null;
  readonly linkedinUrl: string | null;
  readonly evenements: ReadonlyArray<{
    readonly type: string;
    readonly summary: string;
    readonly occurredAt: Date;
    readonly body: string | null;
  }>;
}

/** Types de journal qui portent ce que le CANDIDAT a envoyé (jamais nos propres messages). */
export const TYPES_JOURNAL_DU_CANDIDAT: ReadonlySet<string> = new Set([
  "piece_recue",
  "email_recu",
  "note",
]);

/**
 * Les sources, dans l'ordre d'affichage. Une SEULE définition : si la fiche et
 * le passage hebdomadaire ne lisaient pas les mêmes textes, la fiche montrerait
 * un lien que personne ne vérifie.
 */
export function sourcesDeLiens(
  c: CandidatureALiens,
  dateCourte: (d: Date) => string,
): SourceTexte[] {
  const reponses = Object.values(c.answers ?? {})
    .filter((v): v is string => typeof v === "string")
    .join(" ");
  return [
    { source: "formulaire", texte: reponses },
    { source: "petit mot", texte: c.motivation },
    { source: "portfolio", texte: c.linkedinUrl },
    ...c.evenements
      .filter((e) => TYPES_JOURNAL_DU_CANDIDAT.has(e.type))
      .map((e) => ({ source: `${e.summary} · ${dateCourte(e.occurredAt)}`, texte: e.body })),
  ];
}

export type EtatLien = "vivant" | "mort" | "inverifiable";

/** Plateformes derrière une connexion : on ne peut PAS savoir, on ne dit pas « mort ». */
const DERRIERE_CONNEXION = new Set(["Instagram", "Facebook", "LinkedIn"]);

/**
 * Une page de CHAÎNE ou de PROFIL (`youtube.com/@nom`, `/channel/…`,
 * `tiktok.com/@nom`, `vimeo.com/nom`) — pas une vidéo.
 *
 * 🔴 Mesuré en production le 2026-09-29 au premier passage : les 8 liens
 * déclarés « morts » étaient TOUS des pages de chaîne. L'oEmbed ne connaît que
 * les vidéos et répond 404/400 pour une chaîne qui existe très bien. Une chaîne
 * se vérifie donc en appelant sa page, qui, elle, répond 404 si la chaîne a
 * disparu.
 */
export function estPageDeProfil(url: string): boolean {
  let chemin: string;
  try {
    chemin = new URL(url).pathname;
  } catch {
    return false;
  }
  const p = plateformeDe(url);
  if (p === "YouTube") return /^\/(@|channel\/|c\/|user\/)/i.test(chemin);
  if (p === "TikTok") return !/\/video\//i.test(chemin);
  if (p === "Vimeo") return !/^\/(\d+|video\/\d+|channels\/[^/]+\/\d+)/i.test(chemin);
  return false;
}

/** Service oEmbed officiel : il dit si la VIDÉO existe (une page YouTube répond 200 même vidéo retirée). */
export function urlOembed(url: string): string | null {
  if (estPageDeProfil(url)) return null;
  const p = plateformeDe(url);
  const u = encodeURIComponent(url);
  if (p === "YouTube") return `https://www.youtube.com/oembed?format=json&url=${u}`;
  if (p === "Vimeo") return `https://vimeo.com/api/oembed.json?url=${u}`;
  if (p === "TikTok") return `https://www.tiktok.com/oembed?url=${u}`;
  return null;
}

export function estDerriereConnexion(url: string): boolean {
  return DERRIERE_CONNEXION.has(plateformeDe(url));
}

/**
 * L'état d'un lien d'après le code HTTP obtenu (de la page ou de l'oEmbed).
 * 🔑 Seuls 404 et 410 — et 400 sur un oEmbed, qui veut dire « cette URL ne
 * désigne aucune vidéo » — valent « mort ». 401/403 (privé, anti-robot), 429,
 * 5xx et `null` (délai, réseau) valent « invérifiable » : une panne passagère
 * lue comme une mort ferait écarter un candidat à tort.
 */
export function etatDepuisStatut(statut: number | null, viaOembed: boolean): EtatLien {
  if (statut === null) return "inverifiable";
  if (statut >= 200 && statut < 400) return "vivant";
  if (statut === 404 || statut === 410) return "mort";
  if (viaOembed && statut === 400) return "mort";
  return "inverifiable";
}
