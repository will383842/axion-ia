/**
 * Gabarit « Guide pilier » (`/guides/[slug]`, PR M-GU1) : habillage v2 d'une page autonome,
 * derrière l'interrupteur `BLOG_GABARITS_V2`. Composant SERVEUR, aucun JavaScript client.
 *
 * Ni `<main>` ni en-tête de site (ils viennent du layout). `<article>` englobe l'en-tête, les
 * chapitres, la feuille de route, la FAQ, les sources et la carte auteur ; la colonne d'actions
 * (un seul `<aside class="action">`) suit `</article>`. Les ids `step-N` des chapitres sont
 * ceux de la V1 et du sommaire. Le JSON-LD (`HowTo` ou `Article`, `Person`), les metadata et
 * l'URL ne changent pas : la page les calcule comme en V1.
 *
 * Aucune donnée inventée : les chapitres sont les étapes structurées du guide ; les durées sont
 * estimées sur leur texte ; la feuille de route reprend leurs titres. Sans étapes (corps
 * libre), pas de chapitres, de feuille de route ni de sommaire. L'encart vidéo attend que
 * `/guides` soit page hôte (PR E6 de la conception vidéo).
 */
import "@/styles/article-v2/socle.css";
import "@/styles/article-v2/complements.css";
import "@/styles/article-v2/guide-pilier.css";
import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { GUIDE_IA_PAGES } from "@/content/guide-ia";
import { ROUTES } from "@/lib/routes";
import { AnswerCard } from "@/components/marketing/AnswerCard";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { JsonLd } from "@/components/marketing/JsonLd";
import { TermesGlossaireLies } from "@/components/marketing/TermesGlossaireLies";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { ArticleTOC, type TocItem } from "@/components/seo/ArticleTOC";
import { AuthorByline } from "@/components/knowledge/public/AuthorByline";
import { ArticleFaq } from "@/components/content-gen/ArticleFaq";
import { ArticleSources } from "@/components/content-gen/ArticleSources";
import { ArticleKeyTakeaway } from "@/components/content-gen/ArticleKeyTakeaway";
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
import { BandeauChapitre } from "../BandeauChapitre";
import type { ArticleGuidePilierProps } from "../types";

const GABARIT = "guide-pilier" as const;
const MOTS_PAR_MINUTE = 200;

/** Minutes estimées d'un chapitre : au moins une, d'après le nombre de mots de son texte. */
function minutesDuChapitre(texte: string): number {
  const mots = texte.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(mots / MOTS_PAR_MINUTE));
}

