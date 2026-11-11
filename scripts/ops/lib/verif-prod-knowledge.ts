/**
 * Parseurs purs de `scripts/ops/verif-prod-knowledge.ts` (aucun réseau ici :
 * tout est testable sur des fixtures HTML locales).
 */

/** Montants en euros tolérés (hors 1 490) : montants LÉGAUX uniquement. */
export const MONTANTS_BLANCS: ReadonlyArray<string> = [
  // Capital social de la SAS, tel qu'affiché dans les mentions légales.
  // À compléter uniquement avec un montant légal, jamais avec un prix.
];

export const MONTANT_AUTORISE = "1490";

/** Retire script/style/noscript/commentaires et les balises : texte visible approximatif. */
export function texteVisible(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;|&#xa0;/gi, " ")
    .replace(/&euro;|&#8364;|&#x20ac;/gi, "€")
    .replace(/\s+/g, " ")
    .trim();
}

const ESPACES = /[\s  ]/g;

/** Montants en euros trouvés dans un texte, normalisés (chiffres seuls, ex. « 1490 »). */
export function montantsEuros(texte: string): string[] {
  const re = /(\d{1,3}(?:[\s  .]\d{3})+|\d+)(?:[.,]\d{1,2})?\s*(?:€|EUR\b|euros?\b)/gi;
  const out: string[] = [];
  for (const m of texte.matchAll(re)) {
    out.push((m[1] ?? "").replace(ESPACES, "").replace(/\./g, ""));
  }
  return out;
}

/** Montants fautifs : tout montant ≠ 1 490 et absent de la liste blanche. */
export function montantsInterdits(
  texte: string,
  blancs: ReadonlyArray<string> = MONTANTS_BLANCS,
): string[] {
  return montantsEuros(texte).filter((m) => m !== MONTANT_AUTORISE && !blancs.includes(m));
}

export function contient1490(texte: string): boolean {
  // Bornes : « 11 490 » ou « 1 4900 » ne valent pas « 1 490 ».
  return /(?<!\d[\s\u00a0\u202f.]?)1[\s\u00a0\u202f.]?490(?!\d)/.test(texte);
}

export function contientGrenoble(texte: string): boolean {
  return /grenoble/i.test(texte);
}

/** Contenu des balises <loc> d'un sitemap ou d'un index. */
export function extraireLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1] ?? "");
}

/** Blocs JSON-LD d'une page, objets parsés (blocs invalides ignorés). */
export function extraireJsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      out.push(JSON.parse(m[1] ?? ""));
    } catch {
      /* bloc invalide : ignoré */
    }
  }
  return out;
}

function parcourir(noeud: unknown, visite: (o: Record<string, unknown>) => void): void {
  if (Array.isArray(noeud)) return noeud.forEach((n) => parcourir(n, visite));
  if (noeud && typeof noeud === "object") {
    const o = noeud as Record<string, unknown>;
    visite(o);
    Object.values(o).forEach((v) => parcourir(v, visite));
  }
}

export function addressLocalities(jsonLd: unknown[]): string[] {
  const out: string[] = [];
  parcourir(jsonLd, (o) => {
    if (typeof o.addressLocality === "string") out.push(o.addressLocality);
  });
  return out;
}

export function normaliser(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Ville d'une URL de page ville : dernier segment du chemin, dé-slugifié. */
export function villeDepuisUrl(url: string): string {
  const seg = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
  return normaliser(seg);
}

/** addressLocality égal à la ville de la page → true (échec attendu côté script). */
export function localiteEgaleVille(jsonLd: unknown[], url: string): boolean {
  const ville = villeDepuisUrl(url);
  return ville !== "" && addressLocalities(jsonLd).some((l) => normaliser(l) === ville);
}

/** Tirage déterministe de n éléments répartis sur la liste. */
export function echantillon<T>(liste: ReadonlyArray<T>, n: number): T[] {
  if (liste.length <= n) return [...liste];
  const pas = liste.length / n;
  return Array.from({ length: n }, (_, i) => liste[Math.floor(i * pas)] as T);
}

/**
 * Sous-sitemaps réellement utiles aux contrôles (FAQ + villes), bornés à `max`
 * pour ne pas marteler la prod : l'index en déclare plusieurs dizaines.
 */
export function sousSitemapsUtiles(locs: ReadonlyArray<string>, max = 4): string[] {
  const faq = locs.filter((u) => /\/sitemap\/faq\.xml$/.test(u));
  const villes = locs.filter((u) => /\/sitemap\/villes-[^/]+\.xml$/.test(u));
  return [...faq.slice(0, 1), ...echantillon(villes, Math.max(0, max - 1))];
}
