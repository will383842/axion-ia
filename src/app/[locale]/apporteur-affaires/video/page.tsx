// Page VSL de recrutement d'apporteurs — `/fr/apporteur-affaires/video`.
//
// Page d'arrivée de la publicité Facebook / Instagram (plan
// `_PLAN-VSL-TUNNEL-APPORTEURS-2026-10-05`, lot 3). Une colonne, très peu de
// texte, UN bouton répété, un formulaire en deux étapes, et — SI Will a posé les
// fichiers — un film de 80 secondes.
//
// ── Où elle vit, et pourquoi ────────────────────────────────────────────────
// SOUS le segment `/apporteur-affaires` : c'est ce qui lui fait hériter, sans rien
// modifier, du pixel Meta (consentement obligatoire), de la bannière qui nomme
// Meta et du texte de confidentialité (`isRouteTunnelFacebook`). Aucun « facebook »
// dans l'adresse (décision Will du 04/09).
//
// ── Ce qu'elle n'est PAS ────────────────────────────────────────────────────
//  · `noindex`, hors sitemap, liée de nulle part : le trafic arrive par la
//    publicité, jamais par le site. Pas bloquée dans `robots.txt` : le robot de
//    Meta doit pouvoir la lire pour valider l'annonce.
//  · statique (ISR 3600 s) : elle ne lit AUCUNE donnée au rendu. La page de merci,
//    elle, est dynamique (`CALENDLY_APPORTEUR_URL` est lue à l'exécution).
//  · sans photo avant le formulaire : l'élément le plus grand à peindre est le
//    TITRE (texte), donc le LCP ne dépend d'aucune image.
//
// 🔴 Aucun montant en grand, aucun Qualiopi, aucun parrainage, aucun téléphone ;
//    la seule somme vient de `pricing.ts` et reste dans la FAQ (voir le contenu).
// 🔴 « Je candidate » : jamais « recrutement », « poste », « commercial », « vendre ».
// 🔴 RYTHME VERTICAL : chaque `<Section>` porte un `lg:py-*` EXPLICITE (le défaut
//    de `Section.tsx` est `lg:py-36`, `twMerge` ne le remplace que sur le même variant).
//
// Les deux actions du formulaire (`lead-vsl-actions.ts`, PR capture) arrivent à l'île PAR PROPS.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Check, X } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { VslVideoDiffere } from "@/components/lp/VslVideoDiffere";
import { VslCta } from "@/components/lp/VslCta";
import { TunnelFacebookShell } from "@/components/recrutement/TunnelFacebookShell";
import { VslFormulaire } from "@/components/recrutement/VslFormulaire";
import { VslVue } from "@/components/recrutement/VslVue";
import { COMMISSION_FORMATION_PAR_JOURNEE_EUR } from "@/content/pricing";
import {
  VSL_ANCRE,
  VSL_ETAPES,
  VSL_FORMULAIRE,
  VSL_HERO,
  VSL_META,
  VSL_PAS_CA,
  VSL_PAS_POUR_QUI,
  VSL_PATH,
  VSL_POUR_QUI,
  VSL_PREUVES,
  VSL_SLUG,
  VSL_VIDEO_FICHIERS,
  faqVsl,
} from "@/content/recrutement/vsl-apporteur";
import {
  capturerLeadVsl,
  completerLeadVsl,
} from "@/features/commercial-application/lead-vsl-actions";
import { fichierPublicExiste, lireTranscription, videoDisponible } from "@/lib/lp/video-disponible";

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return {
    title: { absolute: VSL_META.title },
    description: VSL_META.description,
    // Page de réception d'une campagne : jamais dans Google. `follow` reste vrai
    // (le robot de Meta lit la page ; aucun lien sortant à cacher).
    robots: { index: false, follow: true },
  };
}

const NBSP = " ";

/** « 500 € » depuis `pricing.ts` — jamais recopié ici. */
function euros(montant: number): string {
  return `${montant.toLocaleString("fr-FR").replace(/ |\s/g, NBSP)}${NBSP}€`;
}

