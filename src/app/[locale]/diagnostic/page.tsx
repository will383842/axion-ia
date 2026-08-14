// Page d'atterrissage publicitaire (`/[locale]/diagnostic`).
//
// ── Sa place dans le tunnel ───────────────────────────────────────────────
//   publicité vidéo Facebook → CETTE page → `/simulateur` → rapport → e-mail
//
// Elle ne contient PAS le simulateur (cf. version précédente — inchangé).
//
// ── Refonte 2026-08-14 : le format complet des pages de vente vidéo ───────
// Will : « il faut exactement le même type de mise en page » que la référence
// lm.entrepreneurs.com/clients-illimites (structure relevée écran par écran :
// marque → bande de confiance → pastille d'audience → accroche → vidéo → CTA
// → qu'est-ce que c'est → ce qui change → contenu détaillé → témoignages →
// secteurs → garantie → fondateur → FAQ → CTA final, le même bouton répété
// entre chaque bloc, aucune sortie latérale).
//
// Trois écarts DÉLIBÉRÉS avec la référence, tous à la demande de Will :
//   1. Aucun compteur de rareté (« il ne reste que 2 accès ») : une urgence
//      fabriquée sur un diagnostic gratuit serait trompeuse (art. L121-2).
//   2. Aucun « satisfait ou remboursé » : rien n'est vendu ici, et une
//      garantie de résultat contredirait les CGV (obligation de moyens).
//      À la place : quatre engagements réels, tenables séance tenante.
//   3. Aucun chiffre de notoriété inventé (« +12000 entrepreneurs ») : la
//      bande de confiance affiche la note et le compte RÉELS des avis
//      clients vérifiés, lus en base au rendu.
//
// ── Données ───────────────────────────────────────────────────────────────
// Trois lectures DB (note agrégée, 6 avis mis en avant, facettes secteur),
// toutes stub-aware : au build GH Actions elles rendent vide et les blocs
// correspondants ne s'affichent pas ; l'ISR (revalidate 3600) les repeuple en
// production sous une heure. Chaque bloc DB est donc GATÉ sur son contenu —
// un mur de témoignages vide serait pire qu'absent.
//
// Server Component ; seuls `VslVideo` et `VslCta` portent du JS.

import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { BadgeCheck, Check, Clock, Quote, ShieldCheck } from "lucide-react";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Link } from "@/i18n/navigation";
import { VslVideo } from "@/components/lp/VslVideo";
import { VslCta } from "@/components/lp/VslCta";
import { StarRating } from "@/components/reviews/StarRating";
import { ReviewAvatar } from "@/components/reviews/ReviewAvatar";
import { reviewAuthorName, reviewMetaLine } from "@/lib/reviews/display";
import { clientSectorLabel } from "@/content/sectors";
import { getAggregateRating, getPublishedReviews, getSectorFacets } from "@/server/reviews/queries";
import { VSL_CONTENT, VSL_VIDEO } from "@/content/lp/diagnostic";

interface Props {
  params: Promise<{ locale: string }>;
}

const SIMULATOR_HREF = "/simulateur";

/** En dessous, une note agrégée est du bruit ; même seuil que le hub /avis. */
const MIN_REVIEWS_FOR_BAND = 5;

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Quelles tâches votre entreprise peut arrêter de faire à la main · Axion-IA",
  description:
    "Un diagnostic de trois minutes : vos premières tâches à automatiser, le temps et l'argent récupérables, la feuille de route. Gratuit, sans inscription.",
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** Titre de section du tunnel — centré, blanc sur l'encre. */
function VslH2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-mocha-fg text-center text-[24px] leading-tight font-bold tracking-tight text-balance sm:text-[30px]"
    >
      {children}
    </h2>
  );
}

