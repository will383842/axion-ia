/**
 * Gabarit « Chiffres » (G8, `barometer_insight`) : la mise en page de lecture, plus, SEULEMENT
 * si un relevé structuré est rattaché à l'article (`chargerReleve`) :
 *  - le bandeau « Données au <date> » + lien « Consulter l'Observatoire », sous le héros ;
 *  - une rangée de chiffres géants (constats phares du relevé) avec leur source ;
 *  - des barres horizontales CSS (maturité IA du relevé), valeur écrite en texte, piste `aria-hidden` ;
 *  - l'encadré « Comment lire ces chiffres » (champ, période, échantillon).
 * Aucun chiffre ne vient du HTML (jamais d'expression régulière) ni du gabarit : tout vient du
 * relevé. Sans relevé : mise en page Analyse, sans bandeau (pas de date). Aucun prix.
 * Composant serveur, zéro JavaScript ; la lecture du relevé est faite côté serveur.
 */
import "@/styles/article-v2/chiffres.css";
import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { STUDY_ATTRIBUTION } from "@/content/observatoire/study";
import { chargerReleve, type Releve } from "@/server/content-gen/blog/charger-releve";
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
import { BarreProgression } from "../BarreProgression";
import { HerosArticle } from "../HerosArticle";
import { PhotoArticle } from "../PhotoArticle";
import { MiseEnPageLecture } from "../MiseEnPageLecture";
import { CorpsArticle } from "../CorpsArticle";
import { PiedArticle } from "../PiedArticle";
import { ColonneActionsConnectee } from "../ColonneActionsConnectee";
import { CtaMilieu } from "../CtaMilieu";
import { CtaFin } from "../CtaFin";
import { BandeauDonnees } from "../BandeauDonnees";
import { RangeeChiffres } from "../RangeeChiffres";
import { ChiffreCle } from "../ChiffreCle";
import { EncadreArticle } from "../EncadreArticle";
import type { ArticleGabaritProps } from "../types";
import { MiseEnPageAnalyse } from "./GabaritAnalyse";

const NIVEAUX_MATURITE = ["none", "exploration", "poc", "production", "scaled"] as const;

/** « 1er octobre 2026 » / « October 1, 2026 » : UTC, la date du relevé est un jour calendaire. */
function dateLisible(dateIso: string, locale: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  const texte = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
  return locale === "fr" ? texte.replace(/^1 /, "1er ") : texte;
}

/** Pourcentage entier écrit comme le français le demande : espace fine insécable avant « % ». */
const pourcent = (pct: number, locale: string) => (locale === "fr" ? `${pct} %` : `${pct}%`);

export interface MiseEnPageChiffresProps {
  readonly p: ArticleGabaritProps;
  readonly releve: Releve | null;
}

export function MiseEnPageChiffres({ p, releve }: MiseEnPageChiffresProps) {
  const t = useTranslations("articleGabarits.chiffres");
  const c = useTranslations("articleGabarits.commun");
  const tv2 = useTranslations("articleV2");
  const { view, locale: loc } = p;

  if (!releve) return <MiseEnPageAnalyse p={p} cta="journee" />;

  const lisible = dateLisible(releve.dateIso, loc);
  const niveaux = releve.maturite.filter((m) =>
    (NIVEAUX_MATURITE as ReadonlyArray<string>).includes(m.valeur),
  );

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
      <BandeauDonnees dateIso={releve.dateIso} dateLisible={lisible} />
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
        {releve.constats.length > 0 ? (
          <RangeeChiffres
            id="releve-constats"
            titre={t("constats.titre")}
            source={STUDY_ATTRIBUTION}
          >
            {releve.constats.map((k) => (
              <ChiffreCle
                key={k.cle}
                valeur={pourcent(k.pct, loc)}
                libelle={t(`constats.${k.cle}`)}
              />
            ))}
          </RangeeChiffres>
        ) : null}
        {niveaux.length > 0 ? (
          <section className="barres" aria-labelledby="releve-maturite">
            <p className="barres__titre" id="releve-maturite">
              {t("maturite.titre")}
            </p>
            <p className="barres__echelle">{t("maturite.echelle")}</p>
            <ul className="barres__liste" aria-label={t("maturite.aria")}>
              {niveaux.map((m) => (
                <li className="barres__ligne" key={m.valeur}>
                  <span className="barres__libelle">{t(`maturite.valeurs.${m.valeur}`)}</span>
                  <span className="barres__valeur">{pourcent(m.pct, loc)}</span>
                  <span className="barres__piste" aria-hidden="true">
                    <span
                      className="barres__remplissage"
                      style={{ "--v": `${m.pct}%` } as React.CSSProperties}
                    />
                  </span>
                </li>
              ))}
            </ul>
            <p className="source">{STUDY_ATTRIBUTION}</p>
          </section>
        ) : null}
        <EncadreArticle id="releve-lecture" titre={t("lecture.titre")} type="saviez">
          <dl className="lire">
            <div>
              <dt>{t("lecture.champ")}</dt>
              <dd>{t("lecture.champTexte")}</dd>
            </div>
            <div>
              <dt>{t("lecture.periode")}</dt>
              <dd>{t("lecture.periodeTexte", { date: lisible })}</dd>
            </div>
            <div>
              <dt>{t("lecture.echantillon")}</dt>
              <dd>{t("lecture.echantillonTexte", { n: releve.total })}</dd>
            </div>
          </dl>
        </EncadreArticle>
        <CorpsArticle html={p.html} blocs={p.blocs} />
        <CtaMilieu gabarit={p.gabarit} principal="journee" />
        <ArticleExpertQuote quote={view.expertQuote} locale={loc} />
        <ArticleFaq
          items={view.faqItems}
          locale={loc}
          dateModified={view.updatedAt ?? view.publishedAt}
          variante="v2"
          titre={c("faqTitre")}
        />
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

/** Lit le relevé de l'article (serveur, tolérant : erreur ou absence → `null`), puis rend. */
export async function GabaritChiffresAvecReleve(p: ArticleGabaritProps) {
  const releve = await chargerReleve(p.view.generatedByJobId ?? null);
  return <MiseEnPageChiffres p={p} releve={releve} />;
}

/**
 * Aiguillage : la lecture du relevé est asynchrone ; le repli (mise en page sans relevé) garde
 * l'aiguillage synchrone de `ArticleGabarit` utilisable en rendu statique. À la génération
 * (ISR) la page attend la lecture : le HTML final porte le relevé, jamais le repli.
 */
export function GabaritChiffres(p: ArticleGabaritProps) {
  return (
    <Suspense fallback={<MiseEnPageChiffres p={p} releve={null} />}>
      <GabaritChiffresAvecReleve {...p} />
    </Suspense>
  );
}
