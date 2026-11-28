/**
 * Gabarit « Questions-réponses » (G7) : la FAQ est le corps de l'article.
 *  - ouverture : héros terracotta (signe « ? »), vraie photo, réponse directe ;
 *  - sommaire = les questions ; grille mocha « Les N questions » (porte d'entrée, liens `#q-N`,
 *    jamais un second `<nav>`) ;
 *  - `ArticleFaq` remonte juste après la réponse directe : cartes `<details>` numérotées par
 *    compteur CSS, première question ouverte, ancres `q-N`, encart « Votre question n'est pas
 *    là ? » inséré après la 4e question (ou la dernière s'il y en a moins) ;
 *  - le corps HTML (réponse détaillée, `qa_derived`) suit : H1 abaissé en H2, JSON-LD du corps
 *    retiré (une seule `FAQPage` : celle d'`ArticleFaq`).
 * Sans question : mise en page Analyse. Aucun thème : le générateur n'en fournit pas, donc une
 * seule liste. Aucun prix. Composant serveur, zéro JavaScript.
 */
import "@/styles/article-v2/faq.css";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { lienDiagnostic } from "@/content/journee-ia-commun";
import { abaisserH1 } from "@/server/content-gen/blog/transformations";
import { AnswerCard } from "@/components/marketing/AnswerCard";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { ArticleTOC } from "@/components/seo/ArticleTOC";
import { AuthorByline } from "@/components/knowledge/public/AuthorByline";
import { QualiopiContentBadge } from "@/components/qualiopi/QualiopiContentBadge";
import { ArticleFaq, questionsRendues } from "@/components/content-gen/ArticleFaq";
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
import { BarreProgression } from "../BarreProgression";
import { HerosArticle } from "../HerosArticle";
import { PhotoArticle } from "../PhotoArticle";
import { MiseEnPageLecture } from "../MiseEnPageLecture";
import { CorpsArticle } from "../CorpsArticle";
import { PiedArticle } from "../PiedArticle";
import { ColonneActionsConnectee } from "../ColonneActionsConnectee";
import { CtaFin } from "../CtaFin";
import type { ArticleGabaritProps } from "../types";
import { MiseEnPageAnalyse } from "./GabaritAnalyse";

/** Rang (1 = première) après lequel s'insère l'encart « Votre question n'est pas là ? ». */
const RANG_ENCART = 4;

/** Retire tout `<script type="application/ld+json">` du corps : la FAQPage vient d'`ArticleFaq`. */
/** Retire la section « questions associées » du corps (`qa_derived`) : les cartes la remplacent. */
function sansQuestionsAssociees(html: string): string {
  return html.replace(/<section\b[^>]*related-qa[^>]*>[\s\S]*?<\/section\s*>/gi, "");
}

function sansJsonLd(html: string): string {
  return html.replace(
    /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>[\s\S]*?<\/script\s*>/gi,
    "",
  );
}