/** Le même bouton, répété entre les blocs — seul `placement` change. */
function CtaRow({ placement }: { placement: string }) {
  return (
    <div className="mt-10 flex flex-col items-center gap-3">
      <VslCta
        href={SIMULATOR_HREF}
        label={VSL_CONTENT.ctaPrimary}
        placement={placement}
        landing={VSL_CONTENT.slug}
      />
      <p className="text-mocha-fg-muted flex items-center gap-2 text-center text-[13px] leading-snug">
        <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        {VSL_CONTENT.ctaHint}
      </p>
    </div>
  );
}

export default async function DiagnosticLandingPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const c = VSL_CONTENT;

  // Trois lectures indépendantes, en parallèle. Stub-aware : vides au build.
  //
  // 🔴 Une panne de base ne doit JAMAIS casser cette page : c'est une page
  // publicitaire, payée au clic. Sans ce repli, une base injoignable rendrait
  // un 500 au visiteur — la preuve sociale disparaît, le tunnel survit.
  const [aggregate, reviewsResult, sectorFacets] = await Promise.all([
    getAggregateRating().catch(() => null),
    getPublishedReviews({ sort: "featured", pageSize: 6 }).catch(() => null),
    getSectorFacets().catch(() => []),
  ]);
  const reviews = reviewsResult?.items ?? [];
  const showBand = aggregate !== null && aggregate.reviewCount >= MIN_REVIEWS_FOR_BAND;

  return (
    <div className="axion-vsl-shell bg-vsl min-h-screen">
      <Container className="max-w-3xl px-5 pt-6 pb-16 sm:pt-10">
        {/* ── Marque, sans navigation ───────────────────────────────────── */}
        <p className="text-mocha-fg text-center text-[15px] font-bold tracking-[0.2em] uppercase">
          Axion<span className="text-terracotta-on-mocha">-</span>IA
        </p>

        {/* ── Bande de confiance ────────────────────────────────────────── */}
        {/* La note et le compte RÉELS, lus en base — jamais un chiffre posé
            dans la copie, qui mentirait dès le prochain avis. Masquée sous
            5 avis et au build (stub) : une bande vide détruirait la page. */}
        {showBand ? (
          <p className="text-mocha-fg mx-auto mt-4 flex w-fit items-center gap-2.5 text-[13.5px] font-semibold">
            <StarRating value={aggregate.ratingValue} size={15} />
            <span>
              {aggregate.ratingValue.toLocaleString("fr-FR")} / 5 ·{" "}
              {aggregate.reviewCount.toLocaleString("fr-FR")} avis clients vérifiés
            </span>
          </p>
        ) : null}

        {/* ── Qualification de l'audience ───────────────────────────────── */}
        <p className="border-border-on-mocha bg-mocha/60 text-mocha-fg mx-auto mt-5 flex w-fit items-center gap-2 rounded-full border px-3.5 py-1.5 text-center text-[12.5px] leading-snug font-semibold">
          <span
            aria-hidden="true"
            className="bg-terracotta-on-mocha h-1.5 w-1.5 shrink-0 rounded-full"
          />
          {c.eyebrow}
        </p>

        {/* ── Accroche ──────────────────────────────────────────────────── */}
        <h1 className="text-mocha-fg mt-6 text-center text-[30px] leading-[1.14] font-bold tracking-tight text-balance sm:text-[44px]">
          {c.title.lead}{" "}
          <span className="decoration-terracotta-on-mocha underline decoration-[3px] underline-offset-[6px]">
            {c.title.underlined}
          </span>{" "}
          {c.title.tail}{" "}
          <em
            className="text-terracotta-on-mocha not-italic"
            style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
          >
            {c.title.accent}
          </em>
        </h1>

        {/* ── Objections levées d'avance ────────────────────────────────── */}
        <p className="text-mocha-fg-muted mx-auto mt-5 max-w-xl text-center text-[16px] leading-relaxed text-pretty sm:text-[17px]">
          <strong className="text-mocha-fg font-bold">{c.subtitle.strong}</strong> {c.subtitle.rest}
        </p>

        {/* ── Preuves ───────────────────────────────────────────────────── */}
        <ul role="list" className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2">
          {c.proofs.map((proof) => (
            <li key={proof.label} className="flex items-center gap-1.5">
              <Check
                aria-hidden="true"
                className="text-terracotta-on-mocha h-3.5 w-3.5 shrink-0"
                strokeWidth={3}
              />
              <span className="text-mocha-fg text-[13px] leading-none font-semibold">
                {proof.label}
              </span>
            </li>
          ))}
        </ul>

        {/* ── Vidéo ─────────────────────────────────────────────────────── */}
        {VSL_VIDEO ? (
          <VslVideo
            src={VSL_VIDEO.src}
            poster={VSL_VIDEO.poster}
            durationLabel={VSL_VIDEO.durationLabel}
            label={c.videoLabel}
            landing={c.slug}
            className="mt-9"
          />
        ) : null}

        {/* ── Appel à l'action principal ────────────────────────────────── */}
        <div className="mt-9 flex flex-col items-center gap-3">
          <VslCta
            href={SIMULATOR_HREF}
            label={c.ctaPrimary}
            placement={VSL_VIDEO ? "sous-video" : "hero"}
            landing={c.slug}
          />
          <p className="text-mocha-fg-muted flex items-center gap-2 text-center text-[13px] leading-snug">
            <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            {c.ctaHint}
          </p>
        </div>

        {/* ── Qu'est-ce que c'est + méthode en trois temps ──────────────── */}
        <section aria-labelledby="vsl-quoi" className="mt-16">
          <VslH2 id="vsl-quoi">{c.what.title}</VslH2>
          <p className="text-mocha-fg-muted mx-auto mt-4 max-w-xl text-center text-[15.5px] leading-relaxed text-pretty">
            {c.what.intro}
          </p>
          <ol role="list" className="mx-auto mt-8 flex max-w-xl flex-col gap-4">
            {c.what.steps.map((step) => (
              <li
                key={step.tag}
                className="border-border-on-mocha bg-mocha/50 rounded-2xl border p-5"
              >
                <p className="text-terracotta-on-mocha text-[11.5px] font-bold tracking-[0.14em]">
                  {step.tag}
                </p>
                <h3 className="text-mocha-fg mt-1.5 text-[17px] leading-snug font-bold">
                  {step.name}
                </h3>
                <p className="text-mocha-fg-muted mt-1.5 text-[14.5px] leading-relaxed">
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
          <CtaRow placement="apres-methode" />
        </section>

        {/* ── Ce qui change pour vous ───────────────────────────────────── */}
        <section aria-labelledby="vsl-change" className="mt-16">
          <VslH2 id="vsl-change">{c.outcomes.title}</VslH2>
          <ul role="list" className="mx-auto mt-7 flex max-w-xl flex-col gap-3">
            {c.outcomes.items.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="bg-terracotta text-paper mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span className="text-mocha-fg text-[15.5px] leading-snug text-pretty">{item}</span>
              </li>
            ))}
          </ul>
          <p
            className="text-terracotta-on-mocha mx-auto mt-6 max-w-xl text-center text-[17px] leading-snug font-semibold"
            style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
          >
            {c.outcomes.kicker}
          </p>
        </section>

        {/* ── Ce que vous obtenez, en détail ────────────────────────────── */}
        <section aria-labelledby="vsl-obtenir" className="mt-16">
          <VslH2 id="vsl-obtenir">Ce que vous obtenez au bout</VslH2>
          <ul role="list" className="mx-auto mt-7 flex max-w-xl flex-col gap-4">
            {c.deliverablesDetailed.map((item) => (
              <li
                key={item.name}
                className="border-border-on-mocha bg-mocha/50 flex items-start gap-3.5 rounded-2xl border p-5"
              >
                <span
                  aria-hidden="true"
                  className="bg-terracotta text-paper mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-mocha-fg text-[16px] leading-snug font-bold">{item.name}</h3>
                  <p className="text-mocha-fg-muted mt-1 text-[14px] leading-relaxed">
                    {item.text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <CtaRow placement="apres-obtenir" />
        </section>

        {/* ── Témoignages ───────────────────────────────────────────────── */}
        {/* Six avis clients réels — déposés, modérés, vérifiés — lus en base.
            🔴 AUCUN lien vers /avis : sur une page de tunnel, chaque sortie
            latérale est un visiteur perdu. Les cartes sont donc muettes, sans
            le lien étiré de `ReviewCard`. Bloc entier masqué si vide (build
            stub, ou base sans avis). */}
        {reviews.length > 0 ? (
          <section aria-labelledby="vsl-avis" className="mt-16">
            <VslH2 id="vsl-avis">{c.reviewsTitle}</VslH2>
            {showBand ? (
              <p className="text-mocha-fg-muted mt-3 text-center text-[13.5px]">
                {aggregate.ratingValue.toLocaleString("fr-FR")} / 5 sur{" "}
                {aggregate.reviewCount.toLocaleString("fr-FR")} avis vérifiés
              </p>
            ) : null}
            <ul role="list" className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {reviews.map((review) => {
                const author = reviewAuthorName(review);
                const meta = reviewMetaLine(review);
                return (
                  <li
                    key={review.id}
                    className="border-border-on-mocha bg-mocha/50 flex h-full flex-col rounded-2xl border p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <StarRating value={review.rating} size={14} />
                      {review.isVerified ? (
                        <span className="text-terracotta-on-mocha inline-flex items-center gap-1 text-[11.5px] font-semibold">
                          <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
                          Vérifié
                        </span>
                      ) : null}
                    </div>
                    <p className="text-mocha-fg mt-3 line-clamp-5 text-[14px] leading-relaxed">
                      {review.comment}
                    </p>
                    <footer className="mt-auto flex items-center gap-2.5 pt-4">
                      <ReviewAvatar name={author} size={36} />
                      <div className="min-w-0">
                        <p className="text-mocha-fg truncate text-[13.5px] font-semibold">
                          {author}
                        </p>
                        {meta ? (
                          <p className="text-mocha-fg-muted truncate text-[12px]">{meta}</p>
                        ) : null}
                      </div>
                    </footer>
                  </li>
                );
              })}
            </ul>
            <CtaRow placement="apres-avis" />
          </section>
        ) : null}

        {/* ── Secteurs ──────────────────────────────────────────────────── */}
        {/* Les dix secteurs avec, pour chacun, le compte RÉEL d'avis publiés.
            La référence répond à « est-ce que ça marche dans mon industrie ? »
            par une affirmation ; nous y répondons par un décompte. */}
        {sectorFacets.length > 0 ? (
          <section aria-labelledby="vsl-secteurs" className="mt-16">
            <VslH2 id="vsl-secteurs">{c.sectorsBlock.title}</VslH2>
            <p className="text-mocha-fg-muted mx-auto mt-4 max-w-xl text-center text-[15px] leading-relaxed text-pretty">
              {c.sectorsBlock.intro}
            </p>
            <ul
              role="list"
              className="mx-auto mt-7 grid max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2"
            >
              {sectorFacets.map((facet) => (
                <li
                  key={facet.key}
                  className="border-border-on-mocha bg-mocha/50 flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
                >
                  <span className="text-mocha-fg flex min-w-0 items-center gap-2 text-[14px] font-semibold">
                    <Check
                      aria-hidden="true"
                      className="text-terracotta-on-mocha h-3.5 w-3.5 shrink-0"
                      strokeWidth={3}
                    />
                    <span className="truncate">{clientSectorLabel(facet.key)}</span>
                  </span>
                  <span className="text-mocha-fg-muted shrink-0 text-[12px] tabular-nums">
                    {facet.count} avis
                  </span>
                </li>
              ))}
            </ul>
            <CtaRow placement="apres-secteurs" />
          </section>
        ) : null}

        {/* ── Engagements ───────────────────────────────────────────────── */}
        {/* À la place du « satisfait ou remboursé » du format : rien n'est
            vendu ici, et une garantie de résultat contredirait les CGV.
            Quatre engagements réels, chacun vérifiable séance tenante. */}
        <section aria-labelledby="vsl-engagements" className="mt-16">
          <VslH2 id="vsl-engagements">{c.commitments.title}</VslH2>
          <ul role="list" className="mx-auto mt-7 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
            {c.commitments.items.map((item) => (
              <li
                key={item.name}
                className="border-border-on-mocha bg-mocha/50 rounded-2xl border p-5"
              >
                <ShieldCheck aria-hidden="true" className="text-terracotta-on-mocha h-5 w-5" />
                <h3 className="text-mocha-fg mt-2 text-[15.5px] leading-snug font-bold">
                  {item.name}
                </h3>
                <p className="text-mocha-fg-muted mt-1.5 text-[13.5px] leading-relaxed">
                  {item.text}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Fondateur ─────────────────────────────────────────────────── */}
        <section className="border-border-on-mocha mt-16 border-t pt-10">
          <figure className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <Image
              src={c.founder.photo}
              alt={c.founder.photoAlt}
              width={110}
              height={110}
              loading="lazy"
              className="h-[110px] w-[110px] shrink-0 rounded-2xl object-cover"
            />
            <div className="min-w-0">
              <Quote aria-hidden="true" className="text-terracotta-on-mocha h-6 w-6" />
              <blockquote className="text-mocha-fg mt-2 text-[16px] leading-relaxed text-pretty">
                « {c.founder.quote} »
              </blockquote>
              <figcaption className="text-mocha-fg-muted mt-3 text-[13.5px]">
                <span className="text-mocha-fg font-semibold">{c.founder.name}</span> —{" "}
                {c.founder.role}
              </figcaption>
            </div>
          </figure>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────────── */}
        {/* `<details>` pur, zéro JS — même mécanique que la FAQ de /roi, dans
            l'habillage sombre. Pas de JSON-LD FAQPage : la page est noindex,
            un balisage y serait du poids mort. */}
        <section aria-labelledby="vsl-faq" className="mt-16">
          <VslH2 id="vsl-faq">{c.faq.title}</VslH2>
          <ul role="list" className="mx-auto mt-6 max-w-xl">
            {c.faq.items.map((item) => (
              <li key={item.id}>
                <details className="group border-border-on-mocha border-b">
                  <summary className="text-mocha-fg flex cursor-pointer list-none items-start justify-between gap-4 py-4 text-left text-[15px] leading-snug font-semibold">
                    <span className="flex-1">{item.question}</span>
                    <span
                      aria-hidden="true"
                      className="text-terracotta-on-mocha mt-0.5 shrink-0 text-xl leading-none transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="text-mocha-fg-muted pb-5 text-[14px] leading-relaxed">
                    {item.answer}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Appel à l'action final ────────────────────────────────────── */}
        <section aria-labelledby="vsl-final" className="mt-16">
          <VslH2 id="vsl-final">{c.finalTitle}</VslH2>
          <CtaRow placement="bas-de-page" />
        </section>

        {/* ── Mentions ──────────────────────────────────────────────────── */}
        <p className="text-mocha-fg-muted mx-auto mt-12 flex max-w-xl items-start gap-2 text-center text-[12px] leading-relaxed">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{c.legal}</span>
        </p>
        <p className="text-mocha-fg-muted mt-6 text-center text-[12px]">
          <Link href="/mentions-legales" className="hover:text-mocha-fg underline">
            Mentions légales
          </Link>
          <span aria-hidden="true" className="mx-2">
            ·
          </span>
          <Link href="/politique-confidentialite" className="hover:text-mocha-fg underline">
            Confidentialité
          </Link>
        </p>
      </Container>
    </div>
  );
}
