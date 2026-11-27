/**
 * Bloc « Termes du glossaire » d'une page d'offre ou d'un guide (V2-12).
 *
 * Composant serveur, aucun JavaScript client : des liens `<a>` simples vers les fiches
 * `/fr/glossaire/<terme>`, avec un texte d'ancre descriptif. Il ne rend rien hors locale FR
 * (jamais de lien `/en`) ni sans terme.
 */

import type { GlossaryTermExtended } from "@/content/glossary-extension";

interface Props {
  locale: string;
  termes: readonly GlossaryTermExtended[];
  titre?: string;
  className?: string;
}

export function TermesGlossaireLies({
  locale,
  termes,
  titre = "Les mots clés de cette page, expliqués simplement",
  className,
}: Props) {
  if (locale !== "fr" || termes.length === 0) return null;
  return (
    <aside
      aria-labelledby="termes-glossaire-titre"
      data-maillage="glossaire"
      className={className ?? "border-border border-t py-10"}
    >
      <div className="mx-auto max-w-3xl px-4">
        <h2 id="termes-glossaire-titre" className="text-fg text-lg font-semibold">
          {titre}
        </h2>
        <ul className="mt-4 space-y-2">
          {termes.map((t) => (
            <li key={t.slug}>
              <a
                href={`/${locale}/glossaire/${t.slug}`}
                className="text-primary text-base underline underline-offset-4"
              >
                {t.term}
                {" "}: définition simple et exemple
              </a>
            </li>
          ))}
        </ul>
        <p className="text-fg-soft mt-4 text-sm">
          <a href={`/${locale}/glossaire`} className="underline underline-offset-4">
            Voir tout le glossaire de l’IA en entreprise
          </a>
        </p>
      </div>
    </aside>
  );
}
