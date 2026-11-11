// La Journée IA — offre phare d'Axion-IA. Page d'atterrissage d'après la maquette validée
// `PAGE-FINIE-JOURNEE-IA.html` (09/11/2026).
//
// Page statique, serveur seulement (aucun « use client » ici, aucune base) : tout le texte vient de
// `contenu.ts`, le prix et le gain de l'exemple de `pricing.ts` (JOURNEE_IA_TIER) via les jetons de
// `remplacerJetons()`. Prochaine étape unique : le rendez-vous gratuit de 45 minutes (/appel).
// Aucune modalité d'argent hors le prix de la journée, aucun prix de formation.
//
// Un seul bloc sombre : la section « prix ». Mobile d'abord (390 px), cibles de 44 px au moins.
// Apparition CSS (`s.apparition`) seulement sous la ligne de flottaison : jamais sur le h1, les tuiles ni la carte
// des gains (LCP).
//
// La langue anglaise est désactivée (proxy 301) : toute autre locale part vers /fr/journee-ia.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import {
  ArrowRight,
  CalendarDays,
  Calculator,
  ChartColumn,
  Check,
  ClipboardCheck,
  FileText,
  FolderOpen,
  GraduationCap,
  ShieldCheck,
  Tag,
  X,
} from "lucide-react";

import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { JsonLd } from "@/components/marketing/JsonLd";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  DATE_MISE_A_JOUR_JOURNEE_IA,
  EN_BREF_JOURNEE_IA_PARAGRAPHES,
  gainExempleEur,
  remplacerJetons,
} from "@/content/journee-ia-commun";
import { JOURNEE_IA_TIER } from "@/content/pricing";
import { buildProductMetadata } from "@/lib/seo";

import { CarteDesGains } from "./_composants/CarteDesGains";
import {
  CONTENU,
  DEBUT_PROMESSE,
  DESCRIPTION_META,
  LIBELLE_CTA,
  OG_IMAGE_ALT,
  TEXTES_ANNEXES,
  TITRE,
} from "./contenu";
import { jsonLdJourneeIa } from "./jsonld";
import s from "./journee-ia.module.css";

export const revalidate = 3600;

const PATH = "/journee-ia";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: PATH,
    title: TITRE,
    description: remplacerJetons(DESCRIPTION_META),
    alternates: { fr: PATH, en: PATH },
    ogImageAlt: remplacerJetons(OG_IMAGE_ALT),
  });
}

// ── Petits morceaux de mise en page, partagés par les sections ──────────────────────────────

const ICONES = {
  fichier: FileText,
  audit: ClipboardCheck,
  formation: GraduationCap,
  plan: ChartColumn,
  calcul: Calculator,
  regles: Tag,
  dossier: FolderOpen,
  bouclier: ShieldCheck,
} as const;

type NomIcone = keyof typeof ICONES;

// Rythme vertical sur l'échelle de 8 px : 48 px sur téléphone, 96 px dès 768 px, 128 px dès 1024 px.
const SECTION = "py-12 md:py-24 lg:py-32";
// Filet de 1 px entre deux sections claires (jamais autour du mocha, du terracotta pâle ni du terracotta),
// en sable saturé pour qu'il se voie vraiment (v5 : contraste).
const FILET = "border-sand-deep border-t";
// v5 (contraste) : les fonds alternent ivoire → sable saturé → blanc → sable saturé → pêche → mocha → …,
// jamais deux fonds clairs identiques à la suite. Le sable saturé porte les cartes blanches. Le
// terracotta de marque n'y fait que 4,26:1 : sur ce fond, textes et liens terracotta passent en
// `terracotta-deep` (6,05:1, AA).
const FOND_SABLE = "bg-sand-deep";
// h2 : 26 px sur téléphone (règle J10), 40 px dès 768 px, 48 px dès 1024 px.
const H2_BASE =
  "mb-4 text-[1.625rem] leading-[1.06] font-extrabold tracking-[-0.03em] text-balance md:mb-6 md:text-[2.5rem] lg:mb-8";
const H2 = `${H2_BASE} lg:text-[3rem]`;
// Carte : fond blanc, bordure 1 px sable saturé, rayon 20 px (--radius-xl), ombre douce du module.
const CARTE = `bg-paper border-sand-deep rounded-xl border ${s["ombre-carte"]}`;
// Boutons : focus visible en contour de 3 px de décalage (anneau terracotta ; blanc sur fond sombre).
const FOCUS = "focus-visible:ring-terracotta! focus-visible:ring-offset-[3px]!";
const FOCUS_MOCHA =
  "focus-visible:ring-mocha-fg! focus-visible:ring-offset-[3px]! focus-visible:ring-offset-mocha!";
