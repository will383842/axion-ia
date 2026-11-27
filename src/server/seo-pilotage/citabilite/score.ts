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

const BLOCS_TEXTE =
  /<\/?(?:h[1-6]|p|li|ul|ol|div|section|article|header|footer|main|nav|aside|figure|figcaption|table|thead|tbody|tr|th|td|dt|dd|dl|blockquote|pre|br|hr|form|details|summary)\b[^>]{0,1024}>/gi;

function texteDe(fragment: string, separerBlocs = false): string {
  const t = separerBlocs ? fragment.replace(BLOCS_TEXTE, "\n") : fragment;
  return decoder(t.replace(/<[^>]{0,1024}>/g, " "))
    .replace(/[  ]/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n[\s]*/g, separerBlocs ? "\n" : " ")
    .trim();
}

interface Bloc {
  readonly ouvrante: string;
  readonly contenu: string;
}

/**
 * Blocs `<nom …>…</nom>` en UNE passe, sans retour arrière : une balise ouvrante sans fermante
 * s'arrête à la première recherche vaine (aucune fermante plus loin non plus), donc coût linéaire.
 */
function blocs(html: string, nom: string): Bloc[] {
  const ouvre = new RegExp(`<${nom}\\b[^>]{0,1024}>`, "gi");
  const ferme = new RegExp(`<\\/${nom}\\s*>`, "gi");
  const out: Bloc[] = [];
  let pos = 0;
  for (;;) {
    ouvre.lastIndex = pos;
    const o = ouvre.exec(html);
    if (!o) break;
    const debut = o.index + o[0].length;
    ferme.lastIndex = debut;
    const f = ferme.exec(html);
    if (!f) break;
    out.push({ ouvrante: o[0], contenu: html.slice(debut, f.index) });
    pos = f.index + f[0].length;
  }
  return out;
}

/**
 * Un `<` sans `>` à moins de 1 024 caractères n'ouvre aucune balise : on l'écrit `&lt;` UNE fois,
 * en une passe (le `>` suivant est mémorisé), pour qu'aucune regex ne rebalaie 1 024 caractères
 * à chaque `<` d'une entrée hostile.
 */
function neutraliserChevrons(html: string): string {
  let out = "";
  let pos = 0;
  let gt = -2; // -2 : pas encore cherché ; -1 : plus aucun `>`
  for (;;) {
    const lt = html.indexOf("<", pos);
    if (lt < 0) break;
    if (gt !== -1 && gt < lt) gt = html.indexOf(">", lt);
    if (gt === -1 || gt - lt > 1024) {
      out += html.slice(pos, lt) + "&lt;";
    } else {
      out += html.slice(pos, lt + 1);
    }
    pos = lt + 1;
  }
  return out + html.slice(pos);
}

function sansCommentaires(html: string): string {
  // Commentaires : indexOf, linéaire ; un commentaire non fermé s'arrête là (reste inchangé).
  let sans = "";
  let pos = 0;
  for (;;) {
    const d = html.indexOf("<!--", pos);
    if (d < 0) break;
    const f = html.indexOf("-->", d + 4);
    if (f < 0) {
      // Commentaire jamais fermé : le navigateur ignore tout le reste, nous aussi.
      return sans + html.slice(pos, d);
    }
    sans += html.slice(pos, d) + " ";
    pos = f + 3;
  }
  return sans + html.slice(pos);
}

function sansScripts(entree: string): string {
  let sans = entree;
  for (const nom of ["script", "style", "noscript", "template"]) {
    let r = "";
    let p = 0;
    const ouvre = new RegExp(`<${nom}\\b[^>]{0,1024}>`, "gi");
    const ferme = new RegExp(`<\\/${nom}\\s*>`, "gi");
    for (;;) {
      ouvre.lastIndex = p;
      const o = ouvre.exec(sans);
      if (!o) break;
      ferme.lastIndex = o.index + o[0].length;
      const f = ferme.exec(sans);
      if (!f) break;
      r += sans.slice(p, o.index) + " ";
      p = f.index + f[0].length;
    }
    sans = r + sans.slice(p);
  }
  return sans;
}

