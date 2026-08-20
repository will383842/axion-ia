/**
 * Fiche d'autorité du fondateur — `/fr/equipe/williams`.
 *
 * Server Component pur (aucun `"use client"`, aucune animation) : la page vise
 * les budgets Web Vitals du dépôt et n'a rien à hydrater. Le seul îlot client
 * est l'accordéon de la FAQ, déjà partagé avec le reste du site.
 *
 * Ce que cette page doit faire, et pourquoi elle est bâtie ainsi :
 *
 *  1. RÉPONDRE AVANT DE VENDRE. Le premier paragraphe est une réponse
 *     auto-portante à « qui est Williams Jullin ? » (`.speakable`,
 *     `itemProp="text"`, `data-answer`) — les trois sélecteurs que
 *     `DEFAULT_SPEAKABLE_SELECTORS` déclare au JSON-LD. Une réponse citable
 *     doit exister dans le HTML, pas seulement dans le schema.
 *  2. ÊTRE EXTRACTIBLE. La fiche d'identité est un `<dl>` : un fait par ligne,
 *     sans phrase à démêler. C'est la forme que les moteurs génératifs
 *     recopient le plus fidèlement.
 *  3. TRANSMETTRE SON AUTORITÉ. Chaque métier renvoie vers SA page de service.
 *     Une page d'entité qui ne pointe nulle part ne sert qu'elle-même.
 *
 * Le JSON-LD (`Person` + `ProfilePage` + `FAQPage`) est émis par la route,
 * pas ici : le composant reste un rendu, la route reste le point d'entrée.
 */

import Image from "next/image";
import {
  ArrowRight,
  Check,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { Cta } from "@/components/marketing/Cta";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Link } from "@/i18n/navigation";
import { FOUNDER } from "@/lib/brand";
import {
  WILLIAMS_CODE,
  WILLIAMS_DOCTRINE,
  WILLIAMS_EXPERTISES,
  WILLIAMS_IDENTITE,
  WILLIAMS_KIT,
  WILLIAMS_LEAD,
  WILLIAMS_METHODE,
  WILLIAMS_PREUVES,
  WILLIAMS_TAGLINE,
} from "@/content/equipe/williams";
import { WILLIAMS_PROFILE } from "@/lib/seo/williams-person";

interface FounderProfileProps {
  /** FAQ déjà filtrée par le drapeau Qualiopi — le composant ne gate rien. */
  readonly faq: ReadonlyArray<{ id: string; question: string; answer: string }>;
  /**
   * `true` uniquement quand la certification Qualiopi est RÉELLEMENT obtenue
   * ET les pages de l'organisme de formation publiques. Conditionne l'unique
   * mention de financement de la page — et le lien vers
   * `/financement-opco-france-travail`, qui répond 404 tant que les deux
   * drapeaux ne sont pas levés : le lien n'existe donc que quand sa cible
   * existe.
   */
  readonly financementPublic: boolean;
}

const PILLS: ReadonlyArray<{ icon: LucideIcon; label: string }> = [
  { icon: MapPin, label: "Toute la France · siège à Grenoble" },
  { icon: Users, label: "De la TPE au grand groupe" },
  { icon: Sparkles, label: "Top 1 % des experts IA en France" },
  { icon: ShieldCheck, label: "Hébergement des données en UE" },
];

