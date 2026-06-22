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

  const linkClass =
    "border-border text-fg-soft hover:border-terracotta hover:text-terracotta inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors";

  return (
    <Section>
      <Container className="max-w-3xl">
        <nav
          data-aeo="share-bar"
          aria-label={isFr ? "Partager cet article" : "Share this article"}
          className="flex flex-wrap items-center gap-2"
        >
          <span className="text-fg-muted mr-1 text-sm font-semibold">
            {isFr ? "Partager" : "Share"}
          </span>

          <a
            href={xHref}
            target="_blank"
            rel="noopener noreferrer nofollow"
            aria-label={isFr ? "Partager sur X (Twitter)" : "Share on X (Twitter)"}
            className={linkClass}
          >
            <span aria-hidden="true" className="font-semibold">
              𝕏
            </span>
            <span>X</span>
          </a>

          <a
            href={linkedInHref}
            target="_blank"
            rel="noopener noreferrer nofollow"
            aria-label={isFr ? "Partager sur LinkedIn" : "Share on LinkedIn"}
            className={linkClass}
          >
            <span aria-hidden="true" className="font-semibold">
              in
            </span>
            <span>LinkedIn</span>
          </a>

          <a
            href={mailHref}
            aria-label={isFr ? "Partager par e-mail" : "Share by email"}
            className={linkClass}
          >
            <span aria-hidden="true">✉</span>
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
