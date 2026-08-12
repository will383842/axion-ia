interface Credit {
  readonly photographer: string;
  readonly photographerUrl: string;
}

interface Props {
  credits: readonly Credit[];
  className?: string;
}

/**
 * Attribution groupée — même obligation CGU que <UnsplashCredit>, mais pour une
 * GRILLE de visuels.
 *
 * Une ligne de crédit par carte alourdirait six cartes de trois lignes de texte
 * gris chacune ; l'attribution est donc rendue une fois sous la grille, chaque
 * photographe restant nommé et lié individuellement — ce que les CGU exigent.
 * Les doublons sont fusionnés (un même photographe peut fournir deux visuels).
 *
 * ⚠️ Retirer ce composant sans retirer les photos = violation des CGU Unsplash.
 */
export function UnsplashCreditList({ credits, className }: Props) {
  const unique = credits.filter(
    (c, i) => c.photographer && credits.findIndex((o) => o.photographer === c.photographer) === i,
  );
  if (unique.length === 0) return null;

  return (
    <p className={`text-fg-muted mt-6 text-xs ${className ?? ""}`}>
      Photos :{" "}
      {unique.map((c, i) => (
        <span key={c.photographer}>
          {i > 0 ? ", " : ""}
          <a
            href={`${c.photographerUrl}?utm_source=axion-ia&utm_medium=referral`}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="hover:text-fg underline underline-offset-2 transition-colors"
          >
            {c.photographer}
          </a>
        </span>
      ))}{" "}
      sur{" "}
      <a
        href="https://unsplash.com/?utm_source=axion-ia&utm_medium=referral"
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="hover:text-fg underline underline-offset-2 transition-colors"
      >
        Unsplash
      </a>
    </p>
  );
}