const FOCUS_TERRA =
  "focus-visible:ring-white! focus-visible:ring-offset-[3px]! focus-visible:ring-offset-terracotta!";
// Bouton secondaire : fond blanc, bordure encre, survol inversé.
const SECONDAIRE = "bg-paper! border-fg! hover:bg-fg! hover:text-paper!";
const LIEN_FLECHE =
  "text-terracotta-deep mt-3 inline-flex min-h-12 items-center gap-1.5 font-bold hover:underline";
const PORTE =
  "text-fg decoration-terracotta hover:text-terracotta inline-flex min-h-12 items-center justify-center text-base font-semibold underline decoration-[1.5px] underline-offset-[3px]";

function Rond({
  nom,
  sur = "terracotta-doux",
  className = "",
}: {
  nom: NomIcone;
  sur?: "terracotta-doux" | "blanc" | "plein";
  className?: string;
}) {
  const Icone = ICONES[nom];
  const fond = {
    "terracotta-doux": "text-terracotta bg-terracotta-soft",
    blanc: "text-terracotta bg-paper",
    plein: "text-paper bg-terracotta md:size-14",
  }[sur];
  return (
    <span
      aria-hidden="true"
      className={`inline-grid size-11 flex-none place-items-center rounded-full ${fond} ${className}`}
    >
      <Icone
        className={`size-6 ${sur === "plein" ? "md:size-7" : ""}`}
        strokeWidth={1.75}
        aria-hidden="true"
        focusable="false"
      />
    </span>
  );
}

/**
 * Surtitre numéroté « 01 —— ÉTIQUETTE ». Le numéro et son filet sont décoratifs (`aria-hidden`) :
 * les lecteurs d'écran ne lisent que l'étiquette. Sans `n` (héros), l'étiquette seule.
 */
function Surtitre({
  n,
  ton = "terracotta",
  className = "",
  children,
}: {
  n?: string;
  ton?: "terracotta" | "sable" | "mocha" | "terra";
  className?: string;
  children: ReactNode;
}) {
  const couleur = {
    terracotta: "text-terracotta",
    sable: "text-terracotta-deep",
    mocha: "text-terracotta-on-mocha",
    terra: "text-mocha-fg",
  }[ton];
  return (
    <p
      className={`mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm leading-snug font-bold tracking-[0.1em] uppercase ${couleur} ${
        ton === "terra" ? "justify-center" : ""
      } ${className}`}
    >
      {n ? (
        <span
          aria-hidden="true"
          className="inline-flex items-center gap-3 font-extrabold tracking-[0.04em] tabular-nums after:block after:h-0.5 after:w-8 after:rounded-sm after:bg-current after:opacity-55 after:content-['']"
        >
          {n}
        </span>
      ) : null}
      {children}
    </p>
  );
}

