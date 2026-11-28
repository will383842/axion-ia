/**
 * Gabarit « Actualité » (`/actualites/[slug]`, PR M-A1) : habillage v2 d'une page autonome,
 * derrière l'interrupteur `BLOG_GABARITS_V2`. Composant SERVEUR, aucun JavaScript client.
 *
 * Ni `<main>` ni en-tête de site (ils viennent du layout). `<article>` englobe l'en-tête, le
 * corps, la FAQ, les sources et la carte auteur ; la colonne d'actions (un seul
 * `<aside class="action">`) suit `</article>`. Le JSON-LD (`NewsArticle`, `Person`), les
 * metadata, `og:image` et l'URL ne changent pas : la page les calcule comme en V1.
 *
 * Aucune donnée inventée : le triptyque ne rend que le « Point clé » existant ; sans signe
 * tiré des métadonnées, aucun signe ; la frise des dates n'existe pas faute de donnée ;
 * l'encart vidéo attend que `/actualites` soit page hôte (PR E6 de la conception vidéo).
 */
// Les routes d'article importent elles-mêmes leurs feuilles (PLAN §15.7). Ordre voulu : le socle
// et les compléments d'abord, la feuille propre au gabarit en dernier (elle l'emporte à
// spécificité égale).
import "@/styles/article-v2/socle.css";
import "@/styles/article-v2/complements.css";
import "@/styles/article-v2/actualite.css";
import { useTranslations } from "next-intl";
import { AnswerCard } from "@/components/marketing/AnswerCard";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { ArticleTOC } from "@/components/seo/ArticleTOC";
import { AuthorByline } from "@/components/knowledge/public/AuthorByline";
import { ArticleFaq } from "@/components/content-gen/ArticleFaq";
import { ArticleSources } from "@/components/content-gen/ArticleSources";
import { ArticleExpertQuote } from "@/components/content-gen/ArticleExpertQuote";
import { ArticleShareBar } from "@/components/content-gen/ArticleShareBar";
import { ArticleTransparencyBlock } from "@/components/content-gen/ArticleTransparencyBlock";
import { ArticlePrevNext } from "@/components/content-gen/ArticlePrevNext";
import { ArticlePeopleAlsoAsk } from "@/components/content-gen/ArticlePeopleAlsoAsk";
import { ArticleNewsletterInline } from "@/components/content-gen/ArticleNewsletterInline";
import { SuggestedContent } from "@/components/suggested/SuggestedContent";
import { BarreProgression } from "../BarreProgression";
import { HerosArticle } from "../HerosArticle";
import { PhotoArticle } from "../PhotoArticle";
import { MiseEnPageLecture } from "../MiseEnPageLecture";
import { CorpsArticle } from "../CorpsArticle";
import { PiedArticle } from "../PiedArticle";
import { ColonneActionsConnectee } from "../ColonneActionsConnectee";
import { CtaMilieu } from "../CtaMilieu";
import { CtaFin } from "../CtaFin";
import { TriptyqueActualite } from "../TriptyqueActualite";
import type { ArticleActualiteProps } from "../types";

const GABARIT = "actualite" as const;

