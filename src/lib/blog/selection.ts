/**
 * Gabarit « Sélection (top X) » : fonctions pures, côté serveur, sur le HTML déjà assaini de
 * l'article. Aucune donnée n'est inventée : une option est un `<h2>` du corps qui n'est ni
 * une FAQ, ni des sources, ni une conclusion ; le numéro est un compteur CSS ; le tableau de
 * synthèse est celui de l'article, déplacé en fin de corps.
 */

/** Titres de section qui ne sont PAS une option de la liste. */
const HORS_OPTION =
  /\b(?:faq|questions?|sources?|m[ée]thode|conclusion|en bref|r[ée]sum[ée]|tableau|crit[èe]res?|par o[ùu] commencer|pour aller plus loin|pour finir|pourquoi|comment (?:nous|on)|notre (?:m[ée]thode|lecture))\b/i;
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
    texte: (m[2] ?? "").replace(/<[^>]*>/g, "").trim(),
  }));
  const choisis = titres.filter((t) => !HORS_OPTION.test(t.texte));
  if (choisis.length < MIN_OPTIONS) return { html, total: 0 };

  const milieu = choisis.length >= MIN_OPTIONS_BANDEAU ? Math.floor(choisis.length / 2) : -1;
  let sortie = "";
  let curseur = 0;
  choisis.forEach((t, i) => {
    sortie += html.slice(curseur, t.debut);
    if (i === milieu && params.bandeau) sortie += params.bandeau;
    const mode = DEJA_NUMEROTE.test(t.texte) ? "texte" : "auto";
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

const BALISE_TABLE = /<(\/?)table(?=[\s>/])[^>]*>/gi;
const ENVELOPPE_OUVRANTE =
  /<div\b[^>]*\bclass\s*=\s*["'][^"']*\btable-scroll\b[^"']*["'][^>]*>\s*$/i;
const ENVELOPPE_FERMANTE = /^\s*<\/div>/i;

/**
 * Sépare le premier `<table>` (tableaux imbriqués compris) du reste ; l'enveloppe défilante
 * `.table-scroll` qui l'entoure exactement part avec lui (le gabarit pose la sienne).
 */
export function extrairePremierTableau(html: string): { tableau: string; reste: string } | null {
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
  return { tableau: html.slice(debut, fin), reste: avant + apres };
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
