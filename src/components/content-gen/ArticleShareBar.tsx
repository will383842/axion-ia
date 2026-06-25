import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import type { Locale } from "@/i18n/routing";
import { CopyLinkButton } from "./CopyLinkButton";

interface ArticleShareBarProps {
  readonly url: string;
  readonly title: string;
  readonly locale: Locale;
}

/**
 * Brique partagée — barre de partage social + « Copier le lien » (chantier
 * templates 2026-06-21).
 *
 * Les liens de partage (X / LinkedIn / e-mail) sont de simples `<a>` rendus
 * côté serveur (0 JS) ; seul le bouton « Copier le lien » est un îlot client
 * minimal (`CopyLinkButton`). Alimenté par l'URL canonique + le titre réels de
 * l'article → ne se rend que si l'URL et le titre sont renseignés (jamais de
 * barre vide → CLS = 0). `data-aeo` = sélecteur d'extraction par bloc autonome.
 */
export function ArticleShareBar({ url, title, locale }: ArticleShareBarProps) {
  const cleanUrl = url?.trim() ?? "";
  const cleanTitle = title?.trim() ?? "";
  if (cleanUrl.length === 0 || cleanTitle.length === 0) return null;

  const isFr = locale === "fr";

  const encodedUrl = encodeURIComponent(cleanUrl);
  const encodedTitle = encodeURIComponent(cleanTitle);

  const xHref = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
  const linkedInHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  const mailHref = `mailto:?subject=${encodedTitle}&body=${encodedTitle}%0A${encodedUrl}`;

  // Pills modernes : icône SVG + libellé, hover de marque (transition douce).
  const base =
    "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors";
  const xClass = `${base} border-border text-fg-soft hover:border-fg hover:bg-fg hover:text-bg`;
  const inClass = `${base} border-border text-fg-soft hover:border-primary hover:bg-primary hover:text-white`;
  const mailClass = `${base} border-border text-fg-soft hover:border-terracotta hover:bg-terracotta hover:text-white`;

  return (
    <Section>
      <Container className="max-w-[52rem]">
        <nav
          data-aeo="share-bar"
          aria-label={isFr ? "Partager cet article" : "Share this article"}
          className="border-border bg-paper flex flex-wrap items-center gap-2.5 rounded-2xl border p-4"
        >
          <span className="text-fg mr-1 inline-flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden="true" className="bg-terracotta h-3.5 w-1 rounded-full" />
            {isFr ? "Partager cet article" : "Share this article"}
          </span>

          <a
            href={xHref}
            target="_blank"
            rel="noopener noreferrer nofollow"
            aria-label={isFr ? "Partager sur X (Twitter)" : "Share on X (Twitter)"}
            className={xClass}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
            </svg>
            <span>X</span>
          </a>

          <a
            href={linkedInHref}
            target="_blank"
            rel="noopener noreferrer nofollow"
            aria-label={isFr ? "Partager sur LinkedIn" : "Share on LinkedIn"}
            className={inClass}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
            </svg>
            <span>LinkedIn</span>
          </a>

          <a
            href={mailHref}
            aria-label={isFr ? "Partager par e-mail" : "Share by email"}
            className={mailClass}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            <span>{isFr ? "E-mail" : "Email"}</span>
          </a>

          <CopyLinkButton
            url={cleanUrl}
            label={isFr ? "Copier le lien" : "Copy link"}
            copiedLabel={isFr ? "Copié !" : "Copied!"}
          />
        </nav>
      </Container>
    </Section>
  );
}
