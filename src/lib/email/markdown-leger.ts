/**
 * La GRAMMAIRE du markdown léger — partie pure, sans aucune dépendance.
 *
 * ## Pourquoi elle est séparée du rendu
 *
 * Les mêmes trois règles servent à TROIS endroits :
 *   · le gabarit d'e-mail, qui rend ce qui part (React Email) ;
 *   · le gabarit de réponse au candidat, idem ;
 *   · le composeur de la console, qui montre à l'écran ce qui partira.
 *
 * Le composeur est un composant CLIENT. S'il importait le rendu React Email, il
 * tirerait `@react-email/components` dans le bundle de la console pour afficher
 * trois marques de mise en forme. Ce fichier ne contient donc que des fonctions
 * pures — pas un seul import — et chaque surface y branche son propre rendu.
 *
 * ## Ce qu'elle ne fait pas, volontairement
 *
 * Aucun moteur Markdown complet. Le besoin est un texte écrit à la main par une
 * personne qui répond à quelqu'un : trois marques suffisent, et une
 * bibliothèque ouvrirait la porte à des constructions (tableaux, images, HTML
 * brut) que personne ne relit avant l'envoi.
 */

export type FragmentMarkdown =
  | { readonly type: "texte"; readonly valeur: string }
  | { readonly type: "gras"; readonly valeur: string }
  | { readonly type: "italique"; readonly valeur: string }
  | { readonly type: "lien"; readonly valeur: string; readonly href: string };

/** Découpe un texte en paragraphes — une ligne vide les sépare. */
export function paragraphes(texte: string): string[] {
  return texte.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
}

/**
 * Applique une marque à la portion encore brute des fragments.
 *
 * 🔑 On ne rebalaie JAMAIS un fragment déjà transformé : sans cette précaution,
 * une URL contenant une astérisque verrait son lien re-découpé en italique, et
 * le lien partirait cassé.
 */
function appliquer(
  fragments: readonly FragmentMarkdown[],
  motif: RegExp,
  fabriquer: (m: RegExpExecArray) => FragmentMarkdown,
): FragmentMarkdown[] {
  const sortie: FragmentMarkdown[] = [];
  for (const fragment of fragments) {
    if (fragment.type !== "texte") {
      sortie.push(fragment);
      continue;
    }
    let curseur = 0;
    let trouve: RegExpExecArray | null;
    motif.lastIndex = 0;
    while ((trouve = motif.exec(fragment.valeur)) !== null) {
      if (trouve.index > curseur) {
        sortie.push({ type: "texte", valeur: fragment.valeur.slice(curseur, trouve.index) });
      }
      sortie.push(fabriquer(trouve));
      curseur = trouve.index + trouve[0].length;
    }
    if (curseur < fragment.valeur.length) {
      sortie.push({ type: "texte", valeur: fragment.valeur.slice(curseur) });
    }
  }
  return sortie;
}

/** Découpe un paragraphe en fragments typés. Fonction PURE, testable seule. */
export function fragmenter(paragraphe: string): FragmentMarkdown[] {
  let fragments: FragmentMarkdown[] = [{ type: "texte", valeur: paragraphe }];
  // L'ORDRE compte : les liens d'abord, sinon un libellé en gras à l'intérieur
  // d'un lien serait découpé avant que le lien ne soit reconnu.
  fragments = appliquer(fragments, /\[([^\]]+)\]\(([^)]+)\)/g, (m) => ({
    type: "lien",
    valeur: m[1] ?? "",
    href: m[2] ?? "",
  }));
  fragments = appliquer(fragments, /\*\*([^*]+)\*\*/g, (m) => ({
    type: "gras",
    valeur: m[1] ?? "",
  }));
  fragments = appliquer(fragments, /(?<!\*)\*([^*]+)\*(?!\*)/g, (m) => ({
    type: "italique",
    valeur: m[1] ?? "",
  }));
  return fragments;
}

/**
 * Pré-en-tête DÉRIVÉ du début du message.
 *
 * 🔑 Le référentiel (§3.5) interdit de recopier l'objet : la messagerie
 * afficherait deux fois la même phrase et le deuxième élément d'accroche serait
 * perdu. Quand l'objet est SAISI par un humain, le début du corps est la seule
 * autre source disponible — et c'est exactement ce que le référentiel demande :
 * prolonger, pas répéter.
 *
 * Les marques Markdown sont retirées (sinon le pré-en-tête afficherait des
 * astérisques), et un repli couvre le corps vide — un pré-en-tête vide laisse la
 * messagerie afficher le début du HTML à la place.
 */
export function preEnTeteDepuisCorps(corps: string, repli: string): string {
  const premier = paragraphes(corps)[0] ?? "";
  return (
    premier
      .replace(/[*_`#>[\]()]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 110) || repli
  );
}