const ANCRE = `${VSL_PATH}#${VSL_ANCRE}`;

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale as Locale);

  const faq = faqVsl(euros(COMMISSION_FORMATION_PAR_JOURNEE_EUR));

  // Le film n'apparaît QUE si ses deux fichiers existent : la page est livrable sans.
  const film = videoDisponible(VSL_VIDEO_FICHIERS);
  const sousTitres =
    film && fichierPublicExiste(VSL_VIDEO_FICHIERS.sousTitres)
      ? { src: VSL_VIDEO_FICHIERS.sousTitres }
      : undefined;
  const transcription = sousTitres ? lireTranscription(VSL_VIDEO_FICHIERS.sousTitres) : [];

  return (
    <TunnelFacebookShell sousTitre="Apporteurs d'affaires">
      <VslVue landing={VSL_SLUG} />

      {/* 1 ── Entrée : promesse, film (s'il existe), UN bouton. */}
      <Section tone="halo-warm" className="pt-8 pb-10 sm:pt-12 sm:pb-12 lg:pt-14 lg:pb-14">
        <div className="mx-auto max-w-2xl text-center">
          <HeroBadge className="mb-5">{VSL_HERO.badge}</HeroBadge>

          <h1 className="display-editorial text-fg text-balance">
            {VSL_HERO.h1}{" "}
            <span
              className="text-terracotta-deep italic"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {VSL_HERO.h1Em}
            </span>
          </h1>

          <p className="text-fg-soft mt-5 text-lg leading-relaxed text-pretty">
            {VSL_HERO.sousTitre}
          </p>

          {film ? (
            <VslVideoDiffere
              src={VSL_VIDEO_FICHIERS.src}
              poster={VSL_VIDEO_FICHIERS.poster}
              durationLabel={VSL_VIDEO_FICHIERS.durationLabel}
              label={VSL_HERO.videoLabel}
              landing={VSL_SLUG}
              ratio="4:5-mobile"
              tone="light"
              suiviProgression
              {...(sousTitres ? { sousTitres } : {})}
              {...(transcription.length > 0 ? { transcription } : {})}
              className="mx-auto mt-8 max-w-md md:max-w-2xl"
            />
          ) : null}

          <div className="mt-8 flex flex-col items-center gap-3">
            <VslCta
              href={ANCRE}
              label={VSL_HERO.cta}
              placement={film ? "sous-video" : "hero"}
              landing={VSL_SLUG}
            />
            <p className="text-fg-soft text-sm font-medium">{VSL_HERO.micro}</p>
          </div>
        </div>
      </Section>

      {/* 2 ── Pour qui : trois pastilles. */}
      <Section className="py-10 sm:py-12 lg:py-14">
        <div className="mx-auto max-w-xl">
          <ul className="space-y-3" role="list">
            {VSL_POUR_QUI.map((t) => (
              <li
                key={t}
                className="border-border bg-paper flex items-start gap-3 rounded-2xl border px-4 py-3.5"
              >
                <Check aria-hidden="true" className="text-sage mt-0.5 h-5 w-5 shrink-0" />
                <span className="text-fg leading-snug font-medium">{t}</span>
              </li>
            ))}
          </ul>
          <p className="text-fg-muted mt-4 text-center text-sm leading-relaxed">
            {VSL_PAS_POUR_QUI}
          </p>
        </div>
      </Section>

      {/* 3 ── Trois étapes. */}
      <Section tone="sand" className="py-10 sm:py-12 lg:py-14">
        <div className="mx-auto max-w-xl">
          <ol className="space-y-4" role="list">
            {VSL_ETAPES.map((e, i) => (
              <li
                key={e.titre}
                className="bg-paper border-border flex gap-4 rounded-2xl border p-5"
              >
                <span
                  aria-hidden="true"
                  className="bg-terracotta-soft text-terracotta-deep flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-serif text-lg font-semibold"
                >
                  {i + 1}
                </span>
                <div>
                  <h2 className="text-fg text-lg font-semibold">{e.titre}</h2>
                  <p className="text-fg-soft mt-1 leading-relaxed">{e.texte}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* 4 ── Ce que ce n'est pas : la section anti-doute. */}
      <Section className="py-10 sm:py-12 lg:py-14">
        <div className="mx-auto max-w-xl">
          <h2 className="text-fg text-center font-serif text-2xl leading-tight font-semibold sm:text-3xl">
            Ce que ce <span className="text-terracotta italic">n&apos;est pas</span>
          </h2>
          <ul className="mt-6 space-y-3" role="list">
            {VSL_PAS_CA.map((t) => (
              <li key={t} className="flex items-start gap-3">
                <X aria-hidden="true" className="text-terracotta mt-0.5 h-5 w-5 shrink-0" />
                <span className="text-fg-soft leading-snug">{t}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex justify-center">
            <VslCta href={ANCRE} label={VSL_HERO.cta} placement="milieu" landing={VSL_SLUG} />
          </div>
        </div>
      </Section>

      {/* 5 ── Preuves honnêtes : ce qui existe réellement, aucune statistique. */}
      <Section tone="sand" className="py-10 sm:py-12 lg:py-14">
        <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-3">
          <div className="bg-paper border-border rounded-2xl border p-5">
            <p className="text-fg font-semibold">{VSL_PREUVES.catalogue.titre}</p>
            <p className="mt-3 text-sm">
              <a
                href="/fr/catalogue"
                target="_blank"
                rel="noopener noreferrer"
                className="text-terracotta-deep underline underline-offset-2"
              >
                {VSL_PREUVES.catalogue.lien}
              </a>
            </p>
          </div>
          <div className="bg-paper border-border rounded-2xl border p-5">
            <p className="text-fg font-semibold">{VSL_PREUVES.commission.titre}</p>
            <p className="text-fg-soft mt-2 text-sm">{VSL_PREUVES.commission.texte}</p>
          </div>
          <div className="bg-paper border-border rounded-2xl border p-5">
            <p className="text-fg font-semibold">{VSL_PREUVES.echange.titre}</p>
          </div>
        </div>
      </Section>

      {/* 6 ── Le formulaire. `scroll-mt` : l'ancre ne cache pas le titre sous la barre. */}
      <Section id={VSL_ANCRE} className="scroll-mt-16 py-10 sm:py-12 lg:py-14">
        <div className="mx-auto max-w-xl">
          <h2 className="text-fg text-center font-serif text-3xl leading-tight font-semibold">
            {VSL_FORMULAIRE.titre}
          </h2>
          <div className="bg-paper border-border shadow-card mt-6 rounded-2xl border p-5 sm:p-7">
            <VslFormulaire capturer={capturerLeadVsl} completer={completerLeadVsl} />
          </div>
        </div>
      </Section>

      {/* 7 ── FAQ — page noindex : pas de JSON-LD. */}
      <FaqBlock
        eyebrow="FAQ"
        title="Questions"
        titleEm="légitimes"
        items={faq}
        emitJsonLd={false}
        tone="sand"
        className="py-10 sm:py-12 lg:py-14"
      />

      <StickyMobileCta
        href={ANCRE}
        label={`${VSL_HERO.cta} →`}
        track="vsl-sticky-cta"
        couleur="terracotta"
      />
    </TunnelFacebookShell>
  );
}
