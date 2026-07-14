// Nettoyage best-effort du texte extrait d'un PDF de communiqué (2026-07-14).
//
// Un communiqué PDF s'affiche désormais via le VIEWER EMBARQUÉ sur la page
// détail (fidèle au design). Ce module ne sert donc plus à l'affichage principal
// mais à deux usages « en coulisse » :
//   1. `articleBody` du JSON-LD NewsArticle (signal SEO/AEO non visible) —
//      on nettoie le letterhead letter-spacé pour ne pas envoyer « F O R M A T
//      I O N » à Google.
//   2. Fallback d'affichage des communiqués LEGACY sans PDF (fixtures texte).
//
// Limite assumée : linéariser un PDF designé multi-colonnes reste imparfait
// (numéros de section, pieds de page, notes peuvent fuir). C'est pourquoi la
// page détail privilégie le PDF embarqué quand il existe.

const LETTERSPACE_RUN_MIN = 5;

/** Un token « letter-spacé » = 1-2 caractères (lettre / ponctuation de letterhead). */
function isShortToken(token: string): boolean {
  return token.length > 0 && token.length <= 2 && /^[\p{L}&,.·]{1,2}$/u.test(token);
}

/**
 * Supprime les runs de letter-spacing (« F O R M A T I O N … » = letterhead
 * illisible) : ≥ LETTERSPACE_RUN_MIN tokens courts consécutifs. Les mots normaux
 * (≥ 3 caractères) et les rares lettres isolées de la prose (à, y, l') ne sont
 * jamais touchés (run trop court).
 */
function stripLetterSpacedRuns(text: string): string {
  const words = text.split(" ");
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    let j = i;
    while (j < words.length && isShortToken(words[j] ?? "")) j++;
    if (j - i >= LETTERSPACE_RUN_MIN) {
      i = j; // run letter-spacé → supprimé
    } else {
      out.push(words[i] ?? "");
      i += 1;
    }
  }
  return out.join(" ");
}

/**
 * Normalise le texte extrait d'un PDF en paragraphes lisibles. Retire le
 * letterhead letter-spacé, recolle les césures, puis segmente par phrases en
 * paragraphes de ~420 caractères (le texte extrait n'a souvent AUCUN saut de
 * ligne → sans ça, tout arrive en un seul bloc).
 */
export function formatPressReleaseBody(raw: string): string[] {
  if (!raw) return [];

  let text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    // Césure de fin de ligne : « déve-\nloppement » → « développement ».
    .replace(/([A-Za-zÀ-ÿ])-\n([A-Za-zÀ-ÿ])/g, "$1$2");

  text = stripLetterSpacedRuns(text)
    .replace(/[ \t]+/g, " ")
    .trim();

  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.replace(/\n/g, " ").trim())
    .filter(Boolean);

  const paragraphs: string[] = [];
  for (const block of blocks) {
    if (block.length <= 480) {
      paragraphs.push(block);
      continue;
    }
    // Découpe par phrase, regroupée en paragraphes de ~420 caractères.
    const sentences = block.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [block];
    let current = "";
    for (const sentence of sentences) {
      if (current && current.length + sentence.length > 420) {
        paragraphs.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current.trim()) paragraphs.push(current.trim());
  }

  return paragraphs.filter((p) => p.length > 1);
}
