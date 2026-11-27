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
 * Limites connues (sanitizer gelé) : `sanitizeContentGenHtml` retire `<caption>`
 * et `<h1>` (la branche « caption existante » et `abaisserH1` n'agissent donc
 * pas sur le blog actuel ; elles servent si la liste blanche évolue ou pour
 * d'autres chemins). Un h1 abaissé après `buildToc` reste hors sommaire et sans
 * `data-speakable`. Les tableaux imbriqués : seul le tableau externe est enveloppé.
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

/** Attributs d'une balise : tolère `>` dans une valeur entre guillemets. */
const ATTRS = `(?:"[^"]*"|'[^']*'|[^'">])*`;

const RE_ID = /(?:^|\s)id\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

function lireId(attrs: string): string | null {
  const m = RE_ID.exec(attrs);
  return m ? (m[1] ?? m[2] ?? null) : null;
}

function idsPresents(html: string): Set<string> {
  const ids = new Set<string>();
  for (const m of html.matchAll(/(?:^|\s)id\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
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
  const ouvrante = new RegExp(`^<table(?=[\\s>/])${ATTRS}>`, "i");
  const balises = /<(\/?)table(?=[\s>/])/gi;
  const dejaEnveloppe = new RegExp(
    `<div(?=[\\s])${ATTRS}\\bclass\\s*=\\s*["'][^"']*\\btable-scroll\\b[^"']*["']${ATTRS}>\\s*$`,
    "i",
  );

  let sortie = "";
  let curseur = 0;
  let debut = -1;
  let profondeur = 0;
  let tag: RegExpExecArray | null;
  while ((tag = balises.exec(html)) !== null) {
    if (tag[1] === "") {
      if (profondeur === 0) debut = tag.index;
      profondeur += 1;
    } else if (profondeur > 0) {
      profondeur -= 1;
      if (profondeur > 0) continue;
      const fin = html.indexOf(">", tag.index) + 1;
      if (fin === 0) break;
      const bloc = html.slice(debut, fin);
      const ouv = ouvrante.exec(bloc);
      const avant = html.slice(Math.max(0, debut - 600), debut);
      if (!ouv || dejaEnveloppe.test(avant)) continue;
      const finInterieur = bloc.length - "</table>".length;
      let corps = bloc.slice(ouv[0].length, finInterieur);
      const sousTableau = corps.search(/<table(?=[\s>/])/i);
      const zone = sousTableau === -1 ? corps : corps.slice(0, sousTableau);
      const cap = new RegExp(`<caption(?=[\\s>/])(${ATTRS})>`, "i").exec(zone);
      let idNom: string;
      if (cap) {
        const existant = lireId(cap[1] ?? "");
        if (existant) {
          idNom = existant;
        } else {
          idNom = prochainId();
          corps =
            corps.slice(0, cap.index) +
            `<caption id="${idNom}"${cap[1] ?? ""}>` +
            corps.slice(cap.index + cap[0].length);
        }
      } else {
        idNom = prochainId();
        corps = `<caption class="sr-only" id="${idNom}">${echapper(libelleNeutre)}</caption>${corps}`;
      }
      sortie += html.slice(curseur, debut);
      sortie += `<div class="table-scroll" role="region" tabindex="0" aria-labelledby="${echapper(idNom)}">${ouv[0]}${corps}${bloc.slice(finInterieur)}</div>`;
      curseur = fin;
    }
  }
  return sortie + html.slice(curseur);
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
 * de `buildToc` restent intacts. Si `buildToc` n'a rien posé (moins de 3 h2),
 * tous les h2 sans id reçoivent un id ici. `idsExistants` : ids déjà pris ailleurs.
 */
export function ancrerSousTitres(html: string, idsExistants: Iterable<string> = []): string {
  if (!html) return html;
  const utilises = idsPresents(html);
  for (const id of idsExistants) utilises.add(id);
  return html.replace(
    new RegExp(`<(h[23])(?=[\\s>/])(${ATTRS})>([\\s\\S]*?)<\\/\\1>`, "gi"),
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
    new RegExp(`<a(?=[\\s>/])(${ATTRS})>([\\s\\S]*?)<\\/a>`, "gi"),
    (complet: string, attrs: string, interieur: string) => {
      if (!/(?:^|\s)target\s*=\s*["']?_blank\b/i.test(attrs)) return complet;
      if (interieur.includes("data-nouvelle-fenetre")) return complet;
      return `<a${attrs}>${interieur}${mention}</a>`;
    },
  );
}
