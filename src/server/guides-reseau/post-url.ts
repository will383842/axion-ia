/**
 * CONTRÔLE STRICT DE `post_url` (ADR contrat v3, I4).
 *
 * Analyse par `new URL` ; https ; hôte STRICTEMENT égal à la liste du réseau (jamais
 * `endsWith`) ; sans port, identifiant, paramètre, fragment ; ASCII seulement (pas d'IDN) ;
 * ≤ 300 caractères ; le chemin doit commencer par un préfixe de NOS comptes, ce qui refuse
 * tout chemin de profil (pseudo). Les raccourcisseurs sont refusés par la liste blanche.
 * L'URL n'est JAMAIS récupérée par le serveur. À l'affichage : `rel="noopener noreferrer nofollow"`.
 *
 * Les préfixes de chemin de nos comptes sont une configuration non secrète
 * (`GUIDES_RESEAU_POST_URL_PREFIXES`, JSON `{ "<reseau>": ["/chemin/"] }`). FERMÉ PAR DÉFAUT :
 * sans préfixe pour le réseau, toute `post_url` est refusée.
 */
export const HOTES_POST_URL: Readonly<Record<string, readonly string[]>> = {
  instagram: ["www.instagram.com", "instagram.com"],
  facebook: ["www.facebook.com", "facebook.com"],
  linkedin_page: ["www.linkedin.com"],
  tiktok: ["www.tiktok.com"],
  page_guide: ["axion-ia.com", "www.axion-ia.com"],
};

export const LONGUEUR_MAX_POST_URL = 300;

export type PrefixesComptes = Readonly<Record<string, readonly string[]>>;

export function prefixesDepuisEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): PrefixesComptes {
  const brut = env.GUIDES_RESEAU_POST_URL_PREFIXES;
  if (!brut) return {};
  try {
    const v: unknown = JSON.parse(brut);
    if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
    const sortie: Record<string, string[]> = {};
    for (const [k, l] of Object.entries(v)) {
      if (Array.isArray(l)) {
        sortie[k] = l.filter((p): p is string => typeof p === "string" && p.startsWith("/"));
      }
    }
    return sortie;
  } catch {
    return {};
  }
}

export function validerPostUrl(
  valeur: string,
  reseau: string,
  prefixes: PrefixesComptes = prefixesDepuisEnv(),
): { readonly ok: boolean } {
  const non = { ok: false } as const;
  if (valeur.length === 0 || valeur.length > LONGUEUR_MAX_POST_URL) return non;
  // eslint-disable-next-line no-control-regex
  if (!/^[\x21-\x7e]+$/.test(valeur)) return non; // ASCII imprimable : ni IDN ni espace
  let u: URL;
  try {
    u = new URL(valeur);
  } catch {
    return non;
  }
  if (u.protocol !== "https:") return non;
  if (u.port !== "" || u.username !== "" || u.password !== "") return non;
  if (u.search !== "" || u.hash !== "" || valeur.includes("?") || valeur.includes("#")) return non;
  const hotes = HOTES_POST_URL[reseau];
  if (!hotes || !hotes.includes(u.hostname)) return non;
  if (u.hostname.includes("xn--")) return non;
  if (u.pathname.includes("..") || u.pathname.includes("//")) return non;
  const autorises = prefixes[reseau] ?? [];
  const sousPrefixe = autorises.some(
    (p) => u.pathname.startsWith(p) && u.pathname.length > p.length,
  );
  return sousPrefixe ? { ok: true } : non;
}
