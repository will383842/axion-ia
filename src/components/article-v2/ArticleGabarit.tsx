/**
 * Squelette des nouveaux gabarits d'articles de blog (PR S1 du chantier
 * « gabarits d'articles »). Composant SERVEUR, aucun JavaScript client.
 *
 * Rend un conteneur `data-gabarit="<code>"` avec les composants EXISTANTS dans
 * l'ordre de lecture du PLAN §4. Pas encore de design : S2 (composants, jetons,
 * feuilles) et G1…G8 (un gabarit chacune) viennent le remplacer.
 *
 * Reçoit le HTML et la table des matières BRUTS (tels que `buildToc` les a
 * produits) : le gabarit construira lui-même son sommaire.
 *
 * Le conteneur est un `<div>` et non un `<main>` : le landmark `main` et la
 * cible du skip-link sont portés par le layout (en poser un second dupliquerait
 * le landmark).
 */
import { useTranslations } from "next-intl";
import { CHEMIN_JOURNEE_IA } from "@/content/journee-ia-commun";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AnswerCard } from "@/components/marketing/AnswerCard";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { ArticleTOC, type TocItem } from "@/components/seo/ArticleTOC";
import { AuthorByline } from "@/components/knowledge/public/AuthorByline";
import { QualiopiContentBadge } from "@/components/qualiopi/QualiopiContentBadge";
import { ArticleFaq } from "@/components/content-gen/ArticleFaq";
import { ArticleSources } from "@/components/content-gen/ArticleSources";
import { ArticleKeyTakeaway } from "@/components/content-gen/ArticleKeyTakeaway";
import { ArticleExpertQuote } from "@/components/content-gen/ArticleExpertQuote";
import { ArticleShareBar } from "@/components/content-gen/ArticleShareBar";
import { ArticleTransparencyBlock } from "@/components/content-gen/ArticleTransparencyBlock";
import { ArticlePrevNext } from "@/components/content-gen/ArticlePrevNext";
import { ArticlePeopleAlsoAsk } from "@/components/content-gen/ArticlePeopleAlsoAsk";
import { ArticleNewsletterInline } from "@/components/content-gen/ArticleNewsletterInline";
import { EncartEnVideo } from "@/components/videos/EncartEnVideo";
import { SuggestedContent } from "@/components/suggested/SuggestedContent";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import type { GabaritArticle } from "@/server/content-gen/blog/gabarits";
import type { BlogArticleView } from "@/server/content-gen/blog/loader";
import type { getManonByline } from "@/lib/seo/manon-person";
import Image from "next/image";

type ProprietesCommunes<T> = T extends (props: infer P) => unknown ? P : never;

/** Bloc de corps d'un article en fichier (prose brute, hors HTML). */
export type BlocCorps =
  | { readonly kind: "ol"; readonly items: ReadonlyArray<string> }
  | { readonly kind: "p"; readonly text: string };

export interface ArticleGabaritProps {
  readonly gabarit: GabaritArticle;
  readonly view: BlogArticleView;
  readonly locale: Locale;
  /** HTML du corps (article en base), brut : sanitisé, ancres des H2 posées. */
  readonly html: string | null;
  /** Corps d'un article en fichier, quand `html` est null. */
  readonly blocs: ReadonlyArray<BlocCorps> | null;
  /** Table des matières brute (H2 posés par `buildToc`, ou extraction FS). */
  readonly tocItems: ReadonlyArray<TocItem>;
  readonly pageUrl: string;
  readonly chapo: string | null;
  readonly titre: { readonly lead: string; readonly em?: string | undefined };
  readonly tldr: string | null;
  readonly filAriane: ReadonlyArray<{ readonly href: string; readonly label: string }>;
  readonly auteurHref: string;
  readonly bylineManon: Awaited<ReturnType<typeof getManonByline>>;
  readonly emettreJsonLdAuteur: boolean;
  readonly sourcesVerifiees: Date | null;
  readonly villeAncree: { readonly href: string; readonly nom: string } | null;
  readonly precedentSuivant: ProprietesCommunes<typeof ArticlePrevNext>["prev"] extends infer P
    ? { readonly prev: P; readonly next: P }
    : never;
  readonly questionsAssociees: ProprietesCommunes<typeof ArticlePeopleAlsoAsk>["items"];
  readonly suggestions: ProprietesCommunes<typeof SuggestedContent> extends { items: infer I }
    ? I
    : never;
  readonly themeEncart: ProprietesCommunes<typeof EncartEnVideo>["theme"] | null;
  /** Nœuds JSON-LD déjà calculés par la page (identiques à ceux de la V1). */
  readonly jsonLd: ReadonlyArray<object>;
}

