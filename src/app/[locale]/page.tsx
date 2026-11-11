import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound, permanentRedirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Globe,
  GraduationCap,
  Plug,
  User,
} from "lucide-react";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/marketing/JsonLd";
import { FadeInOnView } from "@/components/motion/FadeInOnView";
import { Illustration } from "@/components/visual/Illustration";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { UnsplashCreditList } from "@/components/media/UnsplashCreditList";
import { WhyDifferentiators } from "@/components/home/WhyDifferentiators";
import { AudienceSegments } from "@/components/home/AudienceSegments";
import { DATE_MISE_A_JOUR_JOURNEE_IA, remplacerJetons } from "@/content/journee-ia-commun";
import { getIndexableRegions } from "@/content/regions";
import { SECTOR_PHOTO_CREDITS } from "@/content/secteurs/sector-photos";
import type { ClientSectorSlug } from "@/content/sectors";
import { buildProductMetadata } from "@/lib/seo";
import { CarteFrance } from "./_accueil/CarteFrance";
import { SchemaCourriels, SchemaDevis, SchemaRelances } from "./_accueil/Schemas";
import { CONTENU, DESCRIPTION_META, OG_EYEBROW, OG_IMAGE_ALT, TITRE } from "./_accueil/contenu";
import { jsonLdAccueil, questionsAccueil } from "./_accueil/jsonld";
import styles from "./_accueil/accueil.module.css";

// ISR 1 h. Le contenu de la page vient de fichiers du dépôt (plus d'avis ni de prix lus
// en base). Seules les surcharges d'aperçu social, lues par `buildProductMetadata`, sont
// en base : la fenêtre de 3 600 s les repeuple après un déploiement (AGENTS.md, ADR 0026).
export const revalidate = 3600;

interface HomeProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: HomeProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return {
    ...(await buildProductMetadata({
      locale: "fr",
      path: "/",
      title: TITRE,
      description: remplacerJetons(DESCRIPTION_META),
      alternates: { fr: "/", en: "/" },
      ogEyebrow: OG_EYEBROW,
      ogImageAlt: OG_IMAGE_ALT,
    })),
    title: { absolute: TITRE },
  };
}

const T = (texte: string) => remplacerJetons(texte);

// Gabarits des boutons et des titres (jetons de globals.css).
const BOUTON =
  "cta-lift inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-7 py-3 text-center text-base font-semibold transition-colors hover:-translate-y-px active:translate-y-0 focus-visible:ring-2 focus-visible:ring-offset-[3px] focus-visible:outline-none";
const BOUTON_PLEIN = `${BOUTON} bg-terracotta text-paper hover:bg-terracotta-deep focus-visible:ring-terracotta`;
const BOUTON_CONTOUR = `${BOUTON} bg-paper border-ink text-fg hover:bg-ink hover:text-paper focus-visible:ring-terracotta border-[1.5px]`;
const H2 =
  "text-fg text-[28px] leading-[1.06] font-extrabold tracking-[-0.03em] text-balance md:text-[40px] lg:text-5xl";
const CHAPEAU = "text-fg-soft mt-4 max-w-3xl text-lg leading-relaxed";
const SECTION = "py-14 md:py-24 lg:py-32";
// Section claire qui suit une section claire : un filet de 1 px la sépare.
const SECTION_CLAIRE = `${SECTION} border-sand-deep border-t`;
// v5 (contraste) : les fonds alternent ivoire → sable saturé → blanc → mocha → sable saturé → pêche →
// sable saturé → terracotta, jamais deux fonds clairs identiques à la suite. Le terracotta de marque
// ne fait que 4,26:1 sur le sable saturé : textes et liens terracotta y passent en `terracotta-deep`.
const FOND_SABLE = `bg-sand-deep ${SECTION}`;
const H2_SOMBRE = H2.replace("text-fg ", "text-mocha-fg ");
const LIEN_SOMBRE = "text-terracotta-on-mocha font-semibold underline underline-offset-4";
const ETIQUETTE =
  "bg-terracotta-soft text-terracotta-deep before:bg-terracotta inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold before:size-1.5 before:rounded-full";
const LIEN = "text-terracotta font-semibold underline-offset-4 hover:underline";