export function FounderProfile({ faq, financementPublic }: FounderProfileProps) {
  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="bg-halo-warm text-fg relative pt-10 pb-16 sm:pt-12 sm:pb-20 lg:pt-14 lg:pb-24">
        <Container>
          <HeroBadge className="mb-8 sm:mb-10">
            <span
              aria-hidden="true"
              className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
            />
            Fondateur d&apos;Axion-IA
          </HeroBadge>

          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14 xl:gap-16">
            <div className="max-w-2xl">
              <h1 className="display-editorial text-fg">
                Williams{" "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  Jullin
                </span>
              </h1>
              <p className="text-fg mt-4 text-lg font-semibold sm:text-xl">{FOUNDER.jobTitleFr}</p>
              <p className="text-fg-muted mt-1 text-base">{WILLIAMS_TAGLINE}</p>

              {/*
                Réponse-première. Les trois hameçons (`speakable`, `itemProp`,
                `data-answer`) sont ceux déclarés dans le JSON-LD : si l'un
                d'eux disparaît d'ici, la propriété `speakable` du schema
                désigne un sélecteur vide — une promesse sans objet.
              */}
              <p
                className="speakable text-fg-soft mt-7 text-lg leading-relaxed sm:text-xl"
                itemProp="text"
                data-answer=""
              >
                {WILLIAMS_LEAD}
              </p>

              <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2.5">
                {PILLS.map((pill) => {
                  const Icon = pill.icon;
                  return (
                    <li
                      key={pill.label}
                      className="text-fg-soft inline-flex items-center gap-2 text-sm"
                    >
                      <Icon
                        aria-hidden="true"
                        className="text-terracotta h-4 w-4"
                        strokeWidth={2}
                      />
                      <span>{pill.label}</span>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Cta href="/appel" size="lg" track="equipe-williams-hero-appel">
                  Réserver un appel avec Williams
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Cta>
                <Cta href="/audit" variant="outline" size="lg" track="equipe-williams-hero-audit">
                  Demander un audit IA
                </Cta>
              </div>
            </div>

            {/*
              Portrait = candidat LCP. Conteneur en ratio fixe + `fill` plutôt
              que `width`/`height` + `height:auto` : la seconde forme réserve la
              hauteur seulement une fois la largeur de colonne connue, et c'est
              par là qu'un CLS revient sur une grille responsive.
            */}
            <figure className="mx-auto w-full max-w-sm lg:mx-0 lg:ml-auto lg:max-w-md">
              <div className="border-border bg-paper relative aspect-square w-full overflow-hidden rounded-2xl border">
                <Image
                  src={WILLIAMS_PROFILE.photoUrl1024}
                  alt={`${FOUNDER.fullName}, ${FOUNDER.jobTitleFr}, spécialiste de l'intelligence artificielle en entreprise`}
                  fill
                  sizes="(max-width: 1024px) 90vw, 420px"
                  priority
                  className="object-cover"
                />
              </div>
              <figcaption className="text-fg-muted mt-3 text-center text-sm lg:text-left">
                {FOUNDER.fullName} — {FOUNDER.roleLineFr}
              </figcaption>
            </figure>
          </div>
        </Container>
      </section>

      {/* ── BANDEAU DE PREUVES ───────────────────────────────────────────── */}
      <section className="border-border bg-paper border-y py-10 sm:py-12">
        <Container>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
            {WILLIAMS_PREUVES.map((preuve) => (
              <li key={preuve.chiffre} className="flex flex-col gap-1.5">
                <span
                  className="text-fg text-[clamp(1.25rem,2.4vw,1.75rem)] leading-tight font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {preuve.chiffre}
                </span>
                <span className="text-fg-soft text-sm leading-snug">{preuve.libelle}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ── FICHE D'IDENTITÉ ─────────────────────────────────────────────── */}
      <Section
        eyebrow="En bref"
        title="Fiche"
        titleEm="d'identité"
        description="Les faits, sans emballage — ce que reprennent les moteurs de recherche et les assistants IA quand on leur demande qui pilote Axion-IA."
      >
        <div className="max-w-4xl">
          <p className="text-fg-soft mb-10 text-lg leading-relaxed">{WILLIAMS_DOCTRINE}</p>
          <dl className="border-border grid gap-x-10 border-t sm:grid-cols-2">
            {WILLIAMS_IDENTITE.map((ligne) => (
              <div
                key={ligne.terme}
                className="border-border flex flex-col gap-1 border-b py-4 sm:flex-row sm:gap-6 sm:py-5"
              >
                <dt className="text-fg-muted shrink-0 text-[12px] font-semibold tracking-[0.12em] uppercase sm:w-40 sm:pt-1">
                  {ligne.terme}
                </dt>
                <dd className="text-fg text-base leading-relaxed">{ligne.valeur}</dd>
              </div>
            ))}
          </dl>
          <p className="text-fg-soft mt-6 text-sm">
            Profil professionnel vérifiable :{" "}
            <a
              href={FOUNDER.linkedin}
              rel="me noopener noreferrer"
              target="_blank"
              className="text-terracotta hover:text-terracotta-deep font-medium underline underline-offset-4"
            >
              LinkedIn de {FOUNDER.fullName}
            </a>
            .
          </p>
        </div>
      </Section>

      {/* ── LES CINQ MÉTIERS ─────────────────────────────────────────────── */}
      <Section
        tone="paper"
        eyebrow="Domaines d'intervention"
        title="Cinq métiers,"
        titleEm="une seule exigence"
        description="Chaque mission se juge à ce qu'elle change dans les chiffres de l'entreprise — temps par dossier, coût de traitement, volume absorbé. Le reste est de la démonstration."
      >
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          {WILLIAMS_EXPERTISES.map((expertise, index) => (
            <article
              key={expertise.id}
              id={expertise.id}
              className={[
                "border-border bg-bg flex flex-col rounded-2xl border p-7 sm:p-8",
                // La cinquième carte occupe toute la largeur sur grand écran :
                // une grille à 2 colonnes laisserait sinon un demi-vide.
                index === WILLIAMS_EXPERTISES.length - 1 && WILLIAMS_EXPERTISES.length % 2 === 1
                  ? "lg:col-span-2"
                  : "",
              ].join(" ")}
            >
              <p className="text-fg-muted text-[12px] font-semibold tracking-[0.16em] uppercase">
                {expertise.titre}
              </p>
              <h3
                className="text-fg mt-3 text-2xl leading-snug font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {expertise.promesse}
              </h3>
              <p className="text-fg-soft mt-4 text-base leading-relaxed">{expertise.corps}</p>
              <ul className="mt-6 space-y-3" role="list">
                {expertise.puces.map((puce) => (
                  <li key={puce} className="text-fg-soft flex items-start gap-3 text-sm">
                    <Check
                      aria-hidden="true"
                      className="text-terracotta mt-0.5 h-4 w-4 shrink-0"
                      strokeWidth={2.5}
                    />
                    <span>{puce}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 pt-1">
                <Link
                  href={expertise.href as never}
                  className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                >
                  {expertise.hrefLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                {expertise.hrefSecondaire && expertise.hrefSecondaireLabel ? (
                  <Link
                    href={expertise.hrefSecondaire as never}
                    className="text-fg-muted hover:text-fg text-sm underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {expertise.hrefSecondaireLabel}
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
        {financementPublic ? (
          <p className="text-fg-soft mt-8 text-sm">
            Selon votre situation, une formation IA peut être prise en charge, en tout ou partie,
            par votre OPCO ou par France Travail —{" "}
            <Link
              href="/financement-opco-france-travail"
              className="text-terracotta hover:text-terracotta-deep font-semibold underline underline-offset-4"
            >
              conditions et montage du dossier
            </Link>
            .
          </p>
        ) : null}
      </Section>

      {/* ── CODE vs KIT ──────────────────────────────────────────────────── */}
      <Section
        eyebrow="Parti pris technique"
        title="Du code dont vous êtes"
        titleEm="propriétaire"
        description="Les plateformes d'automatisation en kit rendent le premier scénario facile et le dixième ingérable. Axion-IA développe par défaut, et propose le no-code sur demande — quand vos équipes l'utilisent déjà et veulent le garder."
      >
        <div className="max-w-5xl">
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
            <div className="border-border bg-bg/40 rounded-2xl border border-dashed p-7 sm:p-8">
              <p className="text-fg-muted text-[12px] font-semibold tracking-[0.16em] uppercase">
                L&apos;automatisation en kit
              </p>
              <ul className="mt-6 space-y-4" role="list">
                {WILLIAMS_KIT.map((item) => (
                  <li key={item} className="text-fg-muted flex items-start gap-3 text-sm">
                    <X aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-border-strong bg-paper rounded-2xl border p-7 sm:p-8">
              <p className="text-terracotta text-[12px] font-semibold tracking-[0.16em] uppercase">
                Le code livré par Axion-IA
              </p>
              <ul className="mt-6 space-y-4" role="list">
                {WILLIAMS_CODE.map((item) => (
                  <li key={item} className="text-fg-soft flex items-start gap-3 text-sm">
                    <Check
                      aria-hidden="true"
                      className="text-terracotta mt-0.5 h-4 w-4 shrink-0"
                      strokeWidth={2.5}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      {/* ── MÉTHODE ──────────────────────────────────────────────────────── */}
      <Section
        tone="sand"
        eyebrow="Méthode"
        title="Quatre temps,"
        titleEm="toujours les mêmes"
        description="Le format change avec la taille de l'entreprise. La séquence, non."
      >
        <ol className="grid gap-6 lg:grid-cols-4 lg:gap-8" role="list">
          {WILLIAMS_METHODE.map((etape) => (
            <li key={etape.numero} className="border-border-strong flex flex-col border-t pt-6">
              <span
                className="text-terracotta text-3xl leading-none font-semibold"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {etape.numero}
              </span>
              <h3 className="text-fg mt-4 text-lg font-semibold tracking-tight">{etape.titre}</h3>
              <p className="text-fg-muted mt-1 text-[12px] font-semibold tracking-[0.12em] uppercase">
                {etape.duree}
              </p>
              <p className="text-fg-soft mt-3 text-sm leading-relaxed">{etape.texte}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── ÉQUIPE + COUVERTURE ──────────────────────────────────────────── */}
      <Section eyebrow="Autour de Williams" title="Il ne travaille" titleEm="pas seul">
        <div className="max-w-4xl">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <h3 className="text-fg text-xl font-semibold tracking-tight">
                Une équipe choisie, pas sous-traitée
              </h3>
              <p className="text-fg-soft mt-4 text-base leading-relaxed">
                Axion-IA réunit autour de son fondateur des ingénieurs et des experts en
                intelligence artificielle sélectionnés parmi les meilleurs profils français, issus
                notamment des grandes écoles d&apos;ingénieurs. Chaque mission est menée par les
                personnes que vous rencontrez : pas de commercial entre vous et l&apos;équipe
                technique, pas de junior placé sur un dossier vendu par un senior.
              </p>
              <p className="mt-5">
                <Link
                  href="/a-propos"
                  className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                >
                  L&apos;agence et sa méthode
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </p>
            </div>
            <div>
              <h3 className="text-fg text-xl font-semibold tracking-tight">
                Partout en France, tous secteurs
              </h3>
              <p className="text-fg-soft mt-4 text-base leading-relaxed">
                Le siège est à Grenoble, en Auvergne-Rhône-Alpes ; les missions se mènent dans toute
                la France, sur site — Paris et l&apos;Île-de-France compris — au même tarif public
                qu&apos;ailleurs. Industrie, services, santé, immobilier, juridique, commerce,
                transport, secteur public : la méthode ne change pas, seuls les cas d&apos;usage
                changent.
              </p>
              <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                <Link
                  href="/implantations"
                  className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                >
                  Nos zones d&apos;intervention
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/cas-concrets"
                  className="text-fg-muted hover:text-fg text-sm underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                >
                  Cas concrets
                </Link>
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      {/*
        `emitJsonLd={false}` : la route émet déjà le `FAQPage` dans le `@graph`
        unique de la page. Deux `FAQPage` pour les mêmes questions ne valent pas
        mieux qu'un — ils se dédoublent dans l'index.
      */}
      <FaqBlock
        tone="paper"
        eyebrow="Questions fréquentes"
        title="Ce qu'on demande"
        titleEm="le plus souvent"
        items={faq}
        emitJsonLd={false}
      />

      {/* ── CTA FINAL ────────────────────────────────────────────────────── */}
      <CtaBlock
        eyebrow="Prendre contact"
        title="Trente minutes suffisent pour savoir"
        titleEm="ce que l'IA vous ferait gagner"
        description="Vous exposez votre contexte, Williams vous dit ce qui est réaliste, dans quel ordre et à quel coût — ou vous dit qu'il n'y a rien à faire. Réponse humaine sous 48 heures ouvrées."
        cta={
          <div className="flex flex-wrap items-center gap-4">
            <Cta href="/appel" size="lg" track="equipe-williams-cta-appel">
              Réserver un appel
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta href="/contact" variant="outline" size="lg" track="equipe-williams-cta-contact">
              Écrire à Axion-IA
            </Cta>
          </div>
        }
        tone="mocha"
      />
    </>
  );
}
