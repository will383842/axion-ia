// Page du guide IA entreprise — refonte mobile d'abord (lot L1, 2026-09-25).
//
// 🔴 Le constat (audit `page-guide-ux.md`, 2026-09-24) : le formulaire était à
// 3,2 écrans du haut sur mobile, la page ne montrait jamais le guide (deux
// photos Unsplash d'ambiance), affichait du jargon interne (« Lead magnet »,
// « pSEO », « quick-wins ») et sortait vers `/formations` alors que le guide
// propose `/diagnostic` puis `/appel` (constat chiffré : audit hors dépôt).
//
// La page, désormais :
//   · premier écran mobile (390 × 664) = couverture réelle + titre + promesse +
//     formulaire COMPLET (champ, bouton, mention) — verrouillé par
//     `tests/e2e/flows/guide-ia-premier-ecran-mobile.spec.ts` ;
//   · montre le guide : 4 pages intérieures, les 13 outils, le sommaire réel ;
//   · second formulaire en bas, barre collante mobile entre les deux ;
//   · FAQ balisée `FAQPage`, sortie `/diagnostic` puis `/appel` (p. 40 du PDF).
//
// Textes : `content/guide-ia-page.ts` (page) et `content/guide-ia-formulaire.ts`
// (formulaire, archive de preuve). Rien de nouveau n'est écrit ici en dur.
//
// Perf : zéro JS ajouté hors la barre collante (un IntersectionObserver) ; les
// deux formulaires partagent le même îlot client ; aperçus en `lazy`, carrousel
// en `scroll-snap` CSS ; seule la couverture est préchargée (élément LCP).

import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { BarreGuideCollante } from "@/components/guide-ia/BarreGuideCollante";
import { ATTRIBUT_FORMULAIRE_GUIDE } from "@/components/guide-ia/attribut-formulaire";
import { libellesFormulaireGuide } from "@/content/guide-ia-formulaire";
import {
  APERCU_DIMENSIONS,
  COUVERTURE_GUIDE,
  textesPageGuide,
  type LocalePageGuide,
} from "@/content/guide-ia-page";
import { GUIDE_IA_PAGES, urlGuideIa } from "@/content/guide-ia";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  buildFaqJsonLd,
  buildPageImageGraphJsonLd,
  buildPrimaryImageOfPage,
  buildProductMetadata,
  buildWebPageJsonLd,
  SITE_URL,
} from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

/** Ancre du premier formulaire — visée par la barre collante et par les liens internes. */
const ANCRE_FORMULAIRE = "recevoir";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = textesPageGuide(locale as LocalePageGuide);
  return buildProductMetadata({
    locale,
    path: "/guide-ia",
    title: t.meta.title,
    description: t.meta.description,
    alternates: { fr: "/guide-ia", en: "/ai-guide" },
  });
}

/** Sur-titre de section : même signature que `Section` (point terracotta). */
function SurTitre({ children }: { children: ReactNode }) {
  return (
    <p className="text-fg-muted text-[12px] font-medium tracking-[0.16em] uppercase sm:text-[13px]">
      <span
        aria-hidden="true"
        className="bg-terracotta mr-2.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
      />
      {children}
    </p>
  );
}

/** Titre de section (h2), plus compact que `Section` sur mobile : la page est longue. */
function TitreSection({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="text-fg mt-3 text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.08] font-semibold tracking-tight"
    >
      {children}
    </h2>
  );
}

