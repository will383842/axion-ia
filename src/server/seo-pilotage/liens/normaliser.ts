/**
 * S10-1 · Normalisation des liens reçus. Module PUR : ni base, ni réseau.
 *
 * Aucune donnée personnelle par construction : on ne garde que des URL publiques, un domaine,
 * une ancre tronquée. Jamais de texte de page, de nom, d'adresse e-mail, d'IP ni d'agent.
 */
import { normaliserChemin } from "../donnees/chemins";

export const PAGE_SOURCE_MAX = 2000;
export const DOMAINE_MAX = 255;
export const CHEMIN_CIBLE_MAX = 500;
export const ANCRE_MAX = 200;
/** Aucune cellule d'un CSV importé n'est gardée au-delà de cette longueur. */
export const CELLULE_MAX = 2000;

const SCHEMA = /^[a-z][a-z0-9+.-]*:\/\//i;
const DOMAINE_AXION = "axion-ia.com";

function lireUrl(brut: string): URL | null {
  const s = (brut ?? "").trim();
  if (!s) return null;
  // Schémas sans « // » (mailto:, javascript:) : refusés d'emblée, jamais lus comme un hôte.
  if (/^(?:mailto|javascript|data|tel):/i.test(s)) return null;
  let u: URL;
  try {
    u = new URL(SCHEMA.test(s) ? s : `http://${s}`);
  } catch {
    return null;
  }
  return u.protocol === "http:" || u.protocol === "https:" ? u : null;
}

function estAdresseIp(hote: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hote) || hote.includes(":") || hote.startsWith("[");
}

function estDomaineAxion(hote: string): boolean {
  return hote === DOMAINE_AXION || hote.endsWith(`.${DOMAINE_AXION}`);
}

/** Hôte normalisé (minuscules, sans `www.`, sans port ni point final) ; null si inexploitable ou interne. */
export function normaliserDomaine(brut: string): string | null {
  const u = lireUrl(brut);
  if (!u) return null;
  // Une adresse e-mail n'est pas un domaine : « jean@gmail.com » ne devient jamais « gmail.com ».
  if (u.username || u.password) return null;
  const hote = u.hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^www\./, "");
  if (!hote || hote.length > DOMAINE_MAX || estAdresseIp(hote)) return null;
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(hote)) return null;
  if (estDomaineAxion(hote)) return null;
  return hote;
}

/**
 * Décode 3 fois (%40, %2540…) les seules séquences ASCII (%00 à %7F). Ne lève jamais : une
 * séquence invalide ailleurs (« %FF ») ne doit pas bloquer le décodage de « %2540 », sinon
 * l'adresse e-mail passerait (`decodeURIComponent` échoue sur la chaîne entière).
 */
function decoderTroisPasses(brut: string): string {
  let decode = brut;
  for (let i = 0; i < 3; i++) {
    decode = decode.replace(/%([0-7][0-9a-f])/gi, (_, h: string) =>
      String.fromCharCode(parseInt(h, 16)),
    );
  }
  return decode;
}

/** URL de la page qui porte le lien : http(s), sans fragment ni identifiants ; null si interne ou illisible. */
export function normaliserPageSource(brut: string): string | null {
  const u = lireUrl(brut);
  if (!u) return null;
  const hote = u.hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^www\./, "");
  // Un identifiant dans l'URL (« jean@gmail.com » lu comme URL) : pas un lien, on ne le « répare » pas.
  if (u.username || u.password || /^[^/]*@/.test(brut.trim())) return null;
  // Adresse e-mail dans la requête (?email=jean@x.fr) : aucune donnée personnelle gardée.
  // Aussi dans le chemin, et sous un encodage multiple (%40, %2540…).
  const decode = decoderTroisPasses(`${u.pathname}${u.search}`);
  if (/@|%40/i.test(u.search) || /[^\s/@]+@[^\s/@]+\.[a-z]{2,}/i.test(decode)) return null;
  if (estAdresseIp(hote) || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(hote)) return null;
  if (estDomaineAxion(hote)) return null;
  if (u.hostname.endsWith(".")) u.hostname = u.hostname.slice(0, -1);
  u.hash = "";
  u.username = "";
  u.password = "";
  const s = u.toString();
  return s.length > PAGE_SOURCE_MAX ? null : s;
}

/** Chemin cible sur Axion IA (via `normaliserChemin`) ; null si l'hôte est étranger ou la valeur vide. */
export function normaliserCible(brut: string): string | null {
  const s = (brut ?? "").trim();
  // Une valeur sans schéma ni « / » initial (« autre.fr/x ») n'est pas un chemin d'Axion IA.
  if (!(
    s.startsWith("/") ||
    /^https?:\/\//i.test(s) ||
    /^(?:www\.)?axion-ia\.com(?:[/?#]|$)/i.test(s)
  )) {
    return null;
  }
  if (/[^\s/@]+(?:@|%40)[^\s/@]+\.[a-z]{2,}/i.test(s)) return null;
  // Même décodage en 3 passes que `normaliserPageSource` (%2540 → %40 → @).
  if (/[^\s/@]+@[^\s/@]+\.[a-z]{2,}/i.test(decoderTroisPasses(s))) return null;
  const chemin = normaliserChemin(s);
  // Plafond de la spec (§ 3.1) : refusé, jamais tronqué.
  return chemin !== null && chemin.length <= CHEMIN_CIBLE_MAX ? chemin : null;
}

export function normaliserAncre(brut: string | null | undefined): string | null {
  const s = (brut ?? "").replace(/\s+/g, " ").trim().slice(0, ANCRE_MAX);
  // Une adresse e-mail n'est jamais gardée (donnée personnelle) : ancre refusée.
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(s)) return null;
  return s || null;
}

export function tronquerCellule(brut: string): string {
  return (brut ?? "").slice(0, CELLULE_MAX);
}
