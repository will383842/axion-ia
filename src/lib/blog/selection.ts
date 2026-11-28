/**
 * Gabarit « Sélection (top X) » : fonctions pures, côté serveur, sur le HTML déjà assaini de
 * l'article. Aucune donnée n'est inventée : une option est un `<h2>` du corps qui n'est ni
 * une FAQ, ni des sources, ni une conclusion ; le numéro est un compteur CSS ; le tableau de
 * synthèse est celui de l'article, déplacé en fin de corps.
 */

/** Titres de section qui ne sont PAS une option de la liste. */
/**
 * Sections qui ne sont PAS une option, reconnues par le DÉBUT du titre (après un article
 * éventuel). Deux familles :
 *  - formules sans ambiguïté (FAQ, conclusion, « comment choisir »…) : exclues quelle que
 *    soit la longueur du titre ;
 *  - noms courants qui peuvent aussi ouvrir un nom d'outil (« Sources de… », « Résumé de… »,
 *    « Tableau (Salesforce) ») : exclus seulement si le titre reste court (≤ 5 mots).
 * Jamais sur un titre déjà numéroté à la main.
 */
const FORMULES_SANS_AMBIGUITE = [
  "faq",
  "foire aux questions",
  "questions?",
  "introduction",
  "conclu\\p{L}*",
  "pour conclure",
  "en bref",
  "par o[ùu] commencer",
  "pour aller plus loin",
  "pour finir",
  "pourquoi",
  "comment (?:nous|on|choisir)",
  "quel(?:le)?s?\\s+(?:\\p{L}+\\s+){0,3}choisir",
  "ce qu[’']il faut retenir",
  "[àa] retenir",
  "notre s[ée]lection",
  "tableau(?=\\s+(?:r[ée]capitulatif|de\\s+(?:synth|compar)|comparatif)|\\s*[?!.:]?\\s*$)",
];
const NOMS_AMBIGUS = [
  "sources?",
  "m[ée]thod\\p{L}*",
  "r[ée]sum\\p{L}*",
  "r[ée]cap\\p{L}*",
  "bilan",
  "verdict",
  "synth[èe]se",
  "comparatif",
  "crit[èe]res?",
];
const ARTICLE = "(?:(?:notre|nos|la|le|les|ce|en|une?)\\s+)?";
const debut = (motifs: ReadonlyArray<string>) =>
  new RegExp(`^\\s*${ARTICLE}(?:${motifs.join("|")})(?![\\p{L}])`, "iu");
const SANS_AMBIGUITE = debut(FORMULES_SANS_AMBIGUITE);
const AMBIGUS = debut(NOMS_AMBIGUS);
const MOTS_MAX_NOM_AMBIGU = 5;

const ENTITES: Record<string, string> = {
  nbsp: " ",
  rsquo: "’",
  apos: "'",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  agrave: "à",
  ugrave: "ù",
  ocirc: "ô",
  ccedil: "ç",
  amp: "&",
};
/** Texte d'un titre, balises retirées et entités courantes décodées (DOMPurify écrit &nbsp;). */
function texteDuTitre(brut: string): string {
  return brut
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (m, dec, hex, nom) => {
      if (dec) return String.fromCodePoint(Number(dec));
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      return ENTITES[String(nom).toLowerCase()] ?? m;
    })
    .replace(/[\u00a0\u202f]/g, " ")
    .trim();
}

function estHorsOption(titre: string): boolean {
  if (DEJA_NUMEROTE.test(titre)) return false;
  if (SANS_AMBIGUITE.test(titre)) return true;
  return (
    AMBIGUS.test(titre) &&
    titre.split(/\s+/).filter((m) => /\p{L}|\d/u.test(m)).length <= MOTS_MAX_NOM_AMBIGU
  );
}

/** Titre déjà numéroté en texte (« 1. Zapier », « 2) Make ») : la CSS ne le numérote pas. */
const DEJA_NUMEROTE = /^\s*\d{1,2}\s*[.)\-–:]/;
const H2 = /<h2((?:\s[^>]*)?)>([\s\S]*?)<\/h2>/gi;
const MIN_OPTIONS = 2;
const MIN_OPTIONS_BANDEAU = 4;

export function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface OptionsParams {
  /** Mot « sur » du « n sur N » (message traduit), posé en `data-sur` pour la CSS. */
  readonly libelleSur: string;
  /** Bandeau « Par où commencer ? » déjà construit (HTML échappé) ; vide = aucun. */
  readonly bandeau: string;
}

/**
 * Marque les `<h2>` d'option (`data-option="auto"` : numéroté par la CSS ; `"texte"` : déjà
 * numéroté dans le titre) et insère le bandeau entre les deux moitiés de la liste. Sous deux
 * options, rien n'est touché (`total: 0`).
 */
