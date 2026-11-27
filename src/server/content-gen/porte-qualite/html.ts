/**
 * Lecture minimale d'un HTML de contenu (sans dépendance, sans DOM).
 * Les commentaires, scripts et styles sont retirés avant toute mesure : un
 * `<h1>` écrit dans un JSON-LD ne compte pas.
 */

export interface Titre {
  readonly niveau: number;
  readonly texte: string;
  readonly debut: number;
  readonly fin: number;
}

export function nettoyer(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ");
}

const ENTITES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

export function texteDe(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (e) => ENTITES[e] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compterMots(texte: string): number {
  return texte.trim().split(/\s+/).filter(Boolean).length;
}

/** Titres h1 à h6 de `html` (déjà nettoyé), dans l'ordre. */
export function titres(html: string): Titre[] {
  const out: Titre[] = [];
  const re = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi;
  for (const m of html.matchAll(re)) {
    const debut = m.index ?? 0;
    out.push({
      niveau: Number(m[1]),
      texte: texteDe(m[2] ?? ""),
      debut,
      fin: debut + m[0].length,
    });
  }
  return out;
}

export interface Lien {
  readonly href: string;
  readonly ancre: string;
}

export function liens(html: string): Lien[] {
  const out: Lien[] = [];
  const re = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a\s*>/gi;
  for (const m of html.matchAll(re)) {
    out.push({ href: (m[1] ?? m[2] ?? "").trim(), ancre: texteDe(m[3] ?? "") });
  }
  return out;
}

/**
 * Chemin interne normalisé (sans hôte, sans `#`, sans `?`, sans `/` final),
 * ou `null` si le lien est externe, ancre seule, mailto, etc.
 */
export function cheminInterne(href: string, hotes: ReadonlyArray<string>): string | null {
  const h = href.trim();
  if (!h || h.startsWith("#")) return null;
  let chemin: string;
  if (h.startsWith("//")) return null;
  if (h.startsWith("/")) {
    chemin = h;
  } else if (/^https?:\/\//i.test(h)) {
    let url: URL;
    try {
      url = new URL(h);
    } catch {
      return null;
    }
    if (!hotes.includes(url.hostname.toLowerCase())) return null;
    chemin = url.pathname;
  } else {
    return null;
  }
  chemin = chemin.split("#")[0]!.split("?")[0]!;
  if (chemin.length > 1) chemin = chemin.replace(/\/+$/, "");
  return chemin || "/";
}

/** Lien externe http(s) vers un autre hôte que les hôtes internes. */
export function estExterne(href: string, hotes: ReadonlyArray<string>): boolean {
  if (!/^https?:\/\//i.test(href.trim())) return false;
  return cheminInterne(href, hotes) === null;
}