/** Petit document daté et coché : décor de la carte « attestation » (masqué sous 480 px). */
function VisuelAttestation() {
  return (
    <svg
      viewBox="0 0 120 150"
      aria-hidden="true"
      focusable="false"
      className="col-start-3 row-span-2 row-start-1 hidden h-auto w-[88px] self-center min-[480px]:block md:w-[120px]"
    >
      <rect
        x="6"
        y="4"
        width="108"
        height="140"
        rx="8"
        fill="var(--color-paper)"
        stroke="var(--color-border-strong)"
        strokeWidth="1.5"
      />
      <path d="M24 30h56" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M24 48h72M24 62h72M24 76h48"
        stroke="var(--color-border-strong)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M24 122c5-7 9 3 14-3s7 3 12-1"
        fill="none"
        stroke="var(--color-fg-soft)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="90" cy="118" r="15" fill="var(--color-terracotta)" />
      <path
        d="m83 118 5 5 9-10"
        fill="none"
        stroke="var(--color-paper)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Le titre de la page, avec ses derniers mots mis en couleur. */
function Titre() {
  const { titre, titreAccent } = CONTENU.accroche;
  const [avant, apres] = titre.split(titreAccent);
  return (
    <>
      {avant}
      <span className="text-terracotta">{titreAccent}</span>
      {apres}
    </>
  );
}

/** Un paragraphe du « En bref » : le mot « garantie » mène à la condition. */
function ParagrapheEnBref({ texte }: { texte: string }) {
  const [avant, ...reste] = texte.split("garantie");
  if (reste.length === 0) return <p data-en-bref>{texte}</p>;
  return (
    <p data-en-bref className="text-fg font-semibold">
      {avant}
      <a href="#garantie" className="text-terracotta underline underline-offset-2">
        garantie
      </a>
      {reste.join("garantie")}
    </p>
  );
}

export default async function JourneeIaPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (locale !== "fr") permanentRedirect("/fr/journee-ia");
  setRequestLocale(locale);

  const { accroche, pourQui, deroule, recevez, calcul, prix, aiAct, qui, faq, rendezVous } =
    CONTENU;

  // `rdv=diagnostic` : le Diagnostic IA gratuit de 45 minutes, seul rendez-vous.
  const lien = (depuis: string) => `/appel?rdv=diagnostic&depuis=${depuis}`;
  // Le diagnostic est facultatif : « Déjà décidé ? » mène directement au contact, sans diagnostic ni paiement en ligne.
  const lienDirect = (depuis: string) => `/contact?depuis=${depuis}`;

  const [serviceJsonLd, webPageJsonLd, faqJsonLd] = jsonLdJourneeIa();

  const faqItems = faq.map((f) => ({
    id: f.id,
    question: f.question,
    answer: remplacerJetons(f.reponse),
    ...("liens" in f
      ? { liens: f.liens.map((l) => ({ href: `/fr${l.href}`, label: l.libelle })) }
      : {}),
  }));

  // La garantie : la phrase du module commun, avec sa promesse en gras.
  const debutPromesse = prix.garantie.indexOf(DEBUT_PROMESSE);
  const avantPromesse = debutPromesse > 0 ? prix.garantie.slice(0, debutPromesse) : prix.garantie;
  const promesse = debutPromesse > 0 ? prix.garantie.slice(debutPromesse) : "";

  // Les barres de l'exemple : le prix de la journée face au gain annuel, à l'échelle.
  const gain = gainExempleEur();
  const partDuPrix =
    JOURNEE_IA_TIER.priceFlat !== undefined && gain > 0
      ? Math.round((JOURNEE_IA_TIER.priceFlat / gain) * 1000) / 10
      : 0;

  const dateMaj = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${DATE_MISE_A_JOUR_JOURNEE_IA}T00:00:00Z`),
  );

  return (
    <>
      {/* 1. HÉROS + EN BREF */}
      <section
        id="s-heros"
        aria-labelledby="hero-heading"
        className={`${s.halo} text-fg pt-3 pb-12 sm:pt-6 lg:pb-24`}
      >
        <Container>
          <div className="grid gap-10 lg:grid-cols-[7fr_5fr] lg:items-center lg:gap-14">
            <div>
              <Breadcrumbs items={[{ href: PATH, label: TEXTES_ANNEXES.filAriane }]} />
              <Surtitre className="mt-3 mb-3">{accroche.surtitre}</Surtitre>
              <h1
                id="hero-heading"
                className="text-[1.875rem] leading-[1.12] font-extrabold tracking-[-0.025em] text-balance sm:text-[2.75rem] lg:text-[3.25rem]"
              >
                <Titre />
              </h1>
              <p className="text-fg-soft mt-3 max-w-[560px] text-[1.0625rem] leading-snug sm:text-lg">
                {accroche.phrase}
              </p>
              <div className="mt-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-5">
                <Cta
                  href={lien("journee-ia-haut")}
                  track="journee-ia-haut"
                  variant="terracotta"
                  size="xl"
                  className={`w-full sm:w-auto ${FOCUS}`}
                >
                  <CalendarDays className="size-5" aria-hidden="true" />
                  {accroche.cta}
                </Cta>
                <Link
                  href={lienDirect("journee-ia-decide") as never}
                  data-cta="journee-ia-decide"
                  className={PORTE}
                >
                  {accroche.lienDecide}
                </Link>
              </div>
              <p className="text-fg-soft mt-1 text-center text-sm sm:text-left">
                {accroche.microTexte}
              </p>
              <ul
                aria-label={TEXTES_ANNEXES.ariaTuiles}
                className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3 lg:max-w-[560px] lg:grid-cols-2"
              >
                {accroche.tuiles.map((t, i) => {
                  const corps = (
                    <>
                      <b
                        className={`block text-xl leading-[1.1] font-extrabold tracking-[-0.02em] lg:text-2xl ${
                          i === 0 || "ancre" in t
                            ? "text-terracotta"
                            : "attestation" in t
                              ? "text-ink"
                              : "text-fg"
                        }`}
                      >
                        {remplacerJetons(t.valeur)}
                      </b>
                      <span
                        className={`mt-1.5 block text-sm leading-snug ${
                          "attestation" in t ? "text-ink font-semibold" : "text-fg-soft"
                        }`}
                      >
                        {t.legende}
                      </span>
                    </>
                  );
                  return (
                    <li
                      key={t.valeur}
                      className={`border-sand-deep rounded-xl border p-4 lg:px-5 ${s["ombre-carte"]} ${
                        "ancre" in t
                          ? "bg-terracotta-soft border-terracotta/20"
                          : "attestation" in t
                            ? "bg-paper border-l-terracotta border-l-4"
                            : "bg-paper"
                      }`}
                    >
                      {"ancre" in t ? (
                        <a href={t.ancre} className="text-fg block min-h-[44px] no-underline">
                          {corps}
                        </a>
                      ) : (
                        corps
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <CarteDesGains />
            </div>
          </div>

          <section
            aria-labelledby="en-bref-titre"
            className="border-terracotta text-fg-soft mt-8 max-w-[68ch] space-y-2.5 border-l-[3px] pl-3.5 text-base leading-relaxed lg:mt-12"
          >
            <h2
              id="en-bref-titre"
              className="text-terracotta text-sm font-extrabold tracking-[0.1em] uppercase"
            >
              {TEXTES_ANNEXES.enBrefTitre}
            </h2>
            {EN_BREF_JOURNEE_IA_PARAGRAPHES.map((p) => (
              <ParagrapheEnBref key={p} texte={remplacerJetons(p)} />
            ))}
          </section>
        </Container>
      </section>

      {/* 2. POUR QUI */}
      <section
        id="pour-qui"
        aria-labelledby="h-pour-qui"
        className={`${FOND_SABLE} ${SECTION} ${FILET}`}
      >
        <Container>
          <Surtitre n="01" ton="sable">
            {pourQui.surtitre}
          </Surtitre>
          <h2 id="h-pour-qui" className={`${H2} text-fg`}>
            {pourQui.titre}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div
              className={`bg-paper border-border-strong rounded-xl border p-6 ${s["ombre-carte"]}`}
            >
              <p className="text-fg mb-4 text-lg font-extrabold tracking-[-0.02em]">
                {pourQui.titreOui}
              </p>
              <ul className="grid gap-2">
                {pourQui.pourVous.map((t) => (
                  <li
                    key={t}
                    className="bg-bg border-border flex min-h-12 items-center gap-3 rounded-lg border px-3.5 py-2.5 text-base leading-snug font-semibold"
                  >
                    <span
                      aria-hidden="true"
                      className="bg-success inline-grid size-6 flex-none place-items-center rounded-full text-white"
                    >
                      <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-border-field rounded-xl border-[1.5px] border-dashed p-6">
              <p className="text-fg-soft mb-4 text-lg font-extrabold tracking-[-0.02em]">
                {pourQui.titreNon}
              </p>
              <ul className="grid gap-2">
                {pourQui.pasPourVous.map((t) => (
                  <li
                    key={t}
                    className="border-border-strong text-fg-soft flex min-h-12 items-center gap-3 rounded-lg border px-3.5 py-2.5 text-base leading-snug font-medium"
                  >
                    <span
                      aria-hidden="true"
                      className="bg-paper text-fg-soft inline-grid size-6 flex-none place-items-center rounded-full"
                    >
                      <X className="size-3.5" strokeWidth={3} aria-hidden="true" />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Link
            href={lien("journee-ia-pour-qui") as never}
            data-cta="journee-ia-pour-qui"
            className={LIEN_FLECHE}
          >
            {pourQui.lienAppel}
            <ArrowRight className="size-[18px]" strokeWidth={2} aria-hidden="true" />
          </Link>

          <h3 className="text-fg mt-12 mb-4 text-[1.3125rem] font-extrabold tracking-[-0.02em] lg:mt-24 lg:text-2xl">
            {pourQui.titreExemples}
          </h3>
          <div
            role="region"
            aria-label={TEXTES_ANNEXES.ariaExemples}
            tabIndex={0}
            className="focus-visible:outline-terracotta -mx-4 snap-x snap-mandatory scroll-pl-4 overflow-x-auto px-4 pt-1 pb-4 focus-visible:outline-2 sm:-mx-6 sm:scroll-pl-6 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0"
          >
            <ul className="flex gap-3 lg:grid lg:grid-cols-5">
              {pourQui.exemples.map((e) => (
                <li
                  key={e.secteur}
                  className={`${CARTE} ${s.survol} relative w-60 flex-none snap-start overflow-hidden lg:w-auto`}
                >
                  <Image
                    src={`/illustrations/secteurs/${e.image}.avif`}
                    alt=""
                    width={1600}
                    height={1000}
                    loading="lazy"
                    sizes="(min-width: 1024px) 20vw, 240px"
                    className="aspect-[4/3] h-auto w-full object-cover"
                  />
                  <div className="p-4 pb-6">
                    <p className="text-fg mb-0.5 text-base font-extrabold lg:min-h-[2.6em]">
                      {e.secteur}
                    </p>
                    <p className="text-fg-soft text-[15px] leading-snug">{e.phrase}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-fg-soft border-border-strong mt-6 border-t pt-4 text-sm">
            {pourQui.insee.texte}{" "}
            <a
              href={pourQui.insee.url}
              target="_blank"
              rel="noopener"
              className="text-terracotta-deep inline-flex min-h-11 items-center underline underline-offset-2"
            >
              {pourQui.insee.source}
              <span className="sr-only">{TEXTES_ANNEXES.nouvelOnglet}</span>
            </a>
            .
          </p>
        </Container>
      </section>

      {/* 3. LE DÉROULÉ */}
      <section id="deroule" aria-labelledby="h-deroule" className={`bg-paper ${SECTION} ${FILET}`}>
        <Container>
          <div className={s.apparition}>
            <Surtitre n="02">{deroule.surtitre}</Surtitre>
            <h2 id="h-deroule" className={`${H2} text-fg`}>
              {deroule.titre}
            </h2>
            <ol className={s.frise}>
              {deroule.etapes.map((e) => {
                const Icone = ICONES[e.icone];
                return (
                  <li key={e.jalons[0]?.moment} className={s.etape}>
                    <span className={s.rond} aria-hidden="true">
                      <Icone className="size-6" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className={s.txt}>
                      {e.jalons.map((j, i) => (
                        <span key={j.moment} className="contents">
                          {i === 0 ? (
                            <>
                              <span className={s.badge}>{j.moment}</span>
                              <span className={s.et}>{j.texte}</span>
                            </>
                          ) : (
                            <>
                              <span className={`${s.badge} mt-1.5`}>{j.moment}</span>
                              <span className={s.et}>{j.texte}</span>
                            </>
                          )}
                        </span>
                      ))}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-8">
              <Cta
                href={lien("journee-ia-deroule")}
                track="journee-ia-deroule"
                variant="terracotta"
                size="xl"
                className={`w-full sm:w-auto ${FOCUS}`}
              >
                <CalendarDays className="size-5" aria-hidden="true" />
                {accroche.cta}
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* 4. CE QUE VOUS RECEVEZ */}
      <section
        id="recevez"
        aria-labelledby="h-recevez"
        className={`${FOND_SABLE} ${SECTION} ${FILET}`}
      >
        <Container>
          <div className={s.apparition}>
            <Surtitre n="03" ton="sable">
              {recevez.surtitre}
            </Surtitre>
            <h2 id="h-recevez" className={`${H2} text-fg`}>
              {recevez.titre}
            </h2>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-6">
              {recevez.elements.map((el, i) =>
                "vedette" in el ? (
                  // L'attestation : en tête, pleine largeur, mise en valeur.
                  <li
                    key={el.titre}
                    className={`bg-terracotta-soft border-terracotta/20 ${s["ombre-vedette"]} relative col-span-full grid grid-cols-[44px_1fr] items-start gap-x-4 gap-y-2 overflow-hidden rounded-xl border px-5 py-6 min-[480px]:grid-cols-[44px_1fr_88px] md:grid-cols-[56px_1fr_120px] md:gap-x-6 md:p-8`}
                  >
                    <Rond
                      nom={el.icone}
                      sur="plein"
                      className="col-start-1 row-span-2 self-center"
                    />
                    <h3 className="text-fg col-start-2 row-start-1 self-end text-xl leading-tight font-extrabold md:text-2xl">
                      {el.titre}
                    </h3>
                    <p className="text-ink col-start-2 row-start-2 mt-1.5 max-w-[46ch] text-base md:text-[1.0625rem]">
                      {el.texte}
                    </p>
                    <VisuelAttestation />
                  </li>
                ) : (
                  <li
                    key={el.titre}
                    className={`${CARTE} flex flex-col items-start gap-3 px-4 py-5 md:flex-row md:items-center md:gap-4 md:px-[22px] ${
                      i <= 3 ? "md:col-span-2" : "md:col-span-3"
                    } ${i === recevez.elements.length - 1 ? "col-span-2" : ""}`}
                  >
                    <Rond nom={el.icone} />
                    <div>
                      <h3 className="text-fg text-base leading-snug font-bold lg:text-lg">
                        {el.titre}
                      </h3>
                      {"delai" in el ? (
                        <p className="bg-terracotta-soft text-terracotta-deep mt-2.5 inline-block rounded-lg px-2.5 py-[3px] text-sm leading-snug font-bold">
                          {el.delai}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ),
              )}
            </ul>
          </div>
        </Container>
      </section>

      {/* 5. COMBIEN VOUS COÛTENT CES HEURES ? */}
      <section id="exemple" aria-labelledby="h-exemple" className={`bg-terracotta-soft ${SECTION}`}>
        <Container>
          <div className={s.apparition}>
            <Surtitre n="04">{calcul.surtitre}</Surtitre>
            <h2 id="h-exemple" className={`${H2} text-fg`}>
              {calcul.titre}
            </h2>
            <div
              className={`bg-paper border-terracotta/20 max-w-[720px] rounded-2xl border p-6 lg:p-9 ${s["ombre-vedette"]}`}
            >
              <p className="flex flex-wrap items-center gap-2">
                {calcul.facteurs.map((f, i) => (
                  <span key={f} className="contents">
                    {i > 0 ? (
                      <span aria-hidden="true" className="text-terracotta font-extrabold">
                        ×
                      </span>
                    ) : null}
                    {i > 0 ? <span className="sr-only"> fois </span> : null}
                    <span className="bg-sand border-border-strong rounded-full border px-3 py-1.5 text-[15px] leading-snug font-bold">
                      {remplacerJetons(f)}
                    </span>
                  </span>
                ))}
                <span className="text-terracotta mt-3.5 basis-full text-[3.25rem] leading-none font-extrabold tracking-[-0.03em] lg:text-7xl">
                  <span aria-hidden="true" className="mr-1 align-[0.25em] text-[0.6em]">
                    =
                  </span>
                  <span className="sr-only">= </span>
                  {remplacerJetons(calcul.total)}
                </span>
                <span className="text-fg basis-full text-[17px] font-bold">
                  {calcul.totalSuite}
                </span>
              </p>
              <p className="text-fg-soft mt-3.5 mb-4 text-[15px]">{calcul.nuance}</p>
              <div aria-hidden="true" className="my-4 grid max-w-[520px] gap-2.5">
                <div className="bg-terracotta flex h-11 items-center rounded-md px-3.5 font-extrabold text-white">
                  {remplacerJetons(calcul.total)}
                </div>
                <div className="bg-fg relative h-11 rounded-md" style={{ width: `${partDuPrix}%` }}>
                  <span className="text-fg absolute top-1/2 left-[calc(100%+10px)] -translate-y-1/2 font-extrabold whitespace-nowrap">
                    {remplacerJetons(prix.montant)}
                  </span>
                </div>
              </div>
              <Cta
                href="/roi?depuis=journee-ia"
                track="journee-ia-roi"
                variant="outline"
                size="xl"
                className={`w-full sm:w-auto ${SECONDAIRE} ${FOCUS}`}
              >
                <Calculator className="size-5" aria-hidden="true" />
                {calcul.lien}
              </Cta>
            </div>
          </div>
        </Container>
      </section>

      {/* 6. PRIX ET GARANTIE — le seul bloc sombre */}
      <section id="prix" aria-labelledby="h-prix" className={`bg-mocha text-mocha-fg ${SECTION}`}>
        <Container className="grid gap-7 lg:grid-cols-[5fr_6fr] lg:gap-x-16">
          <div className="lg:col-start-1 lg:row-start-1">
            <Surtitre n="05" ton="mocha">
              {prix.surtitre}
            </Surtitre>
            <h2 id="h-prix" className={`${H2} text-mocha-fg`}>
              {prix.titre}
            </h2>
            <p className="text-terracotta-on-mocha mt-2 text-[clamp(2.75rem,15vw,3.75rem)] leading-none font-extrabold tracking-[-0.03em] lg:text-[5rem]">
              {remplacerJetons(prix.montant)}
              <small className="text-mocha-fg-muted mt-2 block text-[17px] font-semibold tracking-normal">
                {prix.unite}
              </small>
            </p>
            <ul className="mt-5 grid gap-2.5">
              {prix.lignes.map((l) => (
                <li key={l} className="flex items-center gap-3 text-base font-semibold">
                  <span
                    aria-hidden="true"
                    className="bg-terracotta-on-mocha text-ink inline-grid size-6 flex-none place-items-center rounded-full"
                  >
                    <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                  </span>
                  {l}
                </li>
              ))}
            </ul>
            <p className="border-border-on-mocha text-mocha-fg-muted mt-5 border-t pt-4 text-[15px]">
              {prix.ancre}
            </p>
          </div>

          <div
            id="garantie"
            className={`border-border-on-mocha border-l-terracotta-on-mocha bg-mocha-soft ${s["ombre-mocha"]} relative scroll-mt-20 overflow-hidden rounded-xl border border-l-4 p-5 sm:p-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-7 lg:self-start`}
          >
            <span aria-hidden="true" className={s.x3}>
              ×3
            </span>
            <div className="relative text-base leading-relaxed">
              <h3 className="text-mocha-fg mb-3 flex items-start gap-2.5 pr-14 text-xl leading-snug font-extrabold sm:pr-0">
                <ShieldCheck
                  className="text-terracotta-on-mocha mt-0.5 size-[30px] flex-none"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                {prix.titreGarantie}
              </h3>
              <p className="mb-2">
                {avantPromesse}
                {promesse ? (
                  <strong className="text-mocha-fg mt-1.5 block text-[1.1875rem] font-extrabold">
                    {promesse}
                  </strong>
                ) : null}
              </p>
              <p className="border-border-on-mocha mt-3 border-t pt-3">{prix.condition}</p>
              <p className="text-mocha-fg-muted mt-3.5">{prix.rapport}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 lg:col-start-1 lg:row-start-2">
            <Cta
              href={lien("journee-ia-prix")}
              track="journee-ia-prix"
              variant="terracotta"
              size="xl"
              className={`bg-terracotta-on-mocha text-ink hover:bg-terracotta-on-mocha/90 w-full shrink-0 sm:w-auto ${FOCUS_MOCHA}`}
            >
              <CalendarDays className="size-5" aria-hidden="true" />
              {accroche.cta}
            </Cta>
            <Link
              href={lienDirect("journee-ia-prix-decide") as never}
              data-cta="journee-ia-prix-decide"
              className={`${PORTE} text-mocha-fg decoration-terracotta-on-mocha hover:text-terracotta-on-mocha`}
            >
              {prix.lienDecide}
            </Link>
            <p className="text-mocha-fg-muted mt-3 basis-full text-sm leading-snug">
              {prix.mention}
            </p>
          </div>
        </Container>
      </section>

      {/* 7. CE QUE DIT L'AI ACT */}
      <section id="ai-act" aria-labelledby="h-ai-act" className={`bg-sand ${SECTION}`}>
        <Container>
          <div className={s.apparition}>
            <Surtitre n="06">{aiAct.surtitre}</Surtitre>
            <h2 id="h-ai-act" className={`${H2} text-fg`}>
              {aiAct.titre}
            </h2>
            <ul className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr]">
              {aiAct.cartes.map((c) => (
                <li
                  key={c.titre}
                  className={`flex flex-col gap-2.5 rounded-xl border p-6 ${s["ombre-carte"]} ${
                    "attestation" in c
                      ? "bg-terracotta-soft border-terracotta/20 border-t-terracotta border-t-4"
                      : "bg-paper border-sand-deep"
                  }`}
                >
                  <Rond nom={c.icone} sur={"attestation" in c ? "plein" : "terracotta-doux"} />
                  <h3 className="text-fg mt-1 text-[1.1875rem] font-bold">{c.titre}</h3>
                  <p
                    className={`text-[15px] leading-relaxed ${
                      "attestation" in c ? "text-ink" : "text-fg-soft"
                    }`}
                  >
                    {c.texte}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-fg-soft mt-2 text-sm">
              {aiAct.source.prefixe}{" "}
              <a
                href={aiAct.source.url}
                target="_blank"
                rel="noopener"
                className="text-terracotta inline-flex min-h-11 items-center underline underline-offset-2"
              >
                {aiAct.source.libelle}
                <span className="sr-only">{TEXTES_ANNEXES.nouvelOnglet}</span>
              </a>
            </p>
          </div>
        </Container>
      </section>

      {/* 8. QUI EST DERRIÈRE */}
      <section id="qui" aria-labelledby="h-qui" className={`bg-paper ${SECTION} ${FILET}`}>
        <Container>
          <div className={s.apparition}>
            <div className="grid max-w-[1000px] gap-5 sm:grid-cols-[120px_1fr] sm:items-start sm:gap-8 lg:grid-cols-[300px_1fr] lg:items-center lg:gap-14">
              <Image
                src="/illustrations/william-fondateur-formateur-ia-axion-ia.webp"
                alt={qui.altPortrait}
                width={1086}
                height={1448}
                loading="lazy"
                sizes="(min-width: 1024px) 300px, 120px"
                className={`ring-paper ${s["ombre-vedette"]} size-28 rounded-full object-cover object-[50%_25%] ring-4 sm:size-[120px] lg:h-[375px] lg:w-[300px] lg:rounded-3xl`}
              />
              <div>
                <Surtitre n="07">{qui.surtitre}</Surtitre>
                <h2 id="h-qui" className={`${H2} text-fg`}>
                  {qui.titre}
                </h2>
                <p className="text-fg-soft mt-1.5 mb-3.5">{qui.phrase}</p>
                <figure className="mb-1">
                  <blockquote
                    className={`bg-sand border-sand-deep border-l-terracotta mb-1.5 rounded-r-xl border border-l-4 px-6 py-4 text-[1.3125rem] leading-snug font-bold tracking-[-0.01em] text-balance lg:text-[1.75rem] ${s["ombre-carte"]}`}
                  >
                    {qui.citation}
                  </blockquote>
                  <figcaption className="text-fg-soft text-[15px]">{qui.auteur}</figcaption>
                </figure>
                <Link href={qui.lienHref as never} className={LIEN_FLECHE}>
                  {qui.lien}
                  <ArrowRight className="size-[18px]" strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* 9. QUESTIONS FRÉQUENTES */}
      <section
        id="questions"
        aria-labelledby="h-questions"
        className={`${FOND_SABLE} ${SECTION} ${FILET}`}
      >
        <Container className="grid gap-5 lg:grid-cols-[4fr_8fr] lg:items-start lg:gap-14">
          <div className="lg:sticky lg:top-24">
            <Surtitre n="08" ton="sable">
              {TEXTES_ANNEXES.faqEntete.surtitre}
            </Surtitre>
            <h2 id="h-questions" className={`${H2_BASE} text-fg mb-0! lg:text-[2.5rem]`}>
              {TEXTES_ANNEXES.faqEntete.titre}
            </h2>
            <Link href={TEXTES_ANNEXES.faqEntete.lienTousHref as never} className={LIEN_FLECHE}>
              {TEXTES_ANNEXES.faqEntete.lienTous}
              <ArrowRight className="size-[18px]" strokeWidth={2} aria-hidden="true" />
            </Link>
            <div className="mt-2">
              <Cta
                href={lien("journee-ia-faq")}
                track="journee-ia-faq"
                variant="outline"
                size="xl"
                className={`w-full sm:w-auto ${SECONDAIRE} ${FOCUS}`}
              >
                <CalendarDays className="size-5" aria-hidden="true" />
                {accroche.cta}
              </Cta>
            </div>
          </div>
          <div>
            <div className={`${CARTE} px-5 py-2 lg:px-8`}>
              <FaqAccordion items={faqItems} emitJsonLd={false} ancres />
            </div>
          </div>
        </Container>
      </section>

      {/* 10. APPEL FINAL */}
      <section
        id="rendez-vous"
        aria-labelledby="h-rendez-vous"
        className={`bg-terracotta text-mocha-fg ${SECTION}`}
      >
        <Container className="max-w-[760px] text-center lg:max-w-[1000px]">
          <Surtitre n="09" ton="terra">
            {rendezVous.surtitre}
          </Surtitre>
          <h2 id="h-rendez-vous" className={`${H2} text-white`}>
            {rendezVous.titre}
          </h2>
          <ol className="mt-2 mb-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center xl:flex-nowrap">
            {rendezVous.etapes.map((e, i) => (
              <li
                key={e}
                className="flex min-h-12 items-center gap-3 rounded-full border border-white/40 bg-white/12 py-2 pr-4 pl-2 text-left text-base leading-snug font-semibold text-white xl:whitespace-nowrap"
              >
                <span
                  aria-hidden="true"
                  className="text-terracotta inline-grid size-8 flex-none place-items-center rounded-full bg-white text-[15px] font-extrabold"
                >
                  {i + 1}
                </span>
                {e}
              </li>
            ))}
          </ol>
          <p className="mb-4 text-[17px] font-bold text-white">{rendezVous.plusieurs}</p>
          <Cta
            href={lien("journee-ia-bas")}
            track="journee-ia-bas"
            variant="terracotta"
            size="xl"
            className={`text-terracotta hover:bg-mocha-fg w-full bg-white sm:w-auto sm:px-10 ${FOCUS_TERRA}`}
          >
            <CalendarDays className="size-5" aria-hidden="true" />
            {rendezVous.cta}
          </Cta>
          {rendezVous.rassurances.map((r) => (
            <p key={r} className="text-mocha-fg mt-2.5 text-[15px]">
              {r}
            </p>
          ))}
          <p className="text-mocha-fg mt-8 text-sm">
            {TEXTES_ANNEXES.miseAJour} <time dateTime={DATE_MISE_A_JOUR_JOURNEE_IA}>{dateMaj}</time>
            .
          </p>
        </Container>
      </section>

      <StickyMobileCta
        href={lien("journee-ia-barre")}
        label={LIBELLE_CTA}
        track="journee-ia-barre"
        couleur="terracotta"
        masquerQuandVisible="rendez-vous"
      />

      <JsonLd data={serviceJsonLd} />
      <JsonLd data={webPageJsonLd} />
      <JsonLd data={faqJsonLd} />
    </>
  );
}
