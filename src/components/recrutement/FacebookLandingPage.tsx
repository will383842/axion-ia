// Landing du tunnel Facebook apporteurs d'affaires — `/apporteur-affaires` (2026-09-03).
//
// ── Ce qui la distingue des landings d'annonce (`/leboncoin`, `/indeed`) ────
// Là-bas, le visiteur a lu une annonce et vient CANDIDATER : la page l'envoie
// vers le dossier complet. Ici, il vient d'un post, sur son téléphone, sans
// rien avoir décidé : la page doit le convaincre en dix secondes et ne lui
// demander QU'UN geste — laisser quatre champs pour qu'on l'appelle. Le dossier
// complet vient après, par l'e-mail.
//
// Ordre des sections, et pourquoi :
//   1. Héro : la promesse dans SES mots, une action, une photo.
//   2. Bande de confiance : trois faits vérifiables, jamais un slogan.
//   3. LE FORMULAIRE, tout de suite — sur desktop il est visible sans
//      défiler ; sur mobile, chaque bouton de la page y mène (ancre) et le
//      bouton collant reste sous le pouce.
//   4. Comment ça marche (3 étapes) · 5. Combien (exemples de calcul, formulation
//   indicative) · 6. Pour qui / pas pour qui · 7. Cartes sur table (ce que ce
//   n'est pas — la section qui distingue de l'arnaque, et que Meta lit) ·
//   8. Le fondateur (un vrai visage) · 9. FAQ · 10. Dernier appel.
//
// 🔴 `noindex` : page de réception d'une campagne, quasi-doublon de
// `/apporteur-affaires-independant-formation-ia-entreprise`. L'indexer la
// cannibaliserait pour un gain nul. Même arbitrage que `/leboncoin`.
//
// 🔴 GATE QUALIOPI — « certifié Qualiopi » et « finançable OPCO » passent par
// `isQualiopiCertificationObtenue()`, appelé DANS ce fichier, à côté des
// littéraux. Inscrite au registre `ASSERTION_SURFACES` du test
// `assertion-flag-surfaces.spec.ts`.
//
// 🔴 Aucun montant en dur : tout vient de `pricing.ts`. Le reste de la page
// l'écrit « jusqu'à » (W12 : la grille publiée est un plafond) — SAUF le bloc
// du héro, qui affiche le montant NU depuis le 2026-09-04. Exception assumée
// par Will, motivée et chiffrée en tête de `content/recrutement/tunnel-facebook.ts`.
// 🛑 Ne pas l'uniformiser dans un sens ou dans l'autre sans repasser par lui.
//
// Vocabulaire : « apporteur d'affaires », jamais « commercial » / « poste » /
// « recrute ». Décision Will 2026-09-03.
//
// 🔴 RYTHME VERTICAL — chaque `<Section>` porte un `lg:py-*` EXPLICITE. Sans
// lui, le défaut de `Section.tsx` (`lg:py-36` = 144 px) s'applique dès 1024 px
// quel que soit le `py-*` qu'on écrit ici : `twMerge` ne fait gagner sa propre
// valeur que sur le MÊME variant, jamais sur un `lg:` que personne n'a posé.
// `/roi` (page d'atterrissage publicitaire existante) porte déjà ce correctif
// (`lg:py-16` à `lg:py-24`) — c'est le patron repris ici.

import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { BadgeEuro, Check, Handshake, Presentation, X } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { Cta } from "@/components/marketing/Cta";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { memoPhoto, type MemoIserePhotoSlot } from "@/content/recrutement/memo-isere-photos";
import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";
import {
  COMMISSION_FORMATION_PAR_JOURNEE_EUR,
  getCommissionById,
  getTierById,
  AUDIT_TIERS,
} from "@/content/pricing";
import {
  ARGUMENT,
  CARTES_SUR_TABLE,
  CONFIANCE_BASE,
  ETAPES,
  FONDATEUR,
  FORMULAIRE,
  HERO,
  PAS_POUR_QUI,
  POUR_QUI,
  TUNNEL_FACEBOOK_META,
} from "@/content/recrutement/tunnel-facebook";
import { TUNNEL_FACEBOOK_PATH } from "@/lib/commercial-application/lead-apporteur";
import { TunnelFacebookShell } from "./TunnelFacebookShell";
import { LeadApporteurForm } from "./LeadApporteurForm";

