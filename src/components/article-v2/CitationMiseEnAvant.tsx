interface CitationMiseEnAvantProps {
  readonly texte: string;
  /** Auteur réel et cité : sans lui la citation n'est pas rendue (jamais de citation anonyme). */
  readonly auteur: string | null | undefined;
  readonly fonction?: string | null;
}

/** Citation géante (`.citation`) : `figure > blockquote` + `figcaption`. */
export function CitationMiseEnAvant({ texte, auteur, fonction }: CitationMiseEnAvantProps) {
  if (!auteur || !texte) return null;
  return (
    <figure className="citation">
      <blockquote>
        <p>{texte}</p>
      </blockquote>
      <figcaption>
        {auteur}
        {fonction ? `, ${fonction}` : null}
      </figcaption>
    </figure>
  );
}
