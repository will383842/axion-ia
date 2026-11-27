/**
 * Transformations de contenu des articles de blog (gabarits V2, PR S3).
 *
 * Fonctions PURES, côté serveur, appliquées sur le HTML déjà passé par le
 * sanitizer (et, pour `ancrerSousTitres`, après `buildToc`). Aucune dépendance
 * au DOM : tout se fait sur la chaîne, de façon tolérante (HTML malformé
 * laissé tel quel, jamais d'exception).
 *
 * Ordre recommandé : sanitizer → buildToc → abaisserH1 → envelopperTableaux →
 * marquerLiensExternes → ancrerSousTitres. Toutes sont idempotentes.
 *
 * ⚠️ `buildToc` reste gelé : ses `id` de `<h2>` ne sont jamais modifiés ici.
 */

import { slugifyHeading } from "@/lib/knowledge/article-enrich";

function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function texteBrut(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const RE_ID = /\bid\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

function lireId(attrs: string): string | null {
  const m = RE_ID.exec(attrs);
  return m ? (m[1] ?? m[2] ?? null) : null;
}

function idsPresents(html: string): Set<string> {
  const ids = new Set<string>();
  for (const m of html.matchAll(/\bid\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const id = m[1] ?? m[2];
    if (id) ids.add(id);
  }
  return ids;
}

/**
 * Enveloppe chaque `<table>` dans une région défilante focusable et nommée.
 * Le nom vient de la `<caption>` (un `id` lui est posé au besoin) ; sinon une
 * `<caption class="sr-only">` portant `libelleNeutre` (déjà traduit) est insérée.
 */
export function envelopperTableaux(html: string, libelleNeutre: string): string {
  if (!html) return html;
  const pris = idsPresents(html);
  let n = 0;
  const prochainId = (): string => {
    do n += 1;
    while (pris.has(`cap-${n}`));
    pris.add(`cap-${n}`);
    return `cap-${n}`;
  };

  return html.replace(
    /(<div\b[^>]*\bclass\s*=\s*["'][^"']*\btable-scroll\b[^"']*["'][^>]*>\s*)?(<table\b[^>]*>)([\s\S]*?)<\/table>/gi,
    (complet: string, dejaEnveloppe: string | undefined, ouvrante: string, interieur: string) => {
      if (dejaEnveloppe) return complet;
      let corps = interieur;
      let idNom: string;
      const cap = /<caption\b([^>]*)>/i.exec(corps);
      if (cap) {
        const existant = lireId(cap[1] ?? "");
        if (existant) {
          idNom = existant;
        } else {
          idNom = prochainId();
          corps = corps.replace(/<caption\b([^>]*)>/i, `<caption id="${idNom}"$1>`);
        }
      } else {
        idNom = prochainId();
        corps = `<caption class="sr-only" id="${idNom}">${echapper(libelleNeutre)}</caption>${corps}`;
      }
      return `<div class="table-scroll" role="region" tabindex="0" aria-labelledby="${idNom}">${ouvrante}${corps}</table></div>`;
    },
  );
}

/** Transforme chaque `<h1>` du corps en `<h2>` (le h1 de la page est celui de l'en-tête). */
export function abaisserH1(html: string): string {
  if (!html) return html;
  return html.replace(/<(\/?)h1(?=[\s>/])/gi, "<$1h2");
}

export interface ProblemeTitre {
  readonly type: "saut" | "h1";
  readonly niveau: number;
  readonly niveauPrecedent: number;
  readonly texte: string;
}

/**
 * Liste les anomalies de hiérarchie de titres sans réécrire le HTML. Le niveau
 * de départ est 1 (h1 de l'en-tête) : un corps qui débute par un h3 est un saut.
 */
export function controlerTitres(html: string): ReadonlyArray<ProblemeTitre> {
  if (!html) return [];
  const problemes: ProblemeTitre[] = [];
  let precedent = 1;
  for (const m of html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const niveau = Number(m[1]);
    const texte = texteBrut(m[2] ?? "");
    if (niveau === 1) {
      problemes.push({ type: "h1", niveau, niveauPrecedent: precedent, texte });
    } else if (niveau > precedent + 1) {
      problemes.push({ type: "saut", niveau, niveauPrecedent: precedent, texte });
    }
    precedent = niveau;
  }
  return problemes;
}

/**
 * Produit un `id` unique à partir d'un libellé (mêmes règles que `buildToc`) et
 * l'ajoute à `utilises`. Sert aux h3, questions de FAQ et étapes.
 */
export function idUniqueDepuis(texte: string, utilises: Set<string>): string {
  const base = slugifyHeading(texte);
  let id = base;
  let n = 2;
  while (utilises.has(id)) id = `${base}-${n++}`;
  utilises.add(id);
  return id;
}

/**
 * Pose un `id` stable sur les `<h3>` (et sur un `<h2>` qui n'en a pas, ex. un
 * h1 abaissé). Un `id` déjà présent n'est JAMAIS modifié, donc ceux des `<h2>`
 * de `buildToc` restent intacts. `idsExistants` : ids déjà pris ailleurs.
 */
export function ancrerSousTitres(html: string, idsExistants: Iterable<string> = []): string {
  if (!html) return html;
  const utilises = idsPresents(html);
  for (const id of idsExistants) utilises.add(id);
  return html.replace(
    /<(h[23])\b([^>]*)>([\s\S]*?)<\/\1>/gi,
    (complet: string, balise: string, attrs: string, interieur: string) => {
      if (lireId(attrs) !== null) return complet;
      const texte = texteBrut(interieur);
      if (!texte) return complet;
      return `<${balise} id="${idUniqueDepuis(texte, utilises)}"${attrs}>${interieur}</${balise}>`;
    },
  );
}

/**
 * Ajoute, aux liens `target="_blank"`, une mention masquée visuellement
 * (lecteurs d'écran). `libelle` est fourni déjà traduit, ex. « (nouvelle fenêtre) ».
 */
export function marquerLiensExternes(html: string, libelle: string): string {
  if (!html) return html;
  const mention = `<span class="sr-only" data-nouvelle-fenetre=""> ${echapper(libelle)}</span>`;
  return html.replace(
    /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
    (complet: string, attrs: string, interieur: string) => {
      if (!/\btarget\s*=\s*["']?_blank\b/i.test(attrs)) return complet;
      if (interieur.includes("data-nouvelle-fenetre")) return complet;
      return `<a${attrs}>${interieur}${mention}</a>`;
    },
  );
}