export function ArticleGabarit(p: ArticleGabaritProps) {
  const t = useTranslations("articleV2");
  const { view, locale: loc } = p;
  const avecSommaire = p.tocItems.length >= 2;

  return (
    <div data-gabarit={p.gabarit}>
      <link
        rel="alternate"
        type="text/markdown"
        href={`/api/markdown/blog/${view.slug}`}
        title={`${view.title} (markdown)`}
      />
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={[...p.filAriane]} />
      </Container>

      <Section
        titleAs="h1"
        eyebrow={view.category}
        title={p.titre.lead}
        titleEm={p.titre.em}
        description={p.chapo || undefined}
        media={
          view.featuredImage ? (
            <figure className="m-0">
              <div className="border-border/60 shadow-card relative aspect-[16/10] w-full overflow-hidden rounded-2xl border">
                <Image
                  src={view.featuredImage}
                  alt={view.featuredImageAlt ?? view.title}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="object-cover"
                />
              </div>
              <UnsplashCredit
                photographerName={view.photographerName}
                photographerUrl={view.photographerUrl}
              />
            </figure>
          ) : undefined
        }
      >
        <Container className="text-fg-muted mt-8 flex flex-wrap items-center gap-3 text-sm">
          <Link
            href={p.auteurHref as never}
            className="hover:text-terracotta-deep focus-visible:ring-terracotta rounded-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {t("by")} {view.author}
          </Link>
          <span aria-hidden="true">·</span>
          <time dateTime={view.publishedAt} className="tabular-nums">
            {t("publishedOn")} {view.publishedAt}
          </time>
          {view.updatedAt && view.updatedAt !== view.publishedAt ? (
            <>
              <span aria-hidden="true">·</span>
              <span>
                {t("updatedOn")}{" "}
                <time dateTime={view.updatedAt} className="tabular-nums">
                  {view.updatedAt}
                </time>
              </span>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <span>{view.readingTime}</span>
        </Container>
      </Section>

      <Container
        className={avecSommaire ? "lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12" : ""}
      >
        <div className="lg:col-start-1 lg:row-start-1">
          {avecSommaire ? (
            <ArticleTOC items={[...p.tocItems]} pageUrl={p.pageUrl} locale={loc} />
          ) : null}
        </div>

        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          {p.tldr ? (
            <Section spacing="compact">
              <Container className="max-w-3xl">
                <AnswerCard locale={loc}>{p.tldr}</AnswerCard>
              </Container>
            </Section>
          ) : null}

          <ArticleKeyTakeaway text={view.keyTakeaway} locale={loc} />

          <article>
            <Section spacing="compact">
              <Container className="text-fg max-w-[52rem] space-y-6 text-lg leading-relaxed">
                {p.html ? (
                  <div
                    className="prose prose-axionia max-w-none"
                    dangerouslySetInnerHTML={{ __html: p.html }}
                  />
                ) : (
                  (p.blocs ?? []).map((bloc, idx) =>
                    bloc.kind === "ol" ? (
                      <ol
                        key={`b-${idx}`}
                        className="text-fg marker:text-terracotta list-decimal space-y-3 pl-6 marker:font-semibold"
                      >
                        {bloc.items.map((it, j) => (
                          <li key={`i-${j}`} className="pl-1">
                            {it}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p key={`b-${idx}`}>{bloc.text}</p>
                    ),
                  )
                )}
              </Container>
            </Section>
          </article>

          <ArticleExpertQuote quote={view.expertQuote} locale={loc} />

          <ArticleFaq
            items={view.faqItems}
            locale={loc}
            dateModified={view.updatedAt ?? view.publishedAt}
          />

          <ArticleSources
            items={view.citations}
            locale={loc}
            lastVerified={p.sourcesVerifiees ? p.sourcesVerifiees.toISOString().slice(0, 10) : null}
          />
          <ArticleTransparencyBlock
            lastVerified={p.sourcesVerifiees}
            updateCycleDays={90}
            locale={loc}
          />

          <Section spacing="compact">
            <Container className="max-w-[52rem]">
              <AuthorByline
                authorName={view.author}
                authorSlug={view.author.toLowerCase()}
                {...(p.bylineManon
                  ? { authorAvatarUrl: p.bylineManon.avatarUrl, authorBio: p.bylineManon.bio }
                  : {})}
                publishedAt={view.publishedAt ? new Date(view.publishedAt) : null}
                emitJsonLd={p.emettreJsonLdAuteur}
                locale={loc}
              />
            </Container>
          </Section>

          <Section spacing="compact">
            <Container className="max-w-[52rem]">
              <QualiopiContentBadge locale={loc} />
            </Container>
          </Section>

          <Section spacing="compact">
            <Container className="max-w-3xl">
              <AiContentDisclaimer locale={loc} />
            </Container>
          </Section>

          <ArticleShareBar url={p.pageUrl} title={view.title} locale={loc} />

          {p.villeAncree ? (
            <Section spacing="compact">
              <Container className="max-w-3xl">
                <p className="text-fg-muted text-sm">
                  {t("cityPrefix")}
                  <Link
                    href={p.villeAncree.href as never}
                    className="text-primary font-medium hover:underline"
                  >
                    {t("cityLink", { ville: p.villeAncree.nom })}
                  </Link>
                  {t("citySuffix")}
                </p>
              </Container>
            </Section>
          ) : null}

          <ArticlePeopleAlsoAsk items={p.questionsAssociees} locale={loc} />
        </div>
      </Container>

      <SuggestedContent
        variant="articles"
        items={p.suggestions}
        eyebrow={t("relatedEyebrow")}
        title={t("relatedTitle")}
        tone="sand"
        emitJsonLd
      />

      <ArticlePrevNext prev={p.precedentSuivant.prev} next={p.precedentSuivant.next} locale={loc} />

      {p.themeEncart ? <EncartEnVideo theme={p.themeEncart} /> : null}

      <ArticleNewsletterInline locale={loc} source="blog-fin-article" />

      <CtaBlock
        spacing="compact"
        title={t("ctaTitle")}
        description={t("ctaDescription")}
        cta={
          <Cta href={CHEMIN_JOURNEE_IA} size="lg">
            {t("ctaButton")} →
          </Cta>
        }
        tone="dark"
      />

      {p.jsonLd.map((noeud, i) => (
        <JsonLd key={i} data={noeud as never} />
      ))}
    </div>
  );
}