export function GabaritFaq(p: ArticleGabaritProps) {
  const t = useTranslations("articleGabarits.faq");
  const c = useTranslations("articleGabarits.commun");
  const a = useTranslations("articleGabarits.commun.actions");
  const tv2 = useTranslations("articleV2");
  const { view, locale: loc } = p;

  const questions = questionsRendues(view.faqItems);
  if (questions.length === 0) return <MiseEnPageAnalyse p={p} cta="diagnostic" />;

  const html = p.html ? abaisserH1(sansQuestionsAssociees(sansJsonLd(p.html))) : null;

  const tocQuestions = questions.map((question, i) => ({
    anchor: `q-${i + 1}`,
    title: question,
    level: 2 as const,
  }));

  const sommaire =
    tocQuestions.length >= 2 ? (
      <ArticleTOC
        items={tocQuestions}
        pageUrl={p.pageUrl}
        locale={loc}
        variante="v2"
        cibleTactile
        libelle={c("sommaire")}
      />
    ) : null;

  const ouverture = (
    <>
      <HerosArticle
        gabarit={p.gabarit}
        categorie={view.category}
        titre={p.titre}
        chapo={p.chapo}
        auteur={view.author}
        auteurHref={p.auteurHref}
        publieLe={view.publishedAt}
        misAJourLe={view.updatedAt ?? null}
        tempsLecture={view.readingTime}
        pageUrl={p.pageUrl}
        titreArticle={view.title}
      />
      <div className="article__ouverture">
        <PhotoArticle
          gabarit={p.gabarit}
          src={view.featuredImage ?? null}
          alt={view.featuredImageAlt ?? null}
          titre={view.title}
          photographerName={view.photographerName}
          photographerUrl={view.photographerUrl}
        />
        {p.tldr ? (
          <AnswerCard locale={loc} variante="v2" libelle={c("enBref")}>
            {p.tldr}
          </AnswerCard>
        ) : null}
      </div>
    </>
  );

  const encart = (
    <aside className="cta-milieu cta-milieu--sage" aria-labelledby="faq-encart-titre">
      <p className="cta-milieu__surtitre">{t("encart.surtitre")}</p>
      <p className="cta-milieu__titre" id="faq-encart-titre">
        {t("encart.titre")}
      </p>
      <p>{t("encart.texte")}</p>
      <div className="cta-milieu__actions">
        <Link className="btn btn--contour" href={ROUTES.contact as never} data-cta="message">
          {a("message.long")}
        </Link>
        <Link
          className="lien-fleche"
          href={lienDiagnostic(`${p.gabarit}-milieu`) as never}
          data-cta="diagnostic"
        >
          {t("encart.ou")} {a("diagnostic.long")} →
        </Link>
      </div>
    </aside>
  );

  return (
    <div data-gabarit={p.gabarit}>
      <BarreProgression />
      <link
        rel="alternate"
        type="text/markdown"
        href={`/api/markdown/blog/${view.slug}`}
        title={`${view.title} (markdown)`}
      />
      <Breadcrumbs items={[...p.filAriane]} variante="v2" />
      <MiseEnPageLecture
        ouverture={ouverture}
        sommaire={sommaire}
        colonne={<ColonneActionsConnectee gabarit={p.gabarit} />}
      >
        <ArticleKeyTakeaway text={view.keyTakeaway} locale={loc} />
        <div className="grille-q sur-sombre">
          <p className="grille-q__titre">
            {questions.length === 1
              ? t("grille.titreUne")
              : t("grille.titre", { n: questions.length })}{" "}
            <em>{t("grille.em")}</em>
          </p>
          <ol className="grille-q__liste" aria-label={t("grille.aria")}>
            {questions.map((question, i) => (
              <li key={i}>
                <a href={`#q-${i + 1}`}>{question}</a>
              </li>
            ))}
          </ol>
        </div>
        <ArticleFaq
          items={view.faqItems}
          locale={loc}
          dateModified={view.updatedAt ?? view.publishedAt}
          variante="v2"
          titre={c("faqTitre")}
          premiereOuverte
          ancres
          inserer={{ apres: Math.min(RANG_ENCART, questions.length), contenu: encart }}
        />
        <CorpsArticle html={html} blocs={p.blocs} />
        <ArticleExpertQuote quote={view.expertQuote} locale={loc} />
        {p.themeEncart ? <EncartEnVideo theme={p.themeEncart} variante="article-v2" /> : null}
        <PiedArticle>
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
              {tv2("cityPrefix")}
              <Link href={p.villeAncree.href as never} className="underline">
                {tv2("cityLink", { ville: p.villeAncree.nom })}
              </Link>
              {tv2("citySuffix")}
            </p>
          ) : null}
          <ArticlePeopleAlsoAsk items={p.questionsAssociees} locale={loc} />
        </PiedArticle>
      </MiseEnPageLecture>

      <div className="conteneur">
        <SuggestedContent
          variant="articles"
          items={p.suggestions}
          eyebrow={tv2("relatedEyebrow")}
          title={tv2("relatedTitle")}
          tone="sand"
          emitJsonLd
        />
        <ArticlePrevNext
          prev={p.precedentSuivant.prev}
          next={p.precedentSuivant.next}
          locale={loc}
        />
        <ArticleNewsletterInline locale={loc} source="blog-fin-article" />
        <CtaFin gabarit={p.gabarit} />
      </div>

      {p.jsonLd.map((noeud, i) => (
        <JsonLd key={i} data={noeud as never} />
      ))}
    </div>
  );
}
