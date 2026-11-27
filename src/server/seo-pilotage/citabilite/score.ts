/**
 * Pilotage SEO/GEO — score de citabilité sur 100 (module PUR : aucun modèle, aucun réseau,
 * aucun JS exécuté). Entrée : le HTML rendu d'une page publique, tel que le voit un visiteur.
 *
 * Le score sert à PRIORISER le travail éditorial. Il n'agit sur rien.
 * Grille : docs/pilotage-seo-geo/PLAN.md § 3.5.
 */

import {
  detecterFaitsDivergents,
  detecterInterditsDoctrine,
  faitsCanon,
  type DivergenceFait,
  type FaitsCanon,
  type InterditTrouve,
} from "./faits";

export const POINTS = {
  structureTitres: 10,
  reponseDirecte: 15,
  passagesAutonomes: 15,
  chiffresSources: 10,
  dateVisible: 10,
  jsonLd: 10,
  faq: 5,
  structureListes: 5,
  indexable: 10,
  liensInternes: 5,
  markdown: 5,
} as const;

export const PENALITE_FAIT_CANON = 20;
export const PENALITE_INTERDIT = 20;
/** Au-delà, le HTML est tronqué avant analyse. */
export const TAILLE_HTML_MAX = 1_000_000;
export const FRAICHEUR_MAX_JOURS = 365;
export const HOTE_SITE = "axion-ia.com";
export const ID_ORGANISATION = `https://${HOTE_SITE}/#organization`;

export type IdCritere = keyof typeof POINTS;

export interface EntreePage {
  readonly html: string;
  /** URL publique de la page (comparée à la canonique). */
  readonly url: string;
  readonly dansSitemap: boolean;
  /** Une variante Markdown répond-elle ? (sinon on cherche un `<link rel="alternate">`). */
  readonly varianteMarkdown?: boolean;
  /** Chemins des pages « fortes » (ex. `/journee-ia`). */
  readonly pagesFortes: readonly string[];
  readonly maintenant: Date;
  /** Faits canon ; lus à la source par défaut. */
  readonly canon?: FaitsCanon;
}

export interface ResultatCritere {
  readonly id: IdCritere;
  readonly points: number;
  readonly max: number;
  readonly ok: boolean;
}

export interface PenaliteScore {
  readonly code: "fait-canon" | "interdit";
  readonly points: number;
  readonly detail: string;
}

export interface ResultatCitabilite {
  /** Entier de 0 à 100. */
  readonly score: number;
  readonly sousTotal: number;
  readonly criteres: readonly ResultatCritere[];
  readonly penalites: readonly PenaliteScore[];
  readonly divergences: readonly DivergenceFait[];
  readonly interdits: readonly InterditTrouve[];
}

/* ───────────────────────── extraction HTML (sans dépendance) ───────────────────────── */

const ENTITES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  euro: "€",
  rsquo: "’",
  lsquo: "‘",
  laquo: "«",
  raquo: "»",
};

function decoder(t: string): string {
  return t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tout, e: string) => {
    if (e[0] === "#") {
      const code =
        e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000
        ? String.fromCodePoint(code)
        : tout;
    }
    return ENTITES[e.toLowerCase()] ?? tout;
  });
}