/**
 * Mentions AFFIRMANT la certification — servies UNIQUEMENT sous
 * `isQualiopiCertificationObtenue()`, appelé quelques lignes plus bas. Le
 * littéral vit ICI, dans le fichier qui lit le drapeau (leçon du 2026-08-19
 * sur `/memo-isere`).
 */
const CONFIANCE_CERTIFIE: readonly string[] = [
  "Organisme certifié Qualiopi",
  "Formations finançables OPCO",
];

const ANCRE_FORMULAIRE = `${TUNNEL_FACEBOOK_PATH}#contact`;

/**
 * Une icône par étape, dans l'ordre de `ETAPES`. Elles vivent ICI et pas dans
 * le fichier de contenu : un composant React n'a rien à faire dans un module
 * de texte, et la garde `use-client` refuserait de l'y suivre.
 */
const ICONES_ETAPES = [Handshake, Presentation, BadgeEuro] as const;

interface Props {
  params: Promise<{ locale: string }>;
}

const NBSP = " ";

function euros(montant: number): string {
  return `${montant.toLocaleString("fr-FR").replace(/ |\s/g, NBSP)}${NBSP}€`;
}

function commission(jours: number): string {
  return euros(jours * COMMISSION_FORMATION_PAR_JOURNEE_EUR);
}

export async function buildFacebookLandingMetadata(locale: string): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) return {};
  return {
    title: { absolute: TUNNEL_FACEBOOK_META.title },
    description: TUNNEL_FACEBOOK_META.description,
    robots: { index: false, follow: true },
  };
}