function balises(html: string, nom: string): string[] {
  return blocs(html, nom).map((b) => b.contenu);
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

/**
 * Nœuds JSON-LD aplatis (@graph et objets imbriqués compris). Un bloc illisible est ignoré.
 * `racines` : nœuds posés au niveau du document ou dans `@graph` (les autres sont imbriqués).
 */
function noeudsJsonLd(html: string): { noeuds: Record<string, unknown>[]; racines: Set<object> } {
  const out: Record<string, unknown>[] = [];
  const racines = new Set<object>();
  const visiter = (v: unknown, profondeur: number, racine: boolean): void => {
    if (profondeur > 8 || v === null || typeof v !== "object") return;
    if (Array.isArray(v)) {
      for (const x of v) visiter(x, profondeur + 1, racine);
      return;
    }
    const o = v as Record<string, unknown>;
    out.push(o);
    if (racine) racines.add(o);
    for (const [k, x] of Object.entries(o)) visiter(x, profondeur + 1, k === "@graph" && racine);
  };
  for (const b of blocs(html, "script")) {
    if (!/type\s*=\s*["']application\/ld\+json["']/i.test(b.ouvrante)) continue;
    try {
      visiter(JSON.parse(b.contenu), 0, true);
    } catch {
      /* JSON-LD cassé : aucun point, pas d'exception */
    }
  }
  return { noeuds: out, racines };
}

const TYPES_ORGANISATION = [
  "Organization",
  "EducationalOrganization",
  "GovernmentOrganization",
  "Corporation",
  "NGO",
  "LocalBusiness",
  "ProfessionalService",
];

function aType(n: Record<string, unknown>, type: string | readonly string[]): boolean {
  const cibles = typeof type === "string" ? [type] : type;
  const t = n["@type"];
  return Array.isArray(t) ? t.some((x) => cibles.includes(String(x))) : cibles.includes(String(t));
}

const INTERROGATIF =
  /^(qu['’]|que |qui |quel(?:le)?s?\b|lequel|comment |pourquoi|combien|quand |ou |est-ce|peut-on|faut-il|dois-je|y a-t-il|a-t-on)/;

const RENVOI =
  /(comme (vu|indique|mentionne|evoque|explique|dit|detaille)\b|ci-dessus|ci-dessous|plus haut|precedemment|(?<![a-z])voir plus haut)/;

/* ───────────────────────────────── critères ───────────────────────────────── */

function critere(id: IdCritere, ok: boolean): ResultatCritere {
  return { id, max: POINTS[id], points: ok ? POINTS[id] : 0, ok };
}

/** Score de citabilité d'une page à partir de son HTML rendu. */
export function calculerCitabilite(entree: EntreePage): ResultatCitabilite {
  const canon = entree.canon ?? faitsCanon();
  // Entrée non fiable : on borne la taille pour garder un coût linéaire.
  const brut = neutraliserChevrons(
    entree.html.length > TAILLE_HTML_MAX ? entree.html.slice(0, TAILLE_HTML_MAX) : entree.html,
  );
  const sansComm = sansCommentaires(brut);
  const html = sansScripts(sansComm);
  const corps = balises(html, "main")[0] ?? balises(html, "body")[0] ?? html;

  // 1. Titres
  const h1 = balises(html, "h1");
  const h2 = balises(corps, "h2").map((t) => texteDe(t));
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
  const { noeuds, racines } = noeudsJsonLd(sansComm);
  const dateVisible = ouvrantes(corps, "time").some((t) => {
    const d = attribut(t, "datetime");
    return d !== null && !Number.isNaN(Date.parse(d));
  });
  // Les dates d'un `WebSite`, d'une image ou d'une vidéo ne datent pas le contenu de la page.
  const modifs = noeuds
    .filter((n) => !aType(n, ["WebSite", "ImageObject", "VideoObject", "AudioObject"]))
    .map((n) => (typeof n["dateModified"] === "string" ? Date.parse(n["dateModified"]) : NaN))
    .filter((d) => !Number.isNaN(d));
  const ageJours = modifs.length
    ? (entree.maintenant.getTime() - Math.max(...modifs)) / 86_400_000
    : Number.POSITIVE_INFINITY;
  const date = dateVisible && ageJours >= -2 && ageJours <= FRAICHEUR_MAX_JOURS;

  // 6. JSON-LD relié à /#organization, sans second nœud Organization
  // Seuls les nœuds posés au niveau du document ou de `@graph` sont des définitions : un
  // `recognizedBy` / `publisher` / `citation` imbriqué décrit un TIERS, pas l'organisation du site.
  const organisations = noeuds.filter((n) => racines.has(n) && aType(n, TYPES_ORGANISATION));
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
  const texteVisible = texteDe(corps, true);
  const visibleNorm = normaliser(texteVisible.replace(/\n/g, " "));
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
    [...blocs(corps, "ul"), ...blocs(corps, "ol")].some(
      (b) => (b.contenu.match(/<li\b/gi) ?? []).length >= 3,
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
  // Le texte visible ne contient plus de balise : un `<` restant (entité décodée) est du texte, et
  // ne doit pas relancer le retrait de balises, quadratique, du contrôle de doctrine.
  const aAnalyser = texteVisible.replace(/[<>]/g, " ");
  const divergences = detecterFaitsDivergents(aAnalyser, canon);
  const interdits = detecterInterditsDoctrine(aAnalyser);
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