function texteDe(fragment: string): string {
  return decoder(fragment.replace(/<[^>]{0,1024}>/g, " "))
    .replace(/[  ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sansScripts(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, " ");
}

function balises(html: string, nom: string): string[] {
  const re = new RegExp(`<${nom}\\b[^>]{0,1024}>([\\s\\S]*?)<\\/${nom}\\s*>`, "gi");
  return [...html.matchAll(re)].map((m) => m[1] ?? "");
}

function attribut(balise: string, nom: string): string | null {
  const m = new RegExp(`\\b${nom}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(balise);
  return m ? decoder(m[1] ?? m[2] ?? m[3] ?? "") : null;
}

function ouvrantes(html: string, nom: string): string[] {
  return [...html.matchAll(new RegExp(`<${nom}\\b[^>]{0,1024}>`, "gi"))].map((m) => m[0]);
}

function mots(t: string): number {
  const m = t.match(/\S+/g);
  return m ? m.length : 0;
}

function normaliser(t: string): string {
  return t
    .replace(/[  ]/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hoteDe(href: string, base: string): string | null {
  try {
    return new URL(href, base).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function cheminDe(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    return (u.pathname.replace(/\/+$/, "") || "/").toLowerCase();
  } catch {
    return null;
  }
}

/** Nœuds JSON-LD aplatis (@graph et objets imbriqués compris). Un bloc illisible est ignoré. */
function noeudsJsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visiter = (v: unknown, profondeur: number): void => {
    if (profondeur > 8 || v === null || typeof v !== "object") return;
    if (Array.isArray(v)) {
      for (const x of v) visiter(x, profondeur + 1);
      return;
    }
    const o = v as Record<string, unknown>;
    out.push(o);
    for (const x of Object.values(o)) visiter(x, profondeur + 1);
  };
  const re =
    /<script\b[^>]{0,1024}type\s*=\s*["']application\/ld\+json["'][^>]{0,1024}>([\s\S]*?)<\/script\s*>/gi;
  for (const m of html.matchAll(re)) {
    try {
      visiter(JSON.parse(m[1] ?? ""), 0);
    } catch {
      /* JSON-LD cassé : aucun point, pas d'exception */
    }
  }
  return out;
}

function aType(n: Record<string, unknown>, type: string): boolean {
  const t = n["@type"];
  return Array.isArray(t) ? t.includes(type) : t === type;
}

const INTERROGATIF =
  /^(qu['’e]|quel|quelle|quels|quelles|comment|pourquoi|combien|quand|ou |est-ce|peut-on|faut-il|dois-je|y a-t-il|a-t-on|que |qui |lequel)/;

const RENVOI =
  /(comme (vu|indique|mentionne|evoque|explique|dit|detaille)|ci-dessus|plus haut|precedemment|(?<![a-z])voir plus haut)/;

/* ───────────────────────────────── critères ───────────────────────────────── */

function critere(id: IdCritere, ok: boolean): ResultatCritere {
  return { id, max: POINTS[id], points: ok ? POINTS[id] : 0, ok };
}

/** Score de citabilité d'une page à partir de son HTML rendu. */
export function calculerCitabilite(entree: EntreePage): ResultatCitabilite {
  const canon = entree.canon ?? faitsCanon();
  // Entrée non fiable : on borne la taille pour garder un coût linéaire.
  const brut =
    entree.html.length > TAILLE_HTML_MAX ? entree.html.slice(0, TAILLE_HTML_MAX) : entree.html;
  const html = sansScripts(brut);
  const corps = balises(html, "main")[0] ?? balises(html, "body")[0] ?? html;

  // 1. Titres
  const h1 = balises(html, "h1");
  const h2 = balises(corps, "h2").map(texteDe);
  const questions = h2.filter((t) => t.endsWith("?") || INTERROGATIF.test(normaliser(t))).length;
  const titres = h1.length === 1 && h2.length >= 3 && questions / h2.length >= 0.3;

  // Paragraphes du corps, avec leur rang en mots depuis le début.
  const paragraphes: { texte: string; mots: number; debut: number }[] = [];
  let cumul = 0;
  for (const p of balises(corps, "p")) {
    const t = texteDe(p);
    const n = mots(t);
    if (n === 0) continue;
    paragraphes.push({ texte: t, mots: n, debut: cumul });
    cumul += n;
  }

  // 2. Réponse directe
  const reponse = paragraphes.some((p) => p.mots >= 40 && p.mots <= 90 && p.debut < 200);

  // 3. Passages autonomes
  const autonomes = paragraphes.filter(
    (p) => p.mots >= 40 && p.mots <= 120 && !RENVOI.test(normaliser(p.texte)),
  ).length;

  // 4. Chiffres sourcés : un chiffre ET un lien externe dans le même paragraphe
  const sources = balises(corps, "p").some((p) => {
    if (!/\d/.test(texteDe(p))) return false;
    return ouvrantes(p, "a").some((a) => {
      const href = attribut(a, "href");
      if (!href || !/^https?:\/\//i.test(href)) return false;
      const h = hoteDe(href, entree.url);
      return h !== null && h !== HOTE_SITE && !h.endsWith(`.${HOTE_SITE}`);
    });
  });

  // 5. Date visible + dateModified récente
  const noeuds = noeudsJsonLd(brut);
  const dateVisible = ouvrantes(html, "time").some((t) => {
    const d = attribut(t, "datetime");
    return d !== null && !Number.isNaN(Date.parse(d));
  });
  const modifs = noeuds
    .map((n) => (typeof n["dateModified"] === "string" ? Date.parse(n["dateModified"]) : NaN))
    .filter((d) => !Number.isNaN(d));
  const ageJours = modifs.length
    ? (entree.maintenant.getTime() - Math.max(...modifs)) / 86_400_000
    : Number.POSITIVE_INFINITY;
  const date = dateVisible && ageJours >= -2 && ageJours <= FRAICHEUR_MAX_JOURS;

  // 6. JSON-LD relié à /#organization, sans second nœud Organization
  const organisations = noeuds.filter((n) => aType(n, "Organization"));
  const estReference = (x: unknown): boolean =>
    x !== null &&
    typeof x === "object" &&
    !Array.isArray(x) &&
    (x as Record<string, unknown>)["@id"] === ID_ORGANISATION;
  const referencesOrg = noeuds.some((n) =>
    Object.values(n).some((v) => (Array.isArray(v) ? v.some(estReference) : estReference(v))),
  );
  // Un nœud Organization « complet » est une définition ; une simple référence `{ "@id" }` n'en est pas une.
  const definitions = organisations.filter((n) =>
    Object.keys(n).some((k) => k !== "@id" && k !== "@type"),
  );
  const jsonLd =
    noeuds.length > 0 &&
    (referencesOrg || definitions.some((n) => n["@id"] === ID_ORGANISATION)) &&
    definitions.every((n) => n["@id"] === ID_ORGANISATION);

  // 7. FAQ visible concordant avec FAQPage
  const texteVisible = texteDe(corps);
  const visibleNorm = normaliser(texteVisible);
  const faqNoeuds = noeuds.filter((n) => aType(n, "FAQPage"));
  const questionsFaq = faqNoeuds
    .flatMap((n) => {
      const e = n["mainEntity"];
      return Array.isArray(e) ? e : e ? [e] : [];
    })
    .map((q) => (q && typeof q === "object" ? (q as Record<string, unknown>)["name"] : null))
    .filter((q): q is string => typeof q === "string" && q.trim() !== "");
  const faq =
    questionsFaq.length > 0 &&
    questionsFaq.every((q) => visibleNorm.includes(normaliser(texteDe(q))));

  // 8. Tableau ou liste structurée
  const listes =
    /<table\b/i.test(corps) ||
    [...corps.matchAll(/<(ul|ol)\b[^>]{0,1024}>([\s\S]*?)<\/\1\s*>/gi)].some(
      (m) => (m[2]?.match(/<li\b/gi) ?? []).length >= 3,
    );

  // 9. Indexable, canonique sur elle-même, dans le sitemap
  const robots = ouvrantes(html, "meta")
    .filter((m) => (attribut(m, "name") ?? "").toLowerCase() === "robots")
    .map((m) => (attribut(m, "content") ?? "").toLowerCase());
  const canoniques = ouvrantes(html, "link")
    .filter((l) => (attribut(l, "rel") ?? "").toLowerCase() === "canonical")
    .map((l) => attribut(l, "href"));
  const canonique = canoniques.length === 1 ? canoniques[0] : null;
  const indexable =
    entree.dansSitemap &&
    !robots.some((r) => /\bnoindex\b|\bnone\b/.test(r)) &&
    !!canonique &&
    cheminDe(canonique, entree.url) === cheminDe(entree.url, entree.url) &&
    hoteDe(canonique, entree.url) === hoteDe(entree.url, entree.url);

  // 10. Au moins 2 liens internes distincts vers des pages fortes
  const fortes = new Set(
    entree.pagesFortes.map((p) => (p.replace(/\/+$/, "") || "/").toLowerCase()),
  );
  const propre = cheminDe(entree.url, entree.url);
  const liensForts = new Set<string>();
  for (const a of ouvrantes(corps, "a")) {
    const href = attribut(a, "href");
    if (!href) continue;
    if (hoteDe(href, entree.url) !== hoteDe(entree.url, entree.url)) continue;
    const c = cheminDe(href, entree.url);
    if (c && c !== propre && fortes.has(c)) liensForts.add(c);
  }

  // 11. Variante Markdown
  const markdown =
    entree.varianteMarkdown === true ||
    ouvrantes(html, "link").some(
      (l) =>
        (attribut(l, "rel") ?? "").toLowerCase() === "alternate" &&
        (attribut(l, "type") ?? "").toLowerCase() === "text/markdown",
    );

  const criteres: ResultatCritere[] = [
    critere("structureTitres", titres),
    critere("reponseDirecte", reponse),
    critere("passagesAutonomes", autonomes >= 3),
    critere("chiffresSources", sources),
    critere("dateVisible", date),
    critere("jsonLd", jsonLd),
    critere("faq", faq),
    critere("structureListes", listes),
    critere("indexable", indexable),
    critere("liensInternes", liensForts.size >= 2),
    critere("markdown", markdown),
  ];
  const sousTotal = criteres.reduce((s, c) => s + c.points, 0);

  // Pénalités : faits canon et mots interdits (lus sur le texte visible)
  const divergences = detecterFaitsDivergents(texteVisible, canon);
  const interdits = detecterInterditsDoctrine(texteVisible);
  const penalites: PenaliteScore[] = [];
  if (divergences.length > 0) {
    penalites.push({
      code: "fait-canon",
      points: PENALITE_FAIT_CANON,
      detail: divergences.map((d) => `${d.type} : ${d.trouve} au lieu de ${d.attendu}`).join(" ; "),
    });
  }
  if (interdits.length > 0) {
    penalites.push({
      code: "interdit",
      points: PENALITE_INTERDIT,
      detail: interdits.map((i) => i.code).join(", "),
    });
  }
  const retrait = penalites.reduce((s, p) => s + p.points, 0);

  return {
    score: Math.max(0, Math.min(100, sousTotal - retrait)),
    sousTotal,
    criteres,
    penalites,
    divergences,
    interdits,
  };
}