export function marquerOptions(
  html: string,
  params: OptionsParams,
): { html: string; total: number } {
  if (!html) return { html, total: 0 };
  const titres = [...html.matchAll(H2)].map((m) => ({
    debut: m.index ?? 0,
    fin: (m.index ?? 0) + m[0].length,
    attrs: m[1] ?? "",
    texte: texteDuTitre(m[2] ?? ""),
  }));
  const choisis = titres.filter((t) => !estHorsOption(t.texte));
  if (choisis.length < MIN_OPTIONS) return { html, total: 0 };

  const numerotesAMain = choisis.some((t) => DEJA_NUMEROTE.test(t.texte));
  const milieu = choisis.length >= MIN_OPTIONS_BANDEAU ? Math.floor(choisis.length / 2) : -1;
  let sortie = "";
  let curseur = 0;
  choisis.forEach((t, i) => {
    sortie += html.slice(curseur, t.debut);
    if (i === milieu && params.bandeau) sortie += params.bandeau;
    const mode = numerotesAMain ? "texte" : "auto";
    const sur = mode === "auto" ? ` data-sur="${echapper(params.libelleSur)}"` : "";
    sortie += `<h2${t.attrs} data-option="${mode}"${sur}>${html
      .slice(t.debut, t.fin)
      .replace(/^<h2[^>]*>/i, "")
      .replace(/<\/h2>$/i, "")}</h2>`;
    curseur = t.fin;
  });
  sortie += html.slice(curseur);
  return { html: sortie, total: choisis.length };
}

/** Titre « Tableau récapitulatif », « Tableau de synthèse »… (et rien d'autre), nu. */
const TEXTE_TITRE_TABLEAU =
  /^\s*(?:notre |le |ce )?(?:tableau|r[ée]capitulatif|synth[èe]se)(?:\s+(?:r[ée]capitulatif|de\s+(?:synth[èe]se|comparaison)|comparatif))?\s*[?!.:]?\s*$/iu;
/** `<h2>` court + au plus un `<p>` d'introduction, juste avant le tableau (longueurs bornées). */
const TITRE_AVANT_TABLEAU =
  /<h2((?:\s[^>]*)?)>([^<]{1,160})<\/h2>\s*(?:<p>(?:(?!<\/p>)[\s\S]){0,600}<\/p>\s*)?$/i;
const BALISE_TABLE = /<(\/?)table(?=[\s>/])[^>]*>/gi;
const ENVELOPPE_OUVRANTE =
  /<div\b[^>]*\bclass\s*=\s*["'][^"']*\btable-scroll\b[^"']*["'][^>]*>\s*$/i;
const ENVELOPPE_FERMANTE = /^\s*<\/div>/i;

/**
 * Sépare le premier `<table>` (tableaux imbriqués compris) du reste ; l'enveloppe défilante
 * `.table-scroll` qui l'entoure exactement part avec lui (le gabarit pose la sienne).
 */
export function extrairePremierTableau(
  html: string,
): { tableau: string; reste: string; titreRetire: string | null } | null {
  if (!html) return null;
  let profondeur = 0;
  let debut = -1;
  let fin = -1;
  for (const m of html.matchAll(BALISE_TABLE)) {
    if (m[1] === "") {
      if (profondeur === 0) debut = m.index ?? 0;
      profondeur += 1;
    } else if (profondeur > 0) {
      profondeur -= 1;
      if (profondeur === 0) {
        fin = (m.index ?? 0) + m[0].length;
        break;
      }
    }
  }
  if (debut < 0 || fin < 0) return null;
  let avant = html.slice(0, debut);
  let apres = html.slice(fin);
  const ouv = ENVELOPPE_OUVRANTE.exec(avant);
  const fer = ENVELOPPE_FERMANTE.exec(apres);
  if (ouv && fer) {
    avant = avant.slice(0, ouv.index);
    apres = apres.slice(fer[0].length);
  }
  // Le titre d'origine du tableau (« Tableau récapitulatif », avec son éventuelle phrase
  // d'introduction) part avec lui : ni section vide ni doublon au sommaire.
  const trouve = TITRE_AVANT_TABLEAU.exec(avant);
  const titre =
    trouve &&
    TEXTE_TITRE_TABLEAU.test(texteDuTitre(trouve[2] ?? "")) &&
    !/\bdata-option\b/.test(trouve[1] ?? "")
      ? trouve
      : null;
  let titreRetire: string | null = null;
  if (titre) {
    avant = avant.slice(0, titre.index);
    titreRetire =
      /\bid\s*=\s*(?:"([^"]*)"|'([^']*)')/i
        .exec(titre[1] ?? "")
        ?.slice(1, 3)
        .find(Boolean) ?? null;
  }
  return { tableau: html.slice(debut, fin), reste: avant + apres, titreRetire };
}

/** Première ancre libre : ni dans le sommaire, ni en `id` du corps (celui du titre `-titre` compris). */
export function ancreLibre(
  base: string,
  html: string | null,
  pris: ReadonlyArray<{ readonly anchor: string }>,
): string {
  const corps = html ?? "";
  const utilisee = (a: string) =>
    pris.some((i) => i.anchor === a) || corps.includes(`id="${a}"`) || corps.includes(`id='${a}'`);
  let n = 1;
  let ancre = base;
  while (utilisee(ancre) || utilisee(`${ancre}-titre`)) {
    n += 1;
    ancre = `${base}-${n}`;
  }
  return ancre;
}
