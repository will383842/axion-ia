interface Props {
  photographerName: string | null | undefined;
  photographerUrl: string | null | undefined;
  className?: string;
}

/**
 * Attribution photographe Unsplash — CGU §6 : citation obligatoire sur toute
 * page commerciale utilisant une photo via l'API Unsplash.
 * Format imposé : "Photo de [Nom] sur Unsplash" avec liens UTM trackés.
 */
export function UnsplashCredit({ photographerName, photographerUrl, className }: Props) {
  if (!photographerName) return null;

  const photographerHref = photographerUrl
    ? `${photographerUrl}?utm_source=axion-ia&utm_medium=referral`
    : `https://unsplash.com/?utm_source=axion-ia&utm_medium=referral`;

  return (
    <p
      className={`text-fg-muted mt-1.5 text-xs ${className ?? ""}`}
      aria-label={`Crédit photo : ${photographerName} sur Unsplash`}
    >
      Photo :{" "}
      <a
        href={photographerHref}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="hover:text-fg underline underline-offset-2 transition-colors"
      >
        {photographerName}
      </a>{" "}
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
