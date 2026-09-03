/**
 * Rendu React Email du markdown léger.
 *
 * La GRAMMAIRE vit dans `src/lib/email/markdown-leger.ts` — pure, sans import,
 * partagée avec le composeur de la console qui est un composant CLIENT et ne
 * doit pas tirer `@react-email/components` dans son bundle pour afficher trois
 * marques de mise en forme.
 *
 * Ce fichier ne fait qu'une chose : donner une apparence aux fragments.
 */

import { emailStyles } from "./_layout";
import { fragmenter } from "../markdown-leger";

// Réexportés pour que les gabarits n'aient qu'un seul import à faire.
export { paragraphes, preEnTeteDepuisCorps } from "../markdown-leger";

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