export default async function AiGuidePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const lp: LocalePageGuide = loc === "en" ? "en" : "fr";
  const t = textesPageGuide(lp);
  const libellesGuide = libellesFormulaireGuide("guide", lp);
  const [titreAvant, titreApres] = t.hero.titre.split(" · ");

  // CreativeWork du PDF : ce que les moteurs et les assistants peuvent citer
  // (chapitres avec leur pagination, public, édition, format). Tout vient du
  // PDF (fiche p. 2, sommaire p. 3).
  const guideJsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": `${SITE_URL}/${locale}/guide-ia#guide`,
    name: t.hero.titre,
    alternateName: "Guide IA entreprise 2026",
    description: t.meta.description,
    inLanguage: "fr",
    url: `${SITE_URL}/${locale}/guide-ia`,
    image: `${SITE_URL}${COUVERTURE_GUIDE.src}`,
    publisher: { "@id": `${SITE_URL}/#organization` },
    author: { "@id": `${SITE_URL}/#organization` },
    datePublished: "2026-09",
    version: "1",
    numberOfPages: GUIDE_IA_PAGES,
    isAccessibleForFree: true,
    encodingFormat: "application/pdf",
    audience: {
      "@type": "BusinessAudience",
      audienceType: "Dirigeants et responsables de PME, d'ETI et de grands groupes",
    },
    associatedMedia: {
      "@type": "MediaObject",
      contentUrl: urlGuideIa(SITE_URL),
      encodingFormat: "application/pdf",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      seller: { "@id": `${SITE_URL}/#organization` },
    },
    hasPart: t.sommaire.chapitres.map((c, idx) => ({
      "@type": "Chapter",
      position: idx + 1,
      name: c.titre,
      pageStart: c.page,
      pageEnd: c.fin,
      pagination: `${c.page}-${c.fin}`,
      isPartOf: { "@id": `${SITE_URL}/${locale}/guide-ia#guide` },
    })),
  } as const;

  // Nœud WebPage — porteur du `speakable` (h1). Titre et description = ceux de
  // la metadata, sans réécriture.
  const primaryImage = buildPrimaryImageOfPage("/guide-ia");
  const webPageJsonLd = buildWebPageJsonLd({
    locale: loc,
    path: "/guide-ia",
    name: t.meta.title,
    description: t.meta.description,
    speakable: true,
    ...(primaryImage ? { extra: { primaryImageOfPage: primaryImage } } : {}),
  });
  const faqJsonLd = buildFaqJsonLd({
    items: t.faq.items,
    authorId: `${SITE_URL}/#organization`,
  });
  const imagesJsonLd = buildPageImageGraphJsonLd({ locale: loc, path: "/guide-ia" });

  return (
    <>
      <Container className="border-border border-b py-2.5 sm:py-3">
        <Breadcrumbs items={[{ href: "/guide-ia", label: t.filAriane }]} />
      </Container>

      {/* ── S1 · Premier écran : couverture, titre, promesse, formulaire ───────
          Mobile : couverture à GAUCHE du titre (84 px), puis promesse puis
          formulaire, pleine largeur. Desktop : couverture en grand à droite,
          sur trois rangées. Une seule <Image>, placée par la grille : pas de
          double téléchargement, dimensions fixes (CLS 0). */}
      <section className="bg-halo-warm text-fg" aria-labelledby="guide-titre">
        <Container className="pt-3.5 pb-8 sm:pt-10 sm:pb-14 lg:pt-16 lg:pb-20">
          <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-x-4 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-x-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:gap-x-16">
            <div className="col-start-1 row-start-1 lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:self-center">
              <Image
                src={COUVERTURE_GUIDE.src}
                width={COUVERTURE_GUIDE.width}
                height={COUVERTURE_GUIDE.height}
                alt={t.hero.altCouverture}
                preload
                sizes="(min-width: 1024px) 400px, (min-width: 640px) 120px, 84px"
                className="h-auto w-full rounded-[3px] shadow-[0_10px_24px_-8px_rgb(40_20_10/0.45)] ring-1 ring-black/5 lg:rotate-[1.5deg] lg:rounded-md lg:shadow-[0_32px_64px_-24px_rgb(40_20_10/0.55)]"
              />
            </div>

            <div className="col-start-2 row-start-1 self-center lg:col-start-1">
              <p className="text-terracotta text-[11px] font-semibold tracking-[0.14em] uppercase sm:text-[13px]">
                <span className="sm:hidden">{t.hero.surtitreCourt}</span>
                <span className="hidden sm:inline">{t.hero.surtitre}</span>
              </p>
              <h1
                id="guide-titre"
                className="text-fg mt-1.5 text-[1.75rem] leading-[1.06] font-medium tracking-[-0.02em] sm:mt-3 sm:text-5xl lg:text-[3.75rem]"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {/* « 40 pages » sur sa propre ligne, en accent : le « · » ne
                    tombe plus seul en début de ligne. Le texte du titre reste
                    `t.hero.titre` pour les lecteurs d'écran et les moteurs. */}
                <span className="sr-only">{t.hero.titre}</span>
                <span aria-hidden="true">
                  {titreAvant}
                  {titreApres ? (
                    <span className="text-terracotta block italic">{titreApres}</span>
                  ) : null}
                </span>
              </h1>
            </div>

            <p className="text-fg-soft col-span-2 row-start-2 mt-3 text-[0.9375rem] leading-snug sm:mt-5 sm:text-lg sm:leading-relaxed lg:col-span-1 lg:col-start-1 lg:max-w-xl lg:text-xl">
              {t.hero.promesse} <strong className="text-fg font-semibold">{t.hero.envoi}</strong>
            </p>

            <div
              id={ANCRE_FORMULAIRE}
              {...{ [ATTRIBUT_FORMULAIRE_GUIDE]: "" }}
              className="col-span-2 row-start-3 mt-3.5 max-w-md sm:mt-7 lg:col-span-1 lg:col-start-1"
            >
              <NewsletterForm source="guide-ia" libelles={libellesGuide} />
            </div>

            <ul className="text-fg-soft col-span-2 row-start-4 mt-6 hidden flex-wrap gap-x-5 gap-y-2 text-sm sm:flex lg:col-span-1 lg:col-start-1">
              {t.hero.reperes.map((r) => (
                <li key={r} className="inline-flex items-center gap-1.5">
                  <Check aria-hidden="true" className="text-terracotta h-4 w-4" strokeWidth={2.5} />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* ── S2 · Ce qui se passe ensuite ─────────────────────────────────── */}
      <section className="border-border bg-paper border-y" aria-labelledby="guide-ensuite">
        <Container className="py-10 sm:py-14">
          <h2
            id="guide-ensuite"
            className="text-fg text-xl font-semibold tracking-tight sm:text-2xl"
          >
            {t.ensuite.titre}
          </h2>
          <ol className="mt-6 grid gap-5 sm:grid-cols-3 sm:gap-8">
            {t.ensuite.etapes.map(([titre, detail], i) => (
              <li key={titre} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="bg-terracotta text-mocha-fg grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums"
                >
                  {i + 1}
                </span>
                <div>
                  <p className="text-fg font-semibold">{titre}</p>
                  <p className="text-fg-soft mt-1 text-sm leading-relaxed">{detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-fg-muted mt-6 max-w-3xl text-sm leading-relaxed">{t.ensuite.lettre}</p>
        </Container>
      </section>

      {/* ── S3 · Aperçu : 4 pages réelles, carrousel CSS (zéro JS) ─────────── */}
      <section className="bg-bg text-fg" aria-labelledby="guide-apercu">
        <Container className="py-14 sm:py-20 lg:py-24">
          <SurTitre>{t.apercu.surtitre}</SurTitre>
          <TitreSection id="guide-apercu">{t.apercu.titre}</TitreSection>
          <p className="text-fg-soft mt-3 max-w-2xl text-base sm:text-lg">{t.apercu.intro}</p>
          <ul
            tabIndex={0}
            aria-label={t.apercu.titre}
            className="-mx-4 mt-8 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:thin] gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:px-0"
          >
            {t.apercu.pages.map((p) => (
              <li key={p.page} className="w-[72%] shrink-0 snap-start sm:w-[44%] lg:w-auto">
                <figure>
                  <Image
                    src={p.src}
                    width={APERCU_DIMENSIONS.width}
                    height={APERCU_DIMENSIONS.height}
                    alt={p.alt}
                    sizes="(min-width: 1024px) 300px, (min-width: 640px) 44vw, 72vw"
                    className="border-border h-auto w-full rounded-md border bg-white shadow-[0_12px_32px_-16px_rgb(40_20_10/0.35)]"
                  />
                  <figcaption className="mt-3">
                    <span className="text-terracotta text-xs font-semibold tabular-nums">
                      {t.sommaire.pageAbrege} {p.page}
                    </span>
                    <span className="text-fg block font-semibold">{p.titre}</span>
                    <span className="text-fg-soft block text-sm leading-relaxed">{p.legende}</span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ── S4 · Les 13 outils à recopier ────────────────────────────────── */}
      <section className="bg-sand text-fg" aria-labelledby="guide-outils">
        <Container className="py-14 sm:py-20 lg:py-24">
          <SurTitre>{t.outils.surtitre}</SurTitre>
          <TitreSection id="guide-outils">{t.outils.titre}</TitreSection>
          <p className="text-fg-soft mt-3 max-w-2xl text-base sm:text-lg">{t.outils.intro}</p>
          <ol className="mt-8 grid gap-x-10 sm:grid-cols-2">
            {t.outils.liste.map(([outil, page]) => (
              <li
                key={outil}
                className="border-border-strong/40 flex items-baseline gap-3 border-b py-3"
              >
                <Check
                  aria-hidden="true"
                  className="text-terracotta h-4 w-4 shrink-0 translate-y-0.5"
                  strokeWidth={2.5}
                />
                <span className="text-fg flex-1">{outil}</span>
                <span className="text-fg-muted text-sm tabular-nums">
                  {t.sommaire.pageAbrege} {page}
                </span>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ── S5 · Sommaire réel, chapitres repliables (<details>, zéro JS) ─── */}
      <section className="bg-bg text-fg" aria-labelledby="guide-sommaire">
        <Container className="py-14 sm:py-20 lg:py-24">
          <div className="max-w-3xl">
            <SurTitre>{t.sommaire.surtitre}</SurTitre>
            <TitreSection id="guide-sommaire">{t.sommaire.titre}</TitreSection>
            <ul className="border-border mt-8 border-t">
              {t.sommaire.avant.map(([titre, page]) => (
                <li
                  key={titre}
                  className="border-border text-fg-soft flex items-baseline justify-between gap-4 border-b py-3"
                >
                  <span>{titre}</span>
                  <span className="text-fg-muted text-sm tabular-nums">
                    {t.sommaire.pageAbrege} {page}
                  </span>
                </li>
              ))}
            </ul>
            <ol>
              {t.sommaire.chapitres.map((c) => (
                <li key={c.numero} className="border-border border-b">
                  {c.parties.length > 0 ? (
                    <details className="group">
                      <summary className="flex min-h-12 cursor-pointer list-none items-baseline gap-3 py-3.5 [&::-webkit-details-marker]:hidden">
                        <span className="text-terracotta w-7 shrink-0 font-mono text-sm font-semibold tabular-nums">
                          {c.numero}
                        </span>
                        <span className="text-fg flex-1 font-semibold">{c.titre}</span>
                        <span className="text-fg-muted text-sm tabular-nums">
                          {t.sommaire.pageAbrege} {c.page}
                        </span>
                        <ChevronDown
                          aria-hidden="true"
                          className="text-fg-muted h-4 w-4 shrink-0 translate-y-0.5 transition-transform group-open:rotate-180"
                        />
                      </summary>
                      <ul className="pb-4 pl-10">
                        {c.parties.map(([partie, page]) => (
                          <li
                            key={partie}
                            className="text-fg-soft flex items-baseline justify-between gap-4 py-1.5 text-sm"
                          >
                            <span>{partie}</span>
                            <span className="text-fg-muted tabular-nums">{page}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <div className="flex items-baseline gap-3 py-3.5">
                      <span className="text-terracotta w-7 shrink-0 font-mono text-sm font-semibold tabular-nums">
                        {c.numero}
                      </span>
                      <span className="text-fg flex-1 font-semibold">{c.titre}</span>
                      <span className="text-fg-muted text-sm tabular-nums">
                        {t.sommaire.pageAbrege} {c.page}
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      {/* ── S6 · Pour qui, en combien de temps (p. 4 et p. 5 du guide) ─────── */}
      <section className="bg-halo-warm text-fg" aria-labelledby="guide-pour-qui">
        <Container className="py-14 sm:py-20 lg:py-24">
          <SurTitre>{t.pourQui.surtitre}</SurTitre>
          <TitreSection id="guide-pour-qui">{t.pourQui.titre}</TitreSection>
          <p className="text-fg-soft mt-3 max-w-3xl text-base leading-relaxed sm:text-lg">
            {t.pourQui.intro}
          </p>
          <ul className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
            {t.pourQui.cartes.map((c) => (
              <li
                key={c.taille}
                className="border-border bg-paper border-t-terracotta flex flex-col rounded-xl border border-t-4 p-5 sm:p-6"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-fg text-lg font-semibold">{c.taille}</p>
                  <p className="text-fg-muted text-xs">{c.effectif}</p>
                </div>
                <p className="text-terracotta mt-1 text-sm font-semibold">{c.duree}</p>
                <p className="text-fg-muted mt-4 text-xs font-medium tracking-[0.08em] uppercase">
                  {t.pourQui.lundi}
                </p>
                <p className="text-fg-soft mt-1.5 text-sm leading-relaxed">{c.lundi}</p>
              </li>
            ))}
          </ul>
          <p className="text-fg-muted mt-5 text-sm">{t.pourQui.tpe}</p>
        </Container>
      </section>

      {/* ── S7 · Pourquoi s'y fier (fiche du guide, p. 2) — aucune preuve inventée */}
      <section className="bg-bg text-fg" aria-labelledby="guide-croire">
        <Container className="py-14 sm:py-20 lg:py-24">
          <SurTitre>{t.croire.surtitre}</SurTitre>
          <TitreSection id="guide-croire">{t.croire.titre}</TitreSection>
          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-16">
            <div>
              <ul className="space-y-5">
                {t.croire.points.map(([titre, texte]) => (
                  <li key={titre} className="flex gap-3">
                    <Check
                      aria-hidden="true"
                      className="text-terracotta mt-1 h-5 w-5 shrink-0"
                      strokeWidth={2.5}
                    />
                    <p className="text-fg-soft leading-relaxed">
                      <strong className="text-fg font-semibold">{titre}</strong> {texte}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="text-fg mt-8 text-sm font-semibold">{t.croire.sourcesTitre}</p>
              <ul className="text-fg-soft mt-2 space-y-1.5 text-sm leading-relaxed">
                {t.croire.sources.map((s) => (
                  <li key={s.libelle}>
                    {s.href ? (
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer external"
                        className="text-fg underline underline-offset-2"
                      >
                        {s.libelle}
                      </a>
                    ) : (
                      s.libelle
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-border bg-paper self-start rounded-xl border p-5 sm:p-6">
              <p className="text-fg font-semibold">{t.croire.ficheTitre}</p>
              <dl className="mt-3 text-sm">
                {t.croire.fiche.map(([cle, valeur]) => (
                  <div
                    key={cle}
                    className="border-border grid grid-cols-[88px_minmax(0,1fr)] gap-3 border-t py-2.5 first:border-t-0"
                  >
                    <dt className="text-fg-muted">{cle}</dt>
                    <dd className="text-fg">{valeur}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Container>
      </section>

      {/* ── S8 · Second formulaire ───────────────────────────────────────── */}
      <section className="bg-sand text-fg" aria-labelledby="guide-second">
        <Container className="py-14 sm:py-20">
          <div className="border-border bg-paper mx-auto grid max-w-3xl gap-6 rounded-2xl border p-5 shadow-[0_24px_48px_-32px_rgb(40_20_10/0.35)] sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-8 sm:p-8">
            <Image
              src={COUVERTURE_GUIDE.src}
              width={COUVERTURE_GUIDE.width}
              height={COUVERTURE_GUIDE.height}
              alt=""
              sizes="140px"
              className="hidden h-auto w-full rounded-[3px] shadow-[0_10px_24px_-8px_rgb(40_20_10/0.45)] sm:block"
            />
            <div>
              <h2 id="guide-second" className="text-fg text-2xl font-semibold tracking-tight">
                {t.second.titre}
              </h2>
              <p className="text-fg-soft mt-1.5 text-sm leading-relaxed sm:text-base">
                {t.second.texte}
              </p>
              <div
                id={`${ANCRE_FORMULAIRE}-bas`}
                {...{ [ATTRIBUT_FORMULAIRE_GUIDE]: "" }}
                className="mt-5"
              >
                <NewsletterForm source="guide-ia-bas" libelles={libellesGuide} />
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ── S9 · FAQ (balisée FAQPage) ───────────────────────────────────── */}
      <section className="bg-bg text-fg" aria-labelledby="guide-faq">
        <Container className="py-14 sm:py-20 lg:py-24">
          <div className="max-w-3xl">
            <SurTitre>{t.faq.surtitre}</SurTitre>
            <TitreSection id="guide-faq">{t.faq.titre}</TitreSection>
            <div className="border-border mt-8 border-t">
              {t.faq.items.map((q) => (
                <details key={q.question} className="group border-border border-b">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center gap-4 py-4 [&::-webkit-details-marker]:hidden">
                    <span data-faq-q className="text-fg flex-1 font-semibold">
                      {q.question}
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className="text-fg-muted h-5 w-5 shrink-0 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <p data-faq-a className="text-fg-soft pb-5 leading-relaxed">
                    {q.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ── S10 · Et après la lecture ? (p. 40 du guide) ─────────────────── */}
      <section className="bg-mocha-rich text-mocha-fg" aria-labelledby="guide-suite">
        <Container className="py-14 pb-24 sm:py-20 md:pb-20 lg:py-24">
          <p className="text-mocha-fg/70 text-[12px] font-medium tracking-[0.16em] uppercase sm:text-[13px]">
            <span
              aria-hidden="true"
              className="bg-terracotta-soft mr-2.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            {t.suite.surtitre}
          </p>
          <h2
            id="guide-suite"
            className="text-mocha-fg mt-3 text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.08] font-semibold tracking-tight"
          >
            {t.suite.titre}
          </h2>
          <p className="text-mocha-fg/85 mt-3 max-w-2xl">{t.suite.intro}</p>
          <ol className="mt-8 grid gap-4 md:grid-cols-2 md:gap-6">
            {[
              { ...t.suite.diagnostic, href: "/diagnostic" as const, n: "01", principal: true },
              { ...t.suite.appel, href: "/appel" as const, n: "02", principal: false },
            ].map((e) => (
              <li
                key={e.n}
                className="border-t-terracotta flex flex-col rounded-xl border border-t-4 border-white/10 bg-white/5 p-5 sm:p-6"
              >
                <span className="text-terracotta-on-mocha font-mono text-2xl font-semibold">
                  {e.n}
                </span>
                <p className="mt-2 text-lg font-semibold">{e.titre}</p>
                <p className="text-mocha-fg/85 mt-1.5 flex-1 text-sm leading-relaxed">{e.texte}</p>
                <div className="mt-5">
                  <Cta
                    href={e.href}
                    variant={e.principal ? "terracotta" : "ghost"}
                    className={
                      e.principal
                        ? undefined
                        : "text-mocha-fg border border-white/40 hover:bg-white/10"
                    }
                    track={`guide-ia-suite-${e.href.slice(1)}`}
                  >
                    {e.cta}
                  </Cta>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <BarreGuideCollante libelle={t.barre.libelle} cta={t.barre.cta} cible={ANCRE_FORMULAIRE} />

      <JsonLd data={webPageJsonLd} />
      <JsonLd data={guideJsonLd} />
      <JsonLd data={faqJsonLd} />
      {imagesJsonLd ? <JsonLd data={imagesJsonLd} /> : null}
    </>
  );
}
