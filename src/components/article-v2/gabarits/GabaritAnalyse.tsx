/**
 * Gabarit « Analyse » (défaut et repli) — mise en page de référence de S2.
 * Les sept autres fichiers de `gabarits/` rendent cette même mise en page tant
 * que leur PR (G2…G8) n'est pas livrée ; chacune ne modifie que SON fichier,
 * sa feuille `src/styles/article-v2/<code>.css` et ses messages.
 *
 * Ordre de lecture = ordre du DOM (PLAN §4) : fil d'Ariane, en-tête, image,
 * réponse directe, point clé, sommaire, corps, citation, FAQ, sources et
 * méthode, carte auteur, badge Qualiopi, mention IA, partage, questions
 * associées, articles liés, précédent/suivant, vidéo, newsletter, CTA.
 */
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AnswerCard } from "@/components/marketing/AnswerCard";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { ArticleTOC } from "@/components/seo/ArticleTOC";
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
import { EnteteArticle } from "../EnteteArticle";
import { HeroImageArticle } from "../HeroImageArticle";
import { MiseEnPageLecture } from "../MiseEnPageLecture";
import { CorpsArticle } from "../CorpsArticle";
import { PiedArticle } from "../PiedArticle";
import { CtaGabarit, type VarianteCta } from "../CtaGabarit";
import type { ArticleGabaritProps } from "../types";

interface MiseEnPageAnalyseProps {
  readonly p: ArticleGabaritProps;
  /** Appel à l'action propre au gabarit (un seul par page). */
  readonly cta: VarianteCta;
}

export function MiseEnPageAnalyse({ p, cta }: MiseEnPageAnalyseProps) {
  const t = useTranslations("articleV2");
  const c = useTranslations("articleGabarits.commun");
  const { view, locale: loc } = p;

  const image = view.featuredImage ? (
    <HeroImageArticle
      src={view.featuredImage}
      alt={view.featuredImageAlt ?? view.title}
      photographerName={view.photographerName}
      photographerUrl={view.photographerUrl}
    />
  ) : undefined;

  const sommaire =
    p.tocItems.length >= 2 ? (
      <ArticleTOC
        items={[...p.tocItems]}
        pageUrl={p.pageUrl}
        locale={loc}
        variante="v2"
        cibleTactile
        libelle={c("sommaire")}
      />
    ) : null;

  return (
    <div data-gabarit={p.gabarit}>
      <div className="reading-progress" aria-hidden="true" />
      <link
        rel="alternate"
        type="text/markdown"
        href={`/api/markdown/blog/${view.slug}`}
        title={`${view.title} (markdown)`}
      />
      <div className="art-wrap">
        <div className="art-crumbs">
          <Breadcrumbs items={[...p.filAriane]} />
        </div>
        <article>
          <EnteteArticle
            surtitre={`${c(`surtitre.${p.gabarit}`)} · ${view.category}`}
            titre={p.titre}
            chapo={p.chapo}
            auteur={view.author}
            auteurHref={p.auteurHref}
            publieLe={view.publishedAt}
            misAJourLe={view.updatedAt ?? null}
            tempsLecture={view.readingTime}
            media={image}
          />
          {p.tldr ? (
            <div className="art-reponse">
              <AnswerCard locale={loc} variante="v2" libelle={c("reponseDirecte")}>
                {p.tldr}
              </AnswerCard>
            </div>
          ) : null}
          <ArticleKeyTakeaway text={view.keyTakeaway} locale={loc} />

          <MiseEnPageLecture sommaire={sommaire}>
            <CorpsArticle html={p.html} blocs={p.blocs} />
            <ArticleExpertQuote quote={view.expertQuote} locale={loc} />
            <ArticleFaq
              items={view.faqItems}
              locale={loc}
              dateModified={view.updatedAt ?? view.publishedAt}
              variante="v2"
              titre={c("faqTitre")}
            />
            <PiedArticle>
              <ArticleSources
                items={view.citations}
                locale={loc}
                lastVerified={
                  p.sourcesVerifiees ? p.sourcesVerifiees.toISOString().slice(0, 10) : null
                }
              />
              <ArticleTransparencyBlock
                lastVerified={p.sourcesVerifiees}
                updateCycleDays={90}
                locale={loc}
              />
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
              <QualiopiContentBadge locale={loc} />
              <AiContentDisclaimer locale={loc} />
              <ArticleShareBar url={p.pageUrl} title={view.title} locale={loc} />
              {p.villeAncree ? (
                <p className="text-fg-muted text-sm">
                  {t("cityPrefix")}
                  <Link href={p.villeAncree.href as never} className="underline">
                    {t("cityLink", { ville: p.villeAncree.nom })}
                  </Link>
                  {t("citySuffix")}
                </p>
              ) : null}
              <ArticlePeopleAlsoAsk items={p.questionsAssociees} locale={loc} />
            </PiedArticle>
          </MiseEnPageLecture>
        </article>
      </div>

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
      <div className="art-wrap">
        <CtaGabarit variante={cta} />
      </div>

      {p.jsonLd.map((noeud, i) => (
        <JsonLd key={i} data={noeud as never} />
      ))}
    </div>
  );
}

export function GabaritAnalyse(p: ArticleGabaritProps) {
  return <MiseEnPageAnalyse p={p} cta="journeeIa" />;
}