/** Numéro de section « 01 —— » : décoratif, les lecteurs d’écran ne le lisent pas. */
function Numero({
  n,
  clair = false,
  ton,
}: {
  n: string;
  clair?: boolean;
  ton?: "sable" | "sombre";
}) {
  const variante = clair
    ? styles.numeroClair
    : ton === "sable"
      ? styles.numeroSable
      : ton === "sombre"
        ? styles.numeroSombre
        : "";
  return (
    <p aria-hidden="true" className={variante ? `${styles.numero} ${variante}` : styles.numero}>
      {n}
    </p>
  );
}

const PRESTATIONS = {
  audit: { href: "/audit", Icon: ClipboardCheck },
  formations: { href: "/formations", Icon: GraduationCap },
  implementation: { href: "/implementation", Icon: BarChart3 },
  "un-a-un": { href: "/un-a-un", Icon: User },
  "sites-web-augmentes": { href: "/sites-web-augmentes", Icon: Globe },
} as const;

const SCHEMAS = [SchemaDevis, SchemaRelances, SchemaCourriels] as const;

export default async function Home({ params }: HomeProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (locale !== "fr") permanentRedirect("/fr");
  setRequestLocale(locale);

  const { heros, deuxFacons, enBref, miseEnPlace, williams, pmeTpe, secteurs, france, faq } =
    CONTENU;
  const { blocJournee: journee, blocAppel: appel } = deuxFacons;
  const regions = getIndexableRegions();
  const dateMaj = new Date(`${DATE_MISE_A_JOUR_JOURNEE_IA}T12:00:00Z`);

  return (
    <div className={styles.v4}>
      {/* ───────────── 1. HÉROS ───────────── */}
      <section
        id="s-heros"
        aria-labelledby="hero-heading"
        className={`bg-bg ${styles.heroHalo} relative overflow-hidden pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28`}
      >
        <Container className="relative">
          <HeroBadge className="mb-10 sm:mb-12">
            <span aria-hidden="true">🇫🇷</span>
            {heros.surtitre}
          </HeroBadge>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            <div className="max-w-2xl">
              <h1 id="hero-heading" className="display-editorial text-fg">
                {heros.titrePartie1}{" "}
                <em className="italic-editorial text-terracotta not-italic">
                  <span className="italic">{heros.titreEm}</span>
                </em>
                {heros.titrePartie2}
              </h1>
              <p className="text-fg-soft mt-8 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {heros.sousTitre}
              </p>
              {/* v5 : libellés sur une ligne dès 640 px ; si la colonne est trop étroite, le 2e bouton passe
                  dessous au lieu de couper son libellé (mesuré à 1024 et 1280 px). */}
              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href={{ pathname: "/appel", query: { depuis: "accueil-hero" } }}
                  className={`${BOUTON_PLEIN} sm:whitespace-nowrap`}
                >
                  <CalendarDays className="h-5 w-5 shrink-0" aria-hidden="true" />
                  Je réserve un appel
                </Link>
                <Link href="/journee-ia" className={`${BOUTON_CONTOUR} sm:whitespace-nowrap`}>
                  {T(heros.lienJournee)}
                </Link>
              </div>
              <p className="text-fg-soft mt-4 text-[15px]">{heros.reassurance}</p>
            </div>

            <div className="hidden lg:block">
              <Illustration
                slot="HOME-01-hero"
                src="/illustrations/home-hero-equipe.avif"
                aspectRatio="3:2"
                filenameTarget="public/illustrations/home-hero-equipe.avif"
                caption="L'équipe Axion-IA — l'IA au service de l'humain"
                alt="Photo de l'équipe Axion-IA en pulls terracotta sous le logo « Axion-IA.com — L'intelligence artificielle au service de l'humain »."
                priority
                // Audit SEO 2026-11-11 (I5) : seule image LCP de l'accueil (desktop).
                // `priority` précharge, `fetchPriority` hisse aussi l'`<img>` elle-même.
                fetchPriority="high"
                // 🔴 GEO-125 (audit GEO/AEO 2026-08-15) — mesuré en production le
                // 2026-08-14 sur Pixel 7 (412 px, DPR 2,625) : 62 Ko d'image hero
                // téléchargés à t = 146 ms, en plein dans la fenêtre du LCP, pour
                // un élément dont `getBoundingClientRect().width === 0`.
                //
                // Cause : `priority` émet un `<link rel="preload" as="image">` qui
                // n'est PAS conditionné au media, et le `sizes` par défaut d'
                // `Illustration` (« (max-width: 1024px) 100vw, 600px ») déclare un
                // cas mobile qui n'existe pas — le `hidden lg:block` ci-dessus ne
                // peint jamais cette image sous 1024 px.
                //
                // ⚠️ Le plan d'audit prescrivait `sizes="600px"`. C'EST UNE
                // RÉGRESSION : la sélection `srcset` multiplie la taille déclarée
                // par le DPR. 600 × 2,625 = 1 575 → le navigateur retiendrait le
                // candidat 1920w, soit PLUS que les 1200w actuels (412 × 2,625 =
                // 1 081 → 1200w). On déclare donc la largeur RÉELLE de l'élément
                // sous 1024 px — nulle — ce qui fait retomber le préchargeur sur
                // le plus petit candidat (16w, ~1 Ko).
                //
                // Le seuil 1024 px est celui de `lg:` (Tailwind) : les deux règles
                // doivent bouger ENSEMBLE. Si le hero devient visible en mobile,
                // ce `sizes` doit disparaître — la garde
                // `home-hero-sizes.spec.ts` rougit dans ce cas.
                //
                // Desktop : `(min-width: 1024px)` → 600px, identique à l'existant.
                // Aucun changement sur le LCP desktop.
                sizes="(min-width: 1024px) 600px, 1px"
              />
            </div>
          </div>
        </Container>
      </section>

      {/* ───────────── 2. DEUX FAÇONS DE COMMENCER ───────────── */}
      <section id="deux-facons" aria-labelledby="h-deux-facons" className={FOND_SABLE}>
        <Container>
          <Numero n="01" ton="sable" />
          <h2 id="h-deux-facons" className={H2}>
            {deuxFacons.titre}
          </h2>
          <p className={CHAPEAU}>
            <b className="text-terracotta-deep">{deuxFacons.chapeauDebut}</b>
            {deuxFacons.chapeauMilieu}
            <b className="text-terracotta-deep">{deuxFacons.chapeauFin}</b>.
          </p>

          <div className="mt-10 grid items-start gap-6 lg:grid-cols-12">
            {/* Carte mocha : la Journée IA. Sur téléphone, le prix vient juste sous le titre. */}
            <article
              id="journee-ia"
              className={`${styles.sombre} ${styles.mocha} bg-mocha text-mocha-fg flex scroll-mt-24 flex-col gap-5 rounded-3xl p-6 sm:p-8 lg:col-span-7 lg:p-10`}
            >
              <div className="max-lg:order-[-2]">
                <p className="text-terracotta-on-mocha text-[13px] font-bold tracking-[0.06em] uppercase">
                  {journee.surtitre}
                </p>
                <h3 className="text-mocha-fg mt-1 mb-2 text-4xl font-extrabold tracking-tight">
                  {journee.titre}
                </h3>
                <p className="text-lg leading-snug">{journee.accroche}</p>
              </div>

              <ul className="grid gap-3">
                {journee.tuiles.map((tuile, i) => (
                  <li
                    key={tuile.repere}
                    className={`bg-mocha-soft border-border-on-mocha rounded-xl border p-4 lg:grid lg:grid-cols-[170px_1fr] lg:items-baseline lg:gap-4 ${i === 1 ? styles.tuileAccent : ""}`}
                  >
                    <span className="text-terracotta-on-mocha mb-1 block text-sm font-bold lg:mb-0">
                      {tuile.repere}
                    </span>
                    <p className="text-[15px]">{tuile.texte}</p>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-2">
                {[
                  { Icon: FileText, texte: journee.lignes[0] },
                  { Icon: Plug, texte: journee.lignes[1] },
                ].map(({ Icon, texte }) => (
                  <p
                    key={texte}
                    className="text-mocha-fg-muted border-mocha-fg-muted flex items-start gap-3 border-l-2 pl-3 text-sm"
                  >
                    <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>{texte}</span>
                  </p>
                ))}
              </div>

              <p className="text-mocha-fg-muted border-border-on-mocha border-t pt-4 text-sm">
                {T(journee.exemple)}{" "}
                <Link
                  href={{ pathname: "/roi", query: { depuis: "accueil-bloc-journee" } }}
                  className="text-terracotta-on-mocha whitespace-nowrap underline underline-offset-4"
                >
                  {journee.exempleLien}
                </Link>
              </p>

              <div className="max-lg:border-border-on-mocha flex flex-wrap items-baseline gap-x-4 gap-y-1 max-lg:order-[-1] max-lg:border-t max-lg:pt-4">
                <p className="text-mocha-fg text-3xl font-extrabold">
                  {T(journee.prix)}
                  <small className="text-mocha-fg-muted ml-2 text-base font-medium">
                    {journee.prixUnite}
                  </small>
                </p>
                <p className="text-mocha-fg-muted text-[15px]">{journee.prixCadre}</p>
              </div>

              <div id="garantie" className={`${styles.garantie} text-base leading-normal`}>
                <b>{journee.garantieTitre}</b> {journee.garantieDebut}
                <strong className="font-bold">{journee.garantieEngagement}</strong>
                <span className="text-mocha-fg-muted mt-1 block text-sm">{journee.condition}</span>
              </div>

              <div>
                <Link
                  href="/journee-ia"
                  className={`${styles.boutonOrange} bg-terracotta-on-mocha hover:bg-mocha-fg ${BOUTON} focus-visible:ring-terracotta-on-mocha focus-visible:ring-offset-mocha w-full`}
                >
                  {journee.lienDetail}
                  <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
                </Link>
                <p className="mt-2.5 text-center text-[15px]">
                  {journee.decideDebut}{" "}
                  <Link href={{ pathname: "/appel", query: { depuis: "accueil-bloc-journee" } }}>
                    {journee.decideLien}
                  </Link>
                </p>
              </div>

              <p className="text-mocha-fg-muted border-border-on-mocha border-t pt-4 text-sm">
                {journee.mention}
              </p>
            </article>

            {/* Carte blanche : l'appel de 45 minutes. */}
            <article
              id="appel"
              className={`${styles.blanche} ${styles.carte} flex flex-col gap-3 rounded-3xl p-6 sm:p-8 lg:sticky lg:top-24 lg:col-span-5`}
            >
              <p className="text-fg-soft text-[13px] font-bold tracking-[0.06em] uppercase">
                {appel.surtitre}
              </p>
              <h3 className="text-fg text-2xl font-bold tracking-tight">{appel.titre}</h3>
              <p className="text-lg leading-snug">{appel.accroche}</p>
              <p className="mt-1.5 text-[15px] font-bold">{appel.repartezAvec}</p>
              <ul className={styles.coches}>
                {appel.repartez.map((ligne) => (
                  <li key={ligne.fort}>
                    <b>{ligne.fort}</b>
                    {ligne.fin}
                  </li>
                ))}
              </ul>
              <p className="text-fg-soft text-[15px]">{appel.franchise}</p>
              <Link
                href={{ pathname: "/appel", query: { depuis: "accueil-bloc-appel" } }}
                className={BOUTON_PLEIN}
              >
                <CalendarDays className="h-5 w-5 shrink-0" aria-hidden="true" />
                Réserver un appel
              </Link>
              <p className="text-fg-soft text-sm">
                {appel.sousBouton}{" "}
                <Link
                  href={{ pathname: "/contact", query: { depuis: "accueil-bloc-appel" } }}
                  className={LIEN}
                >
                  {appel.lienEcrire}
                </Link>
              </p>
            </article>
          </div>

          <section
            aria-labelledby="en-bref-titre"
            className={`${styles.enBref} text-fg-soft mt-8 px-5 py-4 text-[15px] leading-relaxed`}
          >
            <h2
              id="en-bref-titre"
              className="text-terracotta mb-1.5 text-[13px] font-extrabold tracking-[0.12em] uppercase"
            >
              {enBref.titre}
            </h2>
            <p data-en-bref>{T(enBref.texte)}</p>
            <p className="mt-2 flex flex-wrap gap-x-2 text-[15px]">
              <Link href="/journee-ia" className={`${LIEN} inline-flex min-h-11 items-center`}>
                {enBref.lienJournee}
              </Link>
              <span aria-hidden="true">·</span>
              <Link
                href={{ pathname: "/appel", query: { depuis: "accueil-en-bref" } }}
                className={`${LIEN} inline-flex min-h-11 items-center`}
              >
                {enBref.lienDiagnostic}
              </Link>
            </p>
          </section>
        </Container>
      </section>

      {/* ───────────── 3. DES IMPLÉMENTATIONS SUR MESURE ───────────── */}
      <section
        id="mise-en-place"
        aria-labelledby="h-mise-en-place"
        className={`bg-paper ${SECTION_CLAIRE}`}
      >
        <Container>
          <FadeInOnView>
            <Numero n="02" />
            <h2 id="h-mise-en-place" className={H2}>
              {miseEnPlace.titre}
            </h2>
            <p className={CHAPEAU}>{miseEnPlace.chapeau}</p>
            <ul className="mt-10 grid gap-5 md:grid-cols-3">
              {miseEnPlace.cartes.map((carte, i) => {
                const Schema = SCHEMAS[i] ?? SchemaDevis;
                return (
                  <li
                    key={carte.titre}
                    className={`${styles.carte} ${styles.carteSable} ${styles.carteSurvol} p-6`}
                  >
                    <div className={styles.schema}>
                      <Schema />
                    </div>
                    <span className={ETIQUETTE}>{miseEnPlace.etiquette}</span>
                    <h3 className="text-fg mt-2.5 text-lg font-bold tracking-tight">
                      {carte.titre}
                    </h3>
                    <p className="text-fg-soft mt-1.5">{carte.texte}</p>
                  </li>
                );
              })}
            </ul>
            <div className="mt-10 text-center">
              <Link href="/implementation" className={BOUTON_PLEIN}>
                {miseEnPlace.lienTout}
                <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
              </Link>
              <ul className="mt-6 flex flex-wrap justify-center gap-2.5">
                {miseEnPlace.prestations.map((p) => {
                  const { href, Icon } = PRESTATIONS[p.id];
                  return (
                    <li key={p.id}>
                      <Link
                        href={href}
                        className="bg-sand border-sand-deep text-terracotta-deep hover:bg-terracotta hover:border-terracotta hover:text-paper inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2.5 text-[15px] font-semibold transition-colors"
                      >
                        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                        {p.libelle}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </FadeInOnView>
        </Container>
      </section>

      {/* ───────────── 4. WILLIAMS ───────────── */}
      <section
        id="williams"
        aria-labelledby="h-williams"
        className={`${styles.sombre} bg-mocha text-mocha-fg ${SECTION}`}
      >
        <Container className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-5">
            <div
              className={`${styles.photo} bg-sand relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-3xl lg:aspect-[4/5]`}
            >
              <Image
                src="/illustrations/home-founder-william.avif"
                alt={williams.altPortrait}
                fill
                sizes="(min-width: 1024px) 440px, (min-width: 640px) 448px, 90vw"
                className="object-cover"
              />
            </div>
          </div>
          <div className="lg:col-span-7">
            <Numero n="03" ton="sombre" />
            <h2 id="h-williams" className={H2_SOMBRE}>
              {williams.titre}
            </h2>
            <p className="text-mocha-fg-muted mt-5 text-lg leading-relaxed">{williams.texte}</p>
            <blockquote
              className={`${styles.citation} ${styles.citationSombre} text-mocha-fg mt-6 px-5 py-4 text-lg`}
            >
              {williams.citation}
            </blockquote>
            <p className="text-mocha-fg-muted mt-3 text-sm font-semibold">{williams.signature}</p>
            <p className="mt-4">
              <Link
                href={{ pathname: "/equipe/[slug]", params: { slug: "williams" } }}
                className={LIEN_SOMBRE}
              >
                {williams.lien}
              </Link>
            </p>
          </div>
        </Container>
      </section>

      {/* ───────────── 5. SIX RAISONS ───────────── */}
      <section id="raisons" aria-labelledby="h-raisons" className={FOND_SABLE}>
        <Container>
          <Numero n="04" ton="sable" />
          <h2 id="h-raisons" className={`${H2} mb-10`}>
            {CONTENU.raisonsTitre}
          </h2>
          <div className={styles.cartes}>
            <WhyDifferentiators
              raisons={CONTENU.raisons.map((r) => ({
                titre: r.titre,
                texte: T(r.texte),
                slot: r.slot,
              }))}
            />
          </div>
        </Container>
      </section>

      {/* ───────────── 6. PME ET TPE · SECTEURS · FRANCE ───────────── */}
      <section id="pme-tpe" aria-labelledby="h-pme-tpe" className={`bg-terracotta-soft ${SECTION}`}>
        <Container>
          <Numero n="05" />
          <h2 id="h-pme-tpe" className={H2}>
            {pmeTpe.titre}
          </h2>
          <p className={`${CHAPEAU} mb-10`}>{pmeTpe.chapeau}</p>
          <div className={styles.cartes}>
            <AudienceSegments
              segments={[
                {
                  id: "tpe",
                  title: pmeTpe.tpe.titre,
                  lead: pmeTpe.tpe.accroche,
                  detail: pmeTpe.tpe.detail,
                },
                {
                  id: "pme",
                  title: pmeTpe.pme.titre,
                  lead: pmeTpe.pme.accroche,
                  detail: pmeTpe.pme.detail,
                },
              ]}
              isFr
            />
          </div>
          <p className={`${styles.filet} mt-6 text-sm`}>
            <Link href="/formations" className={LIEN}>
              {pmeTpe.lienFormations}
            </Link>
            {" · "}
            <Link href="/audit" className={LIEN}>
              {pmeTpe.lienAudit}
            </Link>
          </p>

          <h2 id="secteurs" className={`${H2} border-border-strong mt-16 border-t pt-12`}>
            {secteurs.titre}
          </h2>
          <p className={CHAPEAU}>{secteurs.chapeau}</p>
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {secteurs.tuiles.map((tuile) => (
              <li key={tuile.slug}>
                <figure
                  className={`${styles.carte} bg-sand relative m-0 aspect-square overflow-hidden rounded-2xl`}
                >
                  <Image
                    src={`/illustrations/secteurs/${tuile.slug}.avif`}
                    alt={tuile.alt}
                    width={1600}
                    height={1000}
                    sizes="(min-width: 1366px) 200px, (min-width: 1024px) 16vw, (min-width: 640px) 30vw, 45vw"
                    className="h-full w-full object-cover"
                  />
                  <figcaption className="text-paper absolute inset-x-0 bottom-0 bg-gradient-to-b from-transparent via-black/55 to-black/90 px-3 pt-10 pb-2.5 text-sm font-bold">
                    {tuile.libelle}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
          <UnsplashCreditList
            credits={secteurs.tuiles.map((tuile) => {
              const credit = SECTOR_PHOTO_CREDITS[tuile.slug as ClientSectorSlug];
              return { photographer: credit.photographer, photographerUrl: credit.photographerUrl };
            })}
          />
          <p className="text-fg-soft mt-4 text-base">
            {secteurs.aussiDebut}{" "}
            {secteurs.aussi.map((secteur) => (
              <span key={secteur}>
                {secteur}
                {" · "}
              </span>
            ))}
            <Link href={"/secteurs" as never} className={LIEN}>
              {secteurs.lienTous}
            </Link>
          </p>

          <div
            id="france"
            className={`${styles.panneauFrance} mt-16 grid items-center gap-10 lg:grid-cols-[1fr_480px] lg:gap-16`}
          >
            <div>
              <h2 className={H2}>{france.titre}</h2>
              <p className={CHAPEAU}>{france.texte}</p>
              <p className="mt-3 text-sm">
                <Link href="/implantations" className={LIEN}>
                  {france.lien}
                </Link>
              </p>
              <ul className="text-fg-soft mt-5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {regions.map((region) => (
                  <li key={region.slug}>
                    <Link
                      href={{
                        pathname: "/implantations/[region]",
                        params: { region: region.slug },
                      }}
                      data-cta-tracking="audit_local_coverage_region"
                      className="hover:text-terracotta-deep inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                    >
                      {region.nameFr}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <CarteFrance ariaLabel={france.ariaCarte} />
          </div>
        </Container>
      </section>

      {/* ───────────── 7. QUESTIONS FRÉQUENTES ───────────── */}
      <section id="questions" aria-labelledby="h-questions" className={FOND_SABLE}>
        <Container className="max-w-4xl">
          <div className={`${styles.carte} rounded-3xl p-5 sm:p-10`}>
            <Numero n="06" />
            <h2 id="h-questions" className={H2}>
              {faq.titre}
            </h2>
            <p className={`${CHAPEAU} mb-6`}>{faq.chapeau}</p>
            <FaqAccordion items={questionsAccueil()} emitJsonLd={false} />
            <p
              className={`${styles.filet} text-fg-soft mt-6 flex flex-wrap items-center gap-x-3 text-[15px]`}
            >
              <span>{faq.liensDebut}</span>
              <Link
                href={{ pathname: "/faq/[slug]", params: { slug: "ai-act-2026" } }}
                className={`${LIEN} inline-flex min-h-11 items-center`}
              >
                {faq.liens.aiAct}
              </Link>
              <Link href="/roi" className={`${LIEN} inline-flex min-h-11 items-center`}>
                {faq.liens.roi}
              </Link>
              <Link href="/guide-ia" className={`${LIEN} inline-flex min-h-11 items-center`}>
                {faq.liens.guide}
              </Link>
              <Link href="/tarifs" className={`${LIEN} inline-flex min-h-11 items-center`}>
                {faq.liens.tarifs}
              </Link>
              <Link href="/faq" className={`${LIEN} inline-flex min-h-11 items-center`}>
                {faq.liens.faq}
              </Link>
            </p>
            <p className="text-fg-muted mt-1 text-sm">
              {faq.source.debut}{" "}
              <a
                href={faq.source.url}
                target="_blank"
                rel="noopener"
                className="underline underline-offset-4"
              >
                {faq.source.libelle}
                <span className="sr-only">{faq.source.nouvelOnglet}</span>
              </a>
            </p>
          </div>
        </Container>
      </section>

      {/* ───────────── 8. APPEL FINAL ───────────── */}
      <section
        id="rendez-vous"
        aria-labelledby="h-rendez-vous"
        className={`bg-terracotta text-mocha-fg ${SECTION}`}
      >
        <Container>
          <Numero n="07" clair />
          <h2
            id="h-rendez-vous"
            className="text-mocha-fg text-[28px] leading-[1.06] font-extrabold tracking-[-0.03em] text-balance md:text-[40px] lg:text-5xl"
          >
            {CONTENU.rendezVous.titre}
          </h2>
          <p className="text-mocha-fg mt-4 max-w-3xl text-lg leading-relaxed">
            {CONTENU.rendezVous.texte}
          </p>
          <div className="mt-8">
            <Link
              href={{ pathname: "/appel", query: { depuis: "accueil-final" } }}
              className={`${BOUTON} bg-paper text-terracotta hover:bg-mocha-fg focus-visible:ring-paper focus-visible:ring-offset-terracotta`}
            >
              <CalendarDays className="h-5 w-5 shrink-0" aria-hidden="true" />
              Réserver un appel
            </Link>
          </div>
          <p className="text-mocha-fg mt-4 text-[15px]">{CONTENU.rendezVous.reassurance}</p>
          <p className="text-mocha-fg mt-2 text-sm">
            {CONTENU.rendezVous.ecrireDebut}{" "}
            <Link
              href={{ pathname: "/contact", query: { depuis: "accueil-final" } }}
              className="text-mocha-fg underline underline-offset-4"
            >
              {CONTENU.rendezVous.ecrireLien}
            </Link>
          </p>
          <p className="text-mocha-fg mt-8 text-right text-sm">
            {CONTENU.rendezVous.miseAJour}{" "}
            <time dateTime={DATE_MISE_A_JOUR_JOURNEE_IA}>
              {new Intl.DateTimeFormat("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              }).format(dateMaj)}
            </time>
            .
          </p>
        </Container>
      </section>

      {jsonLdAccueil().map((noeud, i) => (
        <JsonLd key={i} data={noeud} />
      ))}

      {/* Barre collante mobile : apparaît après 600 px de défilement, se retire en bas. */}
      <StickyMobileCta
        href="/appel?depuis=accueil-mobile"
        label="Échanger 45 min — sans engagement"
        track="home-sticky-mobile"
        threshold={600}
      />
    </div>
  );
}