function paragraphesDe(texte: string): string[] {
  return texte
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function GabaritGuidePilier(p: ArticleGuidePilierProps) {
  const a = useTranslations("articleGabarits.guide-pilier");
  const c = useTranslations("articleGabarits.commun");
  const t = useTranslations("articleV2");
  const loc = p.locale;

  const n = p.etapes.length;
  const chapitres = n >= 2;
  const minutes = p.etapes.map((e) => minutesDuChapitre(e.text));
  const totalMinutes = minutes.reduce((somme, m) => somme + m, 0);
  // Reste à lire en entrant dans le chapitre i (ce chapitre compris).
  const restantes = minutes.map((_, i) => minutes.slice(i).reduce((s, m) => s + m, 0));

  // Un détail par entrée du sommaire de la V1 (mêmes ancres `step-N`, mêmes titres).
  const entrees: TocItem[] = p.tocItems.map((item, i) => ({
    ...item,
    detail: a("sommaire.detail", { minutes: minutes[i] ?? 1, numero: i + 1, total: n }),
    progression: Math.round(((i + 1) / Math.max(1, n)) * 100),
  }));
  const sommaire =
    chapitres && entrees.length >= 2 ? (
      <ArticleTOC
        items={entrees}
        pageUrl={p.pageUrl}
        locale={loc}
        variante="v2"
        cibleTactile
        id="sommaire"
        libelle={c("sommaire")}
        total={a("sommaire.total", { minutes: totalMinutes })}
      />
    ) : null;

  // Deux encarts du milieu, répartis dans les chapitres (aucun avec moins de 2 chapitres).
  const apresChapitre1 = chapitres ? Math.max(1, Math.round(n * 0.3)) : 0;
  const apresChapitre2 = n >= 4 ? Math.round(n * 0.7) : 0;
  const encart = (rang: 1 | 2) =>
    rang === 1 ? (
      <CtaMilieu
        gabarit={GABARIT}
        principal="diagnostic"
        titre={a("ctaMilieu1.titre")}
        texte={a("ctaMilieu1.texte")}
        lienSecondaire={{
          label: a("ctaMilieu1.lien", { pages: GUIDE_IA_PAGES }),
          href: ROUTES.guideAi,
        }}
      />
    ) : (
      <CtaMilieu
        gabarit={GABARIT}
        principal="journee"
        titre={a("ctaMilieu2.titre")}
        texte={a("ctaMilieu2.texte")}
        secondaire="message"
      />
    );

  const ouverture = (
    <>
      <HerosArticle
        gabarit={GABARIT}
        surtitreType={a("surtitre")}
        signe={chapitres ? { grand: String(n), legende: a("signe.legende") } : null}
        categorie={chapitres ? a("categorie", { nombre: n }) : a("categorieSansChapitres")}
        titre={p.titre}
        chapo={null}
        auteur="Manon"
        auteurHref="/equipe/manon"
        publieLe={p.publieLe.iso}
        publieLisible={p.publieLe.lisible}
        misAJourLe={p.misAJourLe?.iso ?? null}
        {...(p.misAJourLe ? { misAJourLisible: p.misAJourLe.lisible } : {})}
        tempsLecture={null}
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
          <AnswerCard locale={loc} variante="v2" libelle={c("enBref")}>
            {p.tldr}
          </AnswerCard>
        ) : null}
      </div>
    </>
  );

  return (
    <div data-gabarit={GABARIT}>
      <BarreProgression />
      <link
        rel="alternate"
        type="text/markdown"
        href={`/api/markdown/guides/${p.slug}`}
        title={`${p.titreComplet} (markdown)`}
      />
      <Breadcrumbs items={[...p.filAriane]} variante="v2" />
      <MiseEnPageLecture
        ouverture={ouverture}
        sommaire={sommaire}
        colonne={<ColonneActionsConnectee gabarit={GABARIT} />}
      >
        <ArticleKeyTakeaway text={p.pointCle} locale={loc} />
        {chapitres ? (
          p.etapes.map((etape, i) => {
            const rang = i + 1;
            return (
              <Fragment key={i}>
                <section className="chapitre" aria-labelledby={`step-${etape.position}`}>
                  <BandeauChapitre
                    numero={rang}
                    ancre={etape.position}
                    total={n}
                    minutes={minutes[i] ?? 1}
                    minutesRestantes={restantes[i] ?? 1}
                    progression={Math.round((rang / n) * 100)}
                    titre={etape.name}
                  />
                  <div className="chapitre__corps">
                    {paragraphesDe(etape.text).map((texte, j) => (
                      <p key={j}>{texte}</p>
                    ))}
                    <p className="chapitre__pied">
                      {rang < n ? (
                        <a className="lien-fleche" href={`#step-${p.etapes[i + 1]!.position}`}>
                          {a("chapitre.suivant")}
                          <span className="visuellement-masque">
                            {a("chapitre.suivantPrecision", { numero: rang + 1, total: n })}
                          </span>{" "}
                          <span aria-hidden="true">→</span>
                        </a>
                      ) : (
                        <span />
                      )}
                      <a className="lien-retour" href="#sommaire">
                        {a("chapitre.retour")}
                      </a>
                    </p>
                  </div>
                </section>
                {rang === apresChapitre1 ? encart(1) : null}
                {rang === apresChapitre2 && apresChapitre2 !== apresChapitre1 ? encart(2) : null}
              </Fragment>
            );
          })
        ) : (
          <>
            <CorpsArticle
              html={p.html}
              blocs={p.html ? null : p.paragraphes.map((text) => ({ kind: "p" as const, text }))}
            />
            {encart(1)}
          </>
        )}
        {chapitres ? (
          <section
            className="feuille-route sur-sombre"
            aria-labelledby="votre-feuille-de-route"
            data-aeo="key-point"
          >
            <p className="pastille pastille--pleine feuille-route__surtitre">
              {a("feuilleDeRoute.surtitre")}
            </p>
            <h2 id="votre-feuille-de-route">
              {a("feuilleDeRoute.titreDebut")} <em>{a("feuilleDeRoute.titreEm")}</em>
            </h2>
            <ol>
              {p.etapes.map((etape, i) => (
                <li key={i}>
                  <p>
                    {etape.name}
                    <span>{a("chapitre.numeroCourt", { numero: i + 1 })}</span>
                  </p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
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
          <ArticleTransparencyBlock lastVerified={null} updateCycleDays={60} locale={loc} />
          <AuthorByline
            authorName="Manon"
            authorSlug="manon"
            {...(p.bylineManon
              ? { authorAvatarUrl: p.bylineManon.avatarUrl, authorBio: p.bylineManon.bio }
              : {})}
            publishedAt={new Date(p.publieLe.iso)}
            emitJsonLd={false}
            locale={loc}
          />
          <AiContentDisclaimer locale={loc} />
          <ArticleShareBar url={p.pageUrl} title={p.titreComplet} locale={loc} />
          <ArticlePeopleAlsoAsk items={p.questionsAssociees} locale={loc} />
          <TermesGlossaireLies locale={loc} termes={p.termesLies} />
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
        <ArticleNewsletterInline locale={loc} source="guides-fin-article" />
        <CtaFin gabarit={GABARIT} />
      </div>

      {p.jsonLd.map((noeud, i) => (
        <JsonLd key={i} data={noeud as never} />
      ))}
    </div>
  );
}
