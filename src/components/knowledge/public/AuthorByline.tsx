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
    <aside className="border-border bg-paper shadow-subtle my-6 flex flex-wrap items-start gap-4 rounded-2xl border p-5 md:p-6">
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
          width={64}
          height={64}
          loading="lazy"
          decoding="async"
          className="ring-border h-16 w-16 shrink-0 rounded-full object-cover ring-1"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-fg-muted text-[11px] font-semibold tracking-[0.16em] uppercase">
          {isFr ? "Auteur" : "Author"}
        </p>
        <p
          className="text-fg mt-1 text-lg leading-tight font-semibold"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {authorName}
        </p>
        {authorBio ? (
          <p className="text-fg-soft mt-1.5 text-sm leading-relaxed">{authorBio}</p>
        ) : null}
        <p className="text-fg-muted mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {publishedAt ? (
            <span>
              {isFr ? "Publié le " : "Published "}
              <time dateTime={publishedAt.toISOString()} className="tabular-nums">
                {publishedAt.toISOString().slice(0, 10)}
              </time>
            </span>
          ) : null}
          {lastReviewedAt ? (
            <>
              {publishedAt ? <span aria-hidden="true">·</span> : null}
              <span>
                {isFr ? "Dernière revue " : "Last reviewed "}
                <time dateTime={lastReviewedAt.toISOString()} className="tabular-nums">
                  {lastReviewedAt.toISOString().slice(0, 10)}
                </time>
              </span>
            </>
          ) : null}
          {factChecked ? (
            <span className="bg-primary/10 text-primary inline-flex items-center rounded-full px-2 py-0.5 font-medium">
              ✓ {isFr ? "Vérifié" : "Fact-checked"}
            </span>
          ) : null}
        </p>
        {authorLinkedinUrl ? (
          <a
            href={authorLinkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-terracotta-deep mt-2 inline-flex items-center gap-1 text-xs font-medium transition-colors"
          >
            LinkedIn <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </div>
      {emitJsonLd ? <JsonLd data={personJsonLd} /> : null}
    </aside>
  );
}
