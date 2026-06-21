// KB-10 — Bloc auteur E-E-A-T (server component SSR pur).
//
// Affiche avatar + nom + bio courte + date publication + date lastReviewedAt
// jamais cachée. Schema Person JSON-LD intégré.

import { JsonLd } from "@/components/marketing/JsonLd";
import { SITE_URL } from "@/lib/seo";

export interface AuthorBylineProps {
  readonly authorName: string;
  readonly authorSlug?: string | null;
  readonly authorAvatarUrl?: string | null;
  readonly authorBio?: string | null;
  readonly authorLinkedinUrl?: string | null;
  readonly publishedAt: Date | null;
  readonly lastReviewedAt?: Date | null;
  readonly factChecked?: boolean;
  readonly locale: "fr" | "en";
  /**
   * Émet le nœud Person JSON-LD de la byline. Défaut `true` (rétro-compat).
   * Passer `false` sur les pages qui co-émettent DÉJÀ un Person riche
   * (`getManonPersonJsonLd`) pour éviter un nœud Person en double.
   */
  readonly emitJsonLd?: boolean;
}

export function AuthorByline(props: AuthorBylineProps) {
  const {
    authorName,
    authorSlug,
    authorAvatarUrl,
    authorBio,
    authorLinkedinUrl,
    publishedAt,
    lastReviewedAt,
    factChecked,
    locale,
    emitJsonLd = true,
  } = props;
  const isFr = locale === "fr";

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: authorName,
    ...(authorAvatarUrl ? { image: authorAvatarUrl } : {}),
    ...(authorBio ? { description: authorBio } : {}),
    ...(authorLinkedinUrl ? { sameAs: [authorLinkedinUrl] } : {}),
    ...(authorSlug ? { url: `${SITE_URL}/${locale}/equipe/${authorSlug}` } : {}),
  };

  return (
    <aside className="border-border my-6 flex flex-wrap items-start gap-3 rounded border p-4">
      {authorAvatarUrl ? (
        // Sprint Final P1-6 (audit 2026-05-22) — `<img>` conservé car
        // `authorAvatarUrl` est une URL remote arbitraire (DB) et
        // `next.config.ts` `images.remotePatterns: []` n'autorise pas
        // l'optimizer next/image dessus. Ajout `loading="lazy"` +
        // `decoding="async"` pour éviter blocage main-thread + lazy off-fold.
        // CLS déjà mitigé par width/height fixés.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={authorAvatarUrl}
          alt={isFr ? `Portrait de ${authorName}` : `Portrait of ${authorName}`}
          width={56}
          height={56}
          loading="lazy"
          decoding="async"
          className="rounded-full"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-fg text-sm font-semibold">{authorName}</p>
        {authorBio ? <p className="text-fg-soft text-sm leading-snug">{authorBio}</p> : null}
        <p className="text-fg-soft mt-2 text-xs">
          {publishedAt ? (
            <>
              {isFr ? "Publié le " : "Published "}
              <time dateTime={publishedAt.toISOString()}>
                {publishedAt.toISOString().slice(0, 10)}
              </time>
            </>
          ) : null}
          {lastReviewedAt ? (
            <>
              {publishedAt ? " · " : ""}
              {isFr ? "Dernière revue " : "Last reviewed "}
              <time dateTime={lastReviewedAt.toISOString()}>
                {lastReviewedAt.toISOString().slice(0, 10)}
              </time>
            </>
          ) : null}
          {factChecked ? (
            <span className="bg-primary/10 text-primary ml-2 rounded px-1.5 py-0.5 text-xs font-medium">
              ✓ {isFr ? "Vérifié" : "Fact-checked"}
            </span>
          ) : null}
        </p>
      </div>
      {emitJsonLd ? <JsonLd data={personJsonLd} /> : null}
    </aside>
  );
}