function SourceOrigine({ nom, url }: { readonly nom: string; readonly url: string | null }) {
  const t = useTranslations("articleGabarits.actualite.source");
  return (
    <div className="source-origine">
      <p className="source-origine__bandeau">
        <span>{t("bandeau")}</span>
      </p>
      <div className="source-origine__corps">
        <p className="source-origine__nom">{nom}</p>
        {url ? (
          <a className="btn btn--contour" href={url} rel="noopener noreferrer">
            {t("lien")}
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function GabaritActualite(p: ArticleActualiteProps) {
  const a = useTranslations("articleGabarits.actualite");
  const c = useTranslations("articleGabarits.commun");
  const t = useTranslations("articleV2");
  const loc = p.locale;

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

  const auteurNom = p.auteur?.nom ?? "Manon";
  const auteurHref = p.auteur?.href ?? "/equipe/manon";

  const ouverture = (
    <>
      <HerosArticle
        gabarit={GABARIT}
        surtitreType={a("surtitre")}
        categorie={p.categorie}
        titre={p.titre}
        chapo={p.chapo}
        auteur={auteurNom}
        auteurHref={auteurHref}
        publieLe={p.publieLe?.iso ?? null}
        misAJourLe={p.misAJourLe?.iso ?? null}
        {...(p.misAJourLe ? { misAJourLisible: p.misAJourLe.lisible } : {})}
        {...(p.publieLe
          ? {
              dateUne: { jour: p.publieLe.jour, iso: p.publieLe.iso, lisible: p.publieLe.lisible },
            }
          : {})}
        {...(p.source
          ? {
              pastilleSource: (
                <li className="pastille pastille--contour pastille--source">
                  {a("dApres")}
                  {p.source.url ? (
                    <a href={p.source.url} rel="noopener noreferrer">
                      {p.source.nom}
                    </a>
                  ) : (
                    p.source.nom
                  )}
                </li>
              ),
            }
          : {})}
        tempsLecture={p.minutesLecture ? a("tempsLecture", { minutes: p.minutesLecture }) : null}
        pageUrl={p.pageUrl}
        titreArticle={p.titreComplet}
      />
      <div className="article__ouverture">
        <PhotoArticle
          gabarit={GABARIT}
          src={p.photo.src}
          alt={p.photo.alt}
          titre={p.titreComplet}
          photographerName={p.photo.photographerName}
          photographerUrl={p.photo.photographerUrl}
        />
        {p.tldr ? (
          <AnswerCard
            locale={loc}
            variante="v2"
            libelle={c("enBref")}
            {...(p.source ? { sourceLabel: p.source.nom } : {})}
            {...(p.source?.url ? { sourceUrl: p.source.url } : {})}
          >
            {p.tldr}
          </AnswerCard>
        ) : null}
        <TriptyqueActualite ceQuiChange={p.pointCle} />
      </div>
    </>
  );

  return (
    <div data-gabarit={GABARIT}>
      <BarreProgression />
      <link
        rel="alternate"
        type="text/markdown"
        href={`/api/markdown/actualites/${p.slug}`}
        title={`${p.titreComplet} (markdown)`}
      />
      <Breadcrumbs items={[...p.filAriane]} variante="v2" />
      <MiseEnPageLecture
        ouverture={ouverture}
        sommaire={sommaire}
        colonne={<ColonneActionsConnectee gabarit={GABARIT} />}
      >
        <CorpsArticle
          html={p.html}
          blocs={p.html ? null : p.paragraphes.map((text) => ({ kind: "p" as const, text }))}
        />
        {p.source ? <SourceOrigine nom={p.source.nom} url={p.source.url} /> : null}
        <CtaMilieu
          gabarit={GABARIT}
          principal="diagnostic"
          secondaire="message"
          titre={a("ctaMilieu.titre")}
          texte={a("ctaMilieu.texte")}
        />
        <ArticleExpertQuote quote={p.expertQuote} locale={loc} />
        <ArticleFaq
          items={p.faqItems}
          locale={loc}
          dateModified={p.dateMiseAJourIso}
          variante="v2"
          titre={c("faqTitre")}
        />
        <PiedArticle>
          <ArticleSources items={p.citations} locale={loc} lastVerified={null} />
          <ArticleTransparencyBlock lastVerified={null} updateCycleDays={30} locale={loc} />
          <AuthorByline
            authorName={auteurNom}
            authorSlug={p.auteur?.slug ?? "manon"}
            {...(p.bylineManon
              ? { authorAvatarUrl: p.bylineManon.avatarUrl, authorBio: p.bylineManon.bio }
              : {})}
            publishedAt={p.publieLe ? new Date(p.publieLe.iso) : null}
            emitJsonLd={false}
            locale={loc}
          />
          <AiContentDisclaimer locale={loc} />
          <ArticleShareBar url={p.pageUrl} title={p.titreComplet} locale={loc} />
          <ArticlePeopleAlsoAsk items={p.questionsAssociees} locale={loc} />
        </PiedArticle>
      </MiseEnPageLecture>

      <div className="conteneur">
        <SuggestedContent
          variant="articles"
          items={p.suggestions}
          eyebrow={t("relatedEyebrow")}
          title={t("relatedTitle")}
          tone="sand"
          emitJsonLd
        />
        <ArticlePrevNext
          prev={p.precedentSuivant.prev}
          next={p.precedentSuivant.next}
          locale={loc}
        />
        <ArticleNewsletterInline locale={loc} source="actualites-fin-article" />
        <CtaFin gabarit={GABARIT} />
      </div>

      {p.jsonLd.map((noeud, i) => (
        <JsonLd key={i} data={noeud as never} />
      ))}
    </div>
  );
}
