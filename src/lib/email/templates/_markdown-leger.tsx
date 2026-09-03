/**
 * Rendu du MARKDOWN LÉGER des messages écrits à la main dans la console.
 *
 * ## Pourquoi ce fichier existe
 *
 * Les mêmes trois règles — paragraphes séparés par une ligne vide, `**gras**`,
 * `*italique*`, `[libellé](url)` — étaient écrites DEUX fois : dans le gabarit
 * `submission-reply.tsx` (rendu envoyé) et dans `ReplyComposer.tsx` (aperçu à
 * l'écran). Deux implémentations d'une même grammaire divergent : le jour où
 * l'une apprend une syntaxe que l'autre ignore, l'aperçu cesse de montrer ce
 * qui part.
 *
 * Le lot 1 du chantier recrutement en réclamait une troisième. C'était le bon
 * moment pour n'en garder qu'une.
 *
 * ## Ce qu'il ne fait pas, volontairement
 *
 * Aucune dépendance à un moteur Markdown. Le besoin est un texte écrit à la
 * main par une personne qui répond à quelqu'un : trois marques suffisent, et
 * une bibliothèque complète ouvrirait la porte à des constructions (tableaux,
 * images, HTML brut) que personne ne relit avant l'envoi.
 */

import { emailStyles } from "./_layout";

type Fragment =
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
  fragments: readonly Fragment[],
  motif: RegExp,
  fabriquer: (m: RegExpExecArray) => Fragment,
): Fragment[] {
  const sortie: Fragment[] = [];
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

/** Découpe un paragraphe en fragments typés. Pur : aucun rendu, testable seul. */
export function fragmenter(paragraphe: string): Fragment[] {
  let fragments: Fragment[] = [{ type: "texte", valeur: paragraphe }];
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

/** Rend un paragraphe de markdown léger en arbre React, pour un e-mail. */
export function rendreParagraphe(paragraphe: string): React.ReactNode {
  return fragmenter(paragraphe).map((fragment, i) => {
    if (fragment.type === "gras") return <strong key={i}>{fragment.valeur}</strong>;
    if (fragment.type === "italique") return <em key={i}>{fragment.valeur}</em>;
    if (fragment.type === "lien") {
      return (
        <a
          key={i}
          href={fragment.href}
          style={{ color: emailStyles.COLORS.accent, textDecoration: "underline" }}
        >
          {fragment.valeur}
        </a>
      );
    }
    return <span key={i}>{fragment.valeur}</span>;
  });
}

/**
 * Pré-en-tête DÉRIVÉ du début du message.
 *
 * 🔑 Le référentiel (§3.5) interdit de recopier l'objet : Gmail afficherait
 * deux fois la même phrase et le deuxième élément d'accroche serait perdu. Quand
 * l'objet est SAISI par un humain, le début du corps est la seule autre source
 * disponible — et c'est exactement ce que le référentiel demande : prolonger,
 * pas répéter.
 *
 * Les marques Markdown sont retirées (sinon le pré-en-tête afficherait des
 * astérisques), et un repli couvre le corps vide — un pré-en-tête vide laisse
 * Gmail afficher le début du HTML à la place.
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