/** Photo curée + crédit (CGU Unsplash §9). `ratio` fixe la boîte ⇒ CLS 0. */
function Photo({
  slot,
  alt,
  ratio,
  sizes,
  priority,
  className,
}: {
  slot: MemoIserePhotoSlot;
  alt: string;
  ratio: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const p = memoPhoto(slot);
  return (
    <figure className={className}>
      <div
        className={cn(
          "border-border shadow-card relative overflow-hidden rounded-2xl border",
          ratio,
        )}
      >
        <Image
          src={p.src}
          alt={alt}
          fill
          sizes={sizes}
          {...(priority ? { priority: true } : {})}
          className="object-cover"
        />
      </div>
      <figcaption>
        <UnsplashCredit
          photographerName={p.photographer}
          photographerUrl={p.photographerUrl}
          className="text-right"
        />
      </figcaption>
    </figure>
  );
}

/** Bouton vers le formulaire — pleine largeur sous le pouce, ancre interne. */
function CtaFormulaire({ track, label = HERO.cta }: { track: string; label?: string }) {
  return (
    <Cta
      href={ANCRE_FORMULAIRE}
      size="lg"
      track={track}
      className="w-full shrink-0 justify-center whitespace-nowrap sm:w-auto"
    >
      {label} →
    </Cta>
  );
}

export async function FacebookLandingPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale as Locale);

  const certifie = isQualiopiCertificationObtenue();
  const confiance = [...(certifie ? CONFIANCE_CERTIFIE : []), ...CONFIANCE_BASE];

  // Montants DÉRIVÉS du SSOT — plafonds (W12), jamais une promesse.
  const pctAudit = getCommissionById("com-audit").percent ?? 30;
  const auditTpe = getTierById(AUDIT_TIERS, "audit-flash").priceFlat ?? 0;
  const commissionAuditTpe = Math.round((auditTpe * pctAudit) / 100);

  // Montant du héro. Même dérivation que la FAQ (`commission(1)`), donc les
  // deux ne peuvent pas diverger — c'est précisément l'écart de 150 € qui avait
  // fait passer les barèmes en SSOT. Seule la FORMULATION diffère : le héro
  // l'affiche nu (décision Will 2026-09-04), la FAQ garde « Jusqu'à ».
  const montantJournee = commission(1);

  const faq = [
    {
      id: "quoi",
      question: "Concrètement, je fais quoi ?",
      answer:
        "Tu parles d'Axion-IA à un dirigeant que tu connais et tu nous le signales. On appelle, on chiffre, on forme. Tu ne négocies rien, tu ne signes rien.",
    },
    {
      id: "gains",
      question: "Combien ça rapporte ?",
      answer: `Jusqu'à ${commission(1)} par journée de formation vendue, selon la grille en vigueur. Sur un audit, jusqu'à ${pctAudit} % de la facture. Exemples de calcul, pas une promesse : tout dépend des ventes réellement payées.`,
    },
    {
      id: "ia",
      question: "Il faut connaître l'IA ?",
      answer:
        "Non. Le dirigeant en face n'y connaît rien non plus, c'est pour ça qu'il a besoin de nous. Aucune démo, aucun outil à installer.",
    },
    {
      id: "statut",
      question: "Il faut un statut ?",
      answer:
        "Pour facturer ta commission, oui : micro-entreprise, agent commercial ou société. La création en ligne est gratuite et prend un quart d'heure. Salarié : vérifie qu'aucune clause d'exclusivité ne te l'interdit.",
    },
    {
      id: "paiement",
      question: "Quand suis-je payé ?",
      answer:
        "Quand l'entreprise nous a payés. C'est la règle de l'apport d'affaires : la commission est due à l'encaissement.",
    },
  ];

  return (
    <TunnelFacebookShell sousTitre="Apporteurs d'affaires">
      {/* 1 ── Héro. Sur mobile la photo passe SOUS le bouton. */}
      <Section tone="halo-warm" className="pt-8 pb-10 sm:pt-12 sm:pb-14 lg:pt-16 lg:pb-16">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
          <div>
            <HeroBadge className="mb-5 justify-start">
              <span
                aria-hidden="true"
                className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
              />
              {HERO.badge}
            </HeroBadge>

            <h1 className="display-editorial text-fg text-balance">
              {HERO.h1}{" "}
              <span
                className="text-terracotta-deep italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {HERO.h1Em}
              </span>
            </h1>

            {/* Bloc du montant — l'accroche des deux premières secondes.
                Panneau `bg-ink` DÉLIBÉRÉ : le visiteur arrive d'un fil Facebook
                saturé de blocs clairs ; une surface sombre est ce qui arrête le
                pouce. Contraste AAA vérifié par `pnpm contrast:check`
                (mocha-fg 17,1:1 · mocha-fg-muted 8,3:1 · terracotta-on-mocha 7,3:1).
                ⚠️ Aucune opacité sur le texte : le vérificateur ne sait pas
                calculer une opacité (cf. globals.css). Jetons pleins seulement.
                Le chiffre vient de `pricing.ts`, jamais écrit à la main.
                🛑 « 500 € » NU, sans « jusqu'à » — exception assumée par Will
                le 2026-09-04, motivée en tête de `tunnel-facebook.ts`. */}
            <div className="bg-ink mt-6 rounded-2xl px-5 py-5 sm:px-7 sm:py-6">
              <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-mocha-fg text-[clamp(2.75rem,11vw,4rem)] leading-none font-bold tracking-tight tabular-nums">
                  {montantJournee}
                </span>
                <span className="text-terracotta-on-mocha text-lg font-semibold sm:text-xl">
                  {HERO.montantLegende}
                </span>
              </p>
              <p className="text-mocha-fg-muted mt-3 text-sm sm:text-base">{HERO.montantSous}</p>
            </div>

            <p data-speakable className="text-fg mt-6 max-w-xl text-lg leading-relaxed">
              {HERO.chapo}
            </p>

            <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
              <CtaFormulaire track="facebook-hero-cta" />
              <p className="text-fg-soft text-sm font-medium">{HERO.micro}</p>
            </div>

            <p className="text-fg-soft mt-4 inline-flex items-center gap-2 text-sm font-medium">
              <Check aria-hidden="true" className="text-sage h-4 w-4 shrink-0" />
              {HERO.france}
            </p>
          </div>

          <Photo
            slot="hero"
            alt="Un apporteur d'affaires en rendez-vous avec une dirigeante d'entreprise, autour d'une table."
            ratio="aspect-[4/3]"
            sizes="(min-width: 1024px) 46vw, 100vw"
            priority
          />
        </div>
      </Section>

      {/* 2 ── Bande de confiance : des faits, pas des slogans. */}
      <Section className="py-5 sm:py-7 lg:py-8">
        <ul
          className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:justify-center sm:gap-x-8"
          role="list"
        >
          {confiance.map((t) => (
            <li key={t} className="text-fg-soft inline-flex items-center gap-2 text-sm font-medium">
              <Check aria-hidden="true" className="text-sage h-4 w-4 shrink-0" />
              {t}
            </li>
          ))}
        </ul>
      </Section>

      {/* 3 ── LE formulaire. `scroll-mt` : l'ancre ne cache pas le titre sous la barre. */}
      <Section tone="sand" id="contact" className="scroll-mt-16 py-10 sm:py-14 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
          <div>
            <p className="text-terracotta-deep text-[12px] font-semibold tracking-[0.16em] uppercase">
              Étape 1 sur 2
            </p>
            <h2 className="text-fg mt-2 font-serif text-3xl leading-tight font-semibold sm:text-4xl">
              {FORMULAIRE.titre}
            </h2>
            <p className="text-fg-soft mt-3 text-lg leading-relaxed">{FORMULAIRE.sousTitre}</p>
            <ul className="mt-6 space-y-2.5" role="list">
              {FORMULAIRE.points.map((t) => (
                <li key={t} className="text-fg-soft flex gap-2.5 text-sm leading-relaxed">
                  <Check aria-hidden="true" className="text-sage mt-0.5 h-4 w-4 shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-paper border-border shadow-card rounded-2xl border p-5 sm:p-7">
            <LeadApporteurForm />
          </div>
        </div>
      </Section>

      {/* 4 ── Comment ça marche */}
      <Section
        eyebrow="Comment ça marche"
        title="Tu ouvres la porte."
        titleEm="On fait le reste."
        className="py-10 sm:py-14 lg:py-16"
      >
        <ol className="mt-8 grid gap-5 sm:grid-cols-3" role="list">
          {ETAPES.map((e, i) => {
            const Icone = ICONES_ETAPES[i] ?? Handshake;
            return (
              <li key={e.titre} className="border-border bg-paper/60 rounded-2xl border p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="bg-terracotta-soft text-terracotta-deep flex h-11 w-11 items-center justify-center rounded-full"
                  >
                    <Icone className="h-5 w-5" />
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-fg-muted font-serif text-sm font-semibold"
                  >
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-fg mt-4 font-semibold">{e.titre}</h3>
                <p className="text-fg-soft mt-1.5 text-sm leading-relaxed">{e.texte}</p>
              </li>
            );
          })}
        </ol>
        <div className="bg-mocha relative mt-8 overflow-hidden rounded-2xl px-6 py-7 sm:px-10 sm:py-9">
          <p className="font-serif text-2xl leading-snug font-semibold text-[color:var(--color-bg)] sm:text-3xl">
            {ARGUMENT.titre} <span className="text-terracotta-soft italic">{ARGUMENT.em}</span>
          </p>
          <p className="mt-3 max-w-2xl leading-relaxed text-[color:var(--color-bg)]/80">
            Règlement européen sur l&apos;IA, en vigueur depuis février 2025. Presque aucune
            entreprise ne le sait.
            {certifie ? " Et la formation est finançable jusqu'à 100 % par leur OPCO." : ""}
          </p>
        </div>
      </Section>

      {/* 5 ── Combien : exemples de calcul, formulation indicative (W12). */}
      <Section
        tone="sand"
        eyebrow="Combien"
        title="Des exemples de calcul,"
        titleEm="pas une promesse."
        className="py-10 sm:py-14 lg:py-16"
      >
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <article className="bg-paper border-border rounded-2xl border p-6 sm:p-7">
            <h3 className="text-fg font-serif text-xl font-semibold">Une formation IA</h3>
            <p className="text-terracotta mt-3 font-serif text-3xl font-semibold">
              jusqu&apos;à {commission(1)}
            </p>
            <p className="text-fg-muted text-sm font-medium">pour toi, par journée vendue</p>
            <ul className="text-fg-soft mt-4 space-y-1.5 text-sm">
              <li>Une formation de 2 journées : jusqu&apos;à {commission(2)}</li>
              <li>De 3 journées : jusqu&apos;à {commission(3)}</li>
              {certifie ? (
                <li>Finançable jusqu&apos;à 100 % par l&apos;OPCO de l&apos;entreprise</li>
              ) : null}
            </ul>
          </article>
          <article className="bg-paper border-border rounded-2xl border p-6 sm:p-7">
            <h3 className="text-fg font-serif text-xl font-semibold">Un audit IA</h3>
            <p className="text-terracotta mt-3 font-serif text-3xl font-semibold">
              jusqu&apos;à {pctAudit} %
            </p>
            <p className="text-fg-muted text-sm font-medium">de la facture, pour toi</p>
            <ul className="text-fg-soft mt-4 space-y-1.5 text-sm">
              <li>
                Le plus petit audit démarre à {euros(auditTpe)} HT, soit jusqu&apos;à{" "}
                {euros(commissionAuditTpe)} pour toi
              </li>
              <li>Payé à l&apos;encaissement</li>
            </ul>
          </article>
        </div>
        <p className="text-fg-muted mt-5 text-sm">
          Grille en vigueur, précisée dans ton contrat. Rien n&apos;est garanti : tout dépend des
          ventes réellement payées.
        </p>
        <div className="mt-7">
          <CtaFormulaire track="facebook-montants-cta" />
        </div>
      </Section>

      {/* 6 ── Pour qui / pas pour qui : qualifie, et crédibilise. */}
      <Section eyebrow="Pour qui" title="C'est pour toi si…" className="py-10 sm:py-14 lg:py-16">
        <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
            <ul className="space-y-2.5" role="list">
              {POUR_QUI.map((t) => (
                <li key={t} className="text-fg-soft flex gap-2.5 text-sm leading-relaxed">
                  <Check aria-hidden="true" className="text-sage mt-0.5 h-4 w-4 shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <div className="border-border rounded-2xl border p-5">
              <p className="text-fg font-semibold">Ce n&apos;est pas pour toi si…</p>
              <ul className="mt-3 space-y-2.5" role="list">
                {PAS_POUR_QUI.map((t) => (
                  <li key={t} className="text-fg-soft flex gap-2.5 text-sm leading-relaxed">
                    <X aria-hidden="true" className="text-terracotta mt-0.5 h-4 w-4 shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Photo
            slot="terrain"
            alt="Une formation IA animée devant une équipe en entreprise : c'est nous qui intervenons, pas l'apporteur."
            ratio="aspect-[4/3]"
            sizes="(min-width: 1024px) 44vw, 100vw"
            className="lg:sticky lg:top-20 lg:self-start"
          />
        </div>
      </Section>

      {/* 7 ── Cartes sur table : ce que ce n'est pas. */}
      <Section
        tone="sand"
        eyebrow="Cartes sur table"
        title="Ce que ce"
        titleEm="n'est pas"
        className="py-10 sm:py-14 lg:py-16"
      >
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {CARTES_SUR_TABLE.map((c) => (
            <div key={c.t} className="bg-paper border-border rounded-xl border p-5">
              <p className="text-fg flex items-center gap-2 font-semibold">
                <X aria-hidden="true" className="text-terracotta h-4 w-4 shrink-0" />
                {c.t}
              </p>
              <p className="text-fg-soft mt-1.5 text-sm leading-relaxed">{c.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 8 ── Le fondateur : un vrai visage, une vraie phrase. */}
      <Section className="py-10 sm:py-14 lg:py-16">
        <article className="border-terracotta/15 bg-halo-warm flex flex-col gap-6 rounded-2xl border-2 p-7 sm:flex-row sm:items-start sm:gap-8 sm:p-9">
          <Image
            src={FONDATEUR.photo}
            alt={FONDATEUR.alt}
            width={224}
            height={224}
            sizes="(min-width: 640px) 112px, 80px"
            className="border-terracotta/20 h-20 w-20 shrink-0 rounded-full border object-cover sm:h-28 sm:w-28"
          />
          <div>
            <p className="text-fg-muted text-[12px] font-semibold tracking-[0.16em] uppercase">
              {FONDATEUR.eyebrow}
            </p>
            <blockquote
              className="text-fg mt-3 text-lg leading-relaxed sm:text-xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {FONDATEUR.citation}
            </blockquote>
            <p className="text-fg mt-4 font-semibold">
              {FONDATEUR.nom}
              <span className="text-fg-muted font-normal"> · {FONDATEUR.role}</span>
            </p>
          </div>
        </article>
      </Section>

      {/* 9 ── FAQ — page noindex : pas de JSON-LD. */}
      <FaqBlock
        eyebrow="FAQ"
        title="Questions"
        titleEm="légitimes"
        items={faq}
        emitJsonLd={false}
        tone="sand"
        className="py-10 sm:py-14 lg:py-16"
      />

      {/* 10 ── Dernier appel. */}
      <section className="py-12 sm:py-16">
        <Container className="text-center">
          <h2 className="text-fg font-serif text-3xl leading-tight font-semibold text-balance sm:text-4xl">
            Tu connais des dirigeants ?{" "}
            <span className="text-terracotta italic">On s&apos;appelle.</span>
          </h2>
          <p className="text-fg-soft mx-auto mt-4 max-w-xl text-lg">
            Quatre champs, zéro CV, aucun engagement.
          </p>
          <div className="mt-7 flex justify-center">
            <CtaFormulaire track="facebook-final-cta" />
          </div>
        </Container>
      </section>

      <StickyMobileCta
        href={ANCRE_FORMULAIRE}
        label={`${HERO.cta} →`}
        track="facebook-sticky-cta"
      />
    </TunnelFacebookShell>
  );
}
