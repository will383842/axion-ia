// Server Component — fiche détail d'UNE formation du catalogue V2 (template partagé
// par les 17 formations). Refonte 2026-07-05 (Will) :
//   - Carte « infos clés » (À partir de · Durée h+j · Format · Public · Prérequis
//     · Matériel) — TOUT dérivé du SSOT (catalog-v2 + catalog-v2-facts), jamais hardcodé.
//   - PAS d'horaires détaillés (programme sans heures d'horloge).
//   - Sections claires : Avant/Après · Objectifs · Programme · Résultats concrets &
//     mesurables · Cas d'usage · Modalités · Financement (gaté) · FAQ · complémentaires.
//   - Parité image/texte (image par gamme ou spécifique).
//
// AUCUN prix en dur (matrice pricing.ts). AUCUN avis/note fabriqué (E-E-A-T).
// Financement gaté Phase B (jamais logo OPCO/FT, jamais CPF).

import type { ReactNode } from "react";
import Image from "next/image";
import {
  ArrowRight,
  ArrowRightLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  GraduationCap,
  Laptop,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Target,
  Users,
  Wallet,
} from "lucide-react";

import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { ContactBand } from "@/components/sections/ContactBand";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { RelatedKnowledge } from "@/components/services/RelatedKnowledge";
import { ClientLogosMarqueeBand } from "@/components/services/audit/ClientLogosMarqueeBand";
import { InterventionFaqList } from "@/components/sections/intervention-parts/InterventionFaqList";
import {
  type FormationV2,
  FORMATIONS_V2,
  getFormationV2Brackets,
  getFormationV2EntryPrice,
  getFormationV2Price,
} from "@/content/formations/catalog-v2";
import {
  formationDureeIso,
  getDureeMeta,
  getGammeMeta,
} from "@/content/formations/catalog-v2-meta";
import {
  formatDureeFr,
  formatModalitesFr,
  getFormationCasUsage,
  getFormationCourseModes,
  getFormationImage,
  getFormationMateriel,
  getFormationModalites,
} from "@/content/formations/catalog-v2-facts";
import { findBookableBySlug } from "@/content/booking-catalog";
import { formatAmount, type FormationBracket } from "@/content/pricing";
import {
  buildCourseJsonLd,
  buildFaqJsonLd,
  buildHowToJsonLd,
  buildServiceJsonLd,
  SITE_URL,
} from "@/lib/seo";
import { FinancingMicro } from "@/components/qualiopi/FinancingBadges";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { isQualiopiPublicDisclosureEnabled } from "@/server/qualiopi/config/flag";

/** « 2-15 » → « 2 à 15 personnes ». */
function bracketLabel(b: FormationBracket): string {
  const parts = b.split("-");
  return `${parts[0] ?? ""} à ${parts[1] ?? ""} personnes`;
}

interface Props {
  formation: FormationV2;
  locale: Locale;
}

export function FormationDetailPage({ formation: f, locale }: Props): ReactNode {
  const isFr = locale === "fr";
  const gamme = getGammeMeta(f.gamme);
  const duree = getDureeMeta(f.duree);
  const path = `/formations/${f.slugFr}`;
  const entryPrice = getFormationV2EntryPrice(f);
  const brackets = getFormationV2Brackets(f);
  const ofPublic = isQualiopiPublicDisclosureEnabled();

  const isBookable = Boolean(findBookableBySlug(f.slugFr));
  const reserveHref = "/appel";

  const priceValue =
    typeof entryPrice === "number" ? `${formatAmount(entryPrice, "fr")} HT` : "Sur devis";
  const modalites = getFormationModalites(f);
  const modalitesLabel = formatModalitesFr(modalites);
  const materiel = getFormationMateriel(f);
  const prerequis = f.prerequisFr ?? "Aucun — la formation démarre à votre niveau.";
  const image = getFormationImage(f);
  const casUsage = getFormationCasUsage(f);

  // ── Infos clés (carte) — TOUT depuis le SSOT ────────────────────────────────
  const facts: ReadonlyArray<{ icon: typeof Wallet; label: string; value: string }> = [
    { icon: Wallet, label: "À partir de", value: priceValue },
    { icon: Clock, label: "Durée", value: formatDureeFr(f) },
    { icon: MapPin, label: "Format", value: modalitesLabel },
    { icon: Users, label: "Public visé", value: f.publicViseFr },
    { icon: GraduationCap, label: "Prérequis", value: prerequis },
    { icon: Laptop, label: "Matériel", value: materiel },
  ];

  // ── Modalités (récap) ───────────────────────────────────────────────────────
  const modalitesRows: ReadonlyArray<{ label: string; value: string }> = [
    { label: "Format", value: modalitesLabel },
    { label: "Durée", value: formatDureeFr(f) },
    { label: "Groupe", value: "Intra-entreprise — vos équipes uniquement" },
    { label: "Intervenant", value: "Un formateur IA expert Axion-IA" },
    { label: "Public visé", value: f.publicViseFr },
    { label: "Prérequis", value: prerequis },
    { label: "Matériel", value: materiel },
  ];

  // ── JSON-LD ─────────────────────────────────────────────────────────────────
  const imageUrl = `${SITE_URL}${image.src}`;
  const serviceJsonLd = buildServiceJsonLd({
    locale,
    path,
    name: `${f.titreFr} · Axion-IA`,
    description: f.accrocheFr,
    serviceType: "AI training",
    area: "Worldwide",
  });
  const courseJsonLd = {
    ...buildCourseJsonLd({
      locale,
      path,
      name: f.titreFr,
      description: f.accrocheFr,
      courseMode: [...getFormationCourseModes(f)],
      duration: formationDureeIso(f.duree),
      audienceType:
        "Équipes, dirigeants et collaborateurs opérationnels (TPE, PME, ETI, grandes entreprises)",
      about: "IA opérationnelle (ChatGPT, Claude, Mistral, Copilot, agents IA, automatisations)",
      ...(typeof entryPrice === "number" ? { priceEurHt: entryPrice } : {}),
    }),
    image: [imageUrl],
  };
  const faqJsonLd = buildFaqJsonLd({
    items: f.faqs.map((q) => ({ question: q.question, answer: q.reponse })),
  });
  const programmeSteps = f.programme.flatMap((s) => s.steps).filter((st) => st.titre !== "Pause");
  const howToJsonLd =
    programmeSteps.length > 0
      ? buildHowToJsonLd({
          locale,
          path,
          name: `Comment se déroule ${f.titreFr}`,
          description: f.accrocheFr,
          steps: programmeSteps.map((st) => ({ name: st.titre, text: st.titre })),
        })
      : null;

  const siblings = FORMATIONS_V2.filter(
    (x) => x.id !== f.id && (x.gamme === f.gamme || x.duree === f.duree),
  ).slice(0, 4);

  const breadcrumbItems = [
    { href: "/formations", label: "Formations IA" },
    { href: `/formations/duree/${duree.slug}`, label: duree.labelFr },
    { href: path, label: f.titreFr },
  ];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* ── HÉRO (2 colonnes : contenu + image) ──────────────────────────── */}
      <section className="bg-halo-warm relative overflow-hidden py-12 md:py-16 lg:py-20">
        <Container className="relative">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            <div className="max-w-2xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {gamme.labelFr} · {formatDureeFr(f)}
              </p>
              <h1 className="display-editorial text-fg mt-5">{f.h1Fr}</h1>
              <p className="text-fg-soft mt-6 text-lg leading-relaxed md:text-xl" data-speakable>
                {f.accrocheFr}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="bg-terracotta text-mocha-fg rounded-full px-4 py-1.5 text-base font-bold tracking-tight tabular-nums">
                  À partir de {priceValue}
                </span>
                <span className="text-fg-soft text-[13px]">{modalitesLabel}</span>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                {isBookable ? (
                  <Cta
                    href={reserveHref}
                    size="lg"
                    className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
                  >
                    <CalendarDays aria-hidden="true" className="h-4 w-4" />
                    Poser une option
                  </Cta>
                ) : (
                  <Cta
                    href="/appel"
                    size="lg"
                    className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
                  >
                    <Phone aria-hidden="true" className="h-4 w-4" />
                    Réserver un appel
                  </Cta>
                )}
                <Cta href="/contact" variant="outline" size="lg">
                  <Mail aria-hidden="true" className="h-4 w-4" />
                  Nous écrire
                </Cta>
              </div>
            </div>
            <div className="relative">
              <Image
                src={image.src}
                alt={image.altFr}
                width={1000}
                height={667}
                priority
                sizes="(max-width: 1024px) 100vw, 44vw"
                className="shadow-card aspect-[3/2] h-auto w-full rounded-2xl object-cover"
              />
              {f.imageCredit ? (
                <UnsplashCredit
                  photographerName={f.imageCredit.name}
                  photographerUrl={f.imageCredit.url}
                  className="mt-1.5 text-[11px]"
                />
              ) : null}
            </div>
          </div>
        </Container>
      </section>

      {/* ── INFOS CLÉS (carte) — tout depuis le SSOT ─────────────────────── */}
      <Container className="relative z-10 -mt-6">
        <dl className="border-border bg-canvas shadow-card grid grid-cols-2 gap-x-6 gap-y-6 rounded-2xl border p-6 md:grid-cols-3 lg:grid-cols-6 lg:p-7">
          {facts.map((fact) => (
            <div key={fact.label} className="flex flex-col gap-1.5">
              <dt className="text-fg-muted inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-wide uppercase">
                <fact.icon aria-hidden="true" className="text-terracotta h-3.5 w-3.5" />
                {fact.label}
              </dt>
              <dd className="text-fg text-[13.5px] leading-snug font-medium">{fact.value}</dd>
            </div>
          ))}
        </dl>
        {ofPublic ? (
          <div className="mt-4">
            <FinancingMicro seed={`formation-${f.slugFr}`} />
            <p className="text-fg-muted mt-2 text-[13px]">
              Organisme certifié{" "}
              <Link href={"/certification-qualiopi" as never} className="text-terracotta underline">
                Qualiopi
              </Link>{" "}
              — formation{" "}
              <Link
                href={"/financement-opco-france-travail" as never}
                className="text-terracotta underline"
              >
                finançable OPCO / France Travail
              </Link>
              , en tout ou partie selon votre situation.
            </p>
          </div>
        ) : null}
      </Container>

      {/* ── PREUVE SOCIALE (logos) ───────────────────────────────────────── */}
      <ClientLogosMarqueeBand isFr={isFr} />

      {/* ── AVANT / APRÈS ────────────────────────────────────────────────── */}
      {f.avantApresFr ? (
        <Section
          tone="paper"
          eyebrow="La transformation"
          title="Avant / après"
          titleEm="la formation"
          description="Ce qui change concrètement dans le quotidien de vos équipes."
        >
          <div className="mx-auto grid max-w-4xl grid-cols-1 items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
            <div className="border-border bg-bg flex flex-col gap-2 rounded-2xl border p-6">
              <span className="text-fg-muted text-[12px] font-bold tracking-[0.16em] uppercase">
                Avant
              </span>
              <p className="text-fg-soft text-[15px] leading-relaxed">{f.avantApresFr.avant}</p>
            </div>
            <div className="hidden items-center justify-center md:flex">
              <ArrowRightLeft aria-hidden="true" className="text-terracotta h-7 w-7" />
            </div>
            <div className="border-terracotta/30 bg-terracotta-soft flex flex-col gap-2 rounded-2xl border p-6">
              <span className="text-terracotta-deep text-[12px] font-bold tracking-[0.16em] uppercase">
                Après
              </span>
              <p className="text-fg text-[15px] leading-relaxed font-medium" data-speakable>
                {f.avantApresFr.apres}
              </p>
            </div>
          </div>
        </Section>
      ) : null}

      {/* ── OBJECTIFS PÉDAGOGIQUES ───────────────────────────────────────── */}
      {f.objectifsFr.length > 0 ? (
        <Section
          eyebrow="Objectifs pédagogiques"
          title="Ce que chacun"
          titleEm="saura faire"
          description="À l'issue de la formation, voici les compétences acquises et pratiquées en séance."
        >
          <ul className="xs:grid-cols-2 mx-auto grid max-w-4xl gap-4">
            {f.objectifsFr.map((o) => (
              <li key={o} className="flex items-start gap-3">
                <CheckCircle2
                  aria-hidden="true"
                  className="text-terracotta mt-0.5 h-5 w-5 shrink-0"
                  strokeWidth={2}
                />
                <span className="text-fg-soft text-[15px] leading-relaxed">{o}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* ── PROGRAMME (SANS horaires) ────────────────────────────────────── */}
      <Section
        tone="sand"
        eyebrow="Le programme"
        title="Le déroulé"
        titleEm="de la formation"
        description="La trame reste celle-ci ; le contenu s'adapte à vos outils, votre secteur et vos cas réels. Cadrage en amont par un appel."
      >
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
          {f.programme.map((sectionDay, idx) => (
            <div
              key={idx}
              className="border-border bg-canvas shadow-subtle flex flex-col gap-3 rounded-2xl border p-6"
            >
              <p className="text-terracotta-deep text-[13px] font-bold tracking-[0.12em] uppercase">
                {sectionDay.titreFr}
              </p>
              <ul className="flex flex-col gap-2.5">
                {sectionDay.steps
                  .filter((st) => st.titre !== "Pause")
                  .map((st) => (
                    <li key={st.titre} className="text-fg-soft flex items-start gap-2.5 text-sm">
                      <ArrowRight
                        aria-hidden="true"
                        className="text-terracotta mt-1 h-3.5 w-3.5 shrink-0"
                        strokeWidth={2.5}
                      />
                      <span className="leading-relaxed">{st.titre}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* ── RÉSULTATS CONCRETS & MESURABLES ──────────────────────────────── */}
      <Section
        eyebrow="En résumé"
        title="Des résultats concrets"
        titleEm="et mesurables"
        description="Le bénéfice réel de la formation, au-delà des slides."
      >
        <div className="mx-auto max-w-4xl">
          {f.resultatsFr && f.resultatsFr.length > 0 ? (
            <ul className="xs:grid-cols-2 mb-8 grid gap-4 lg:grid-cols-3">
              {f.resultatsFr.map((r) => (
                <li
                  key={r.label}
                  className="border-border bg-canvas shadow-subtle flex flex-col items-center gap-1 rounded-2xl border p-6 text-center"
                >
                  <span
                    className="text-terracotta text-[clamp(2rem,4vw,2.75rem)] leading-none font-medium tabular-nums"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {r.valeur}
                  </span>
                  <span className="text-fg-soft text-sm leading-snug">{r.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="border-border bg-canvas flex flex-col gap-2 rounded-2xl border p-6">
              <span className="text-fg inline-flex items-center gap-2 text-[15px] font-semibold">
                <Clock aria-hidden="true" className="text-terracotta h-4 w-4" />
                Le temps que vous gagnez
              </span>
              <p className="text-fg-soft text-sm leading-relaxed" data-speakable>
                {f.equationTempsFr}
              </p>
            </div>
            <div className="border-border bg-canvas flex flex-col gap-2 rounded-2xl border p-6">
              <span className="text-fg inline-flex items-center gap-2 text-[15px] font-semibold">
                <Target aria-hidden="true" className="text-terracotta h-4 w-4" />
                Le bénéfice direct
              </span>
              <p className="text-fg-soft text-sm leading-relaxed">{f.beneficeDirigeantFr}</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── CAS D'USAGE CONCRETS ─────────────────────────────────────────── */}
      {casUsage.length > 0 ? (
        <Section
          tone="paper"
          eyebrow="Sur vos vrais dossiers"
          title="Cas d'usage"
          titleEm="concrets"
          description="Des exemples directement applicables dans votre métier, travaillés en atelier."
        >
          <ul className="xs:grid-cols-2 mx-auto grid max-w-4xl gap-4 lg:grid-cols-3">
            {casUsage.map((c) => (
              <li
                key={c}
                className="border-border bg-canvas shadow-subtle text-fg-soft rounded-2xl border p-5 text-sm leading-relaxed"
              >
                <Sparkles aria-hidden="true" className="text-terracotta mb-2 h-4 w-4" />
                {c}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* ── TRANCHES DE PRIX ─────────────────────────────────────────────── */}
      {brackets.length > 0 ? (
        <Section
          tone="sand"
          eyebrow="Tarif"
          title={brackets.length > 1 ? "Un tarif selon" : "Tarif pour"}
          titleEm={brackets.length > 1 ? "votre effectif" : "votre équipe"}
          description="Programme identique quelle que soit la tranche. Le prix dépend uniquement du nombre de participants. Intra-entreprise, dans vos locaux."
        >
          <Container className="max-w-5xl">
            <ul className="grid gap-5 md:gap-6 lg:grid-cols-2">
              {brackets.map((b, i) => {
                const price = getFormationV2Price(f, b);
                if (typeof price !== "number") return null;
                return (
                  <li key={b} className="relative">
                    {i === 0 && brackets.length > 1 ? (
                      <span className="bg-terracotta text-mocha-fg shadow-subtle absolute -top-3 left-6 z-10 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase">
                        <Sparkles aria-hidden="true" className="h-3 w-3" />
                        Le plus choisi
                      </span>
                    ) : null}
                    <article
                      className={`bg-paper hover:shadow-card relative flex h-full flex-col rounded-3xl border-2 p-7 transition-all lg:p-8 ${
                        i === 0 && brackets.length > 1
                          ? "border-terracotta shadow-card"
                          : "border-border-strong hover:border-terracotta"
                      }`}
                    >
                      <p className="text-fg-muted text-[12px] font-bold tracking-[0.16em] uppercase">
                        {bracketLabel(b)}
                      </p>
                      <p
                        className="text-fg mt-4 text-[clamp(2.5rem,5vw,3.5rem)] leading-none font-medium tracking-tight tabular-nums"
                        style={{ fontFamily: "var(--font-serif)" }}
                      >
                        {formatAmount(price, "fr")}
                      </p>
                      <p className="text-fg-muted mt-1 text-xs">HT</p>
                      <p className="text-fg-soft mt-4 text-base leading-relaxed">
                        {formatDureeFr(f)}, dans vos locaux. {f.accrocheFr}
                      </p>
                      <div className="mt-auto pt-6">
                        <Cta
                          href={isBookable ? reserveHref : "/appel"}
                          size="lg"
                          className="w-full justify-center"
                        >
                          {isBookable ? "Poser une option" : "Réserver un appel"}
                          <ArrowRight aria-hidden="true" className="h-4 w-4" />
                        </Cta>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          </Container>
        </Section>
      ) : null}

      {/* ── MODALITÉS (récap) ────────────────────────────────────────────── */}
      <Section tone="paper" eyebrow="Modalités" title="Toutes les informations" titleEm="pratiques">
        <dl className="border-border bg-canvas divide-border mx-auto max-w-3xl divide-y rounded-2xl border">
          {modalitesRows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-1 gap-1 p-4 md:grid-cols-[160px_1fr] md:gap-4"
            >
              <dt className="text-fg text-sm font-semibold">{row.label}</dt>
              <dd className="text-fg-soft text-sm leading-relaxed">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* ── BANDEAU CONTACT ──────────────────────────────────────────────── */}
      <ContactBand
        isFr={isFr}
        eyebrow="Une question sur cette formation ?"
        title="On vous oriente,"
        titleEm="à votre rythme"
        description="Un échange pour comprendre vos équipes et vos objectifs, et vous dire le format qui vous correspond. Sans engagement."
        track="-formation-detail"
      />

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      {f.faqs.length > 0 ? (
        <Section tone="sand" eyebrow="FAQ" title="Questions" titleEm="fréquentes">
          <InterventionFaqList
            items={f.faqs.map((q) => ({
              qFr: q.question,
              qEn: q.question,
              aFr: q.reponse,
              aEn: q.reponse,
            }))}
            isFr={isFr}
          />
        </Section>
      ) : null}

      {/* ── FORMATIONS COMPLÉMENTAIRES ───────────────────────────────────── */}
      {siblings.length > 0 ? (
        <Section tone="paper" eyebrow="Autres formations" title="Pour aller" titleEm="plus loin">
          <div className="xs:grid-cols-2 grid gap-4 lg:grid-cols-4">
            {siblings.map((s) => (
              <Link
                key={s.id}
                href={`/formations/${s.slugFr}` as never}
                className="border-border bg-bg hover:border-terracotta hover:shadow-card flex h-full flex-col rounded-2xl border p-6 transition"
              >
                <p className="text-fg text-[15px] leading-snug font-semibold">{s.titreFr}</p>
                <p className="text-fg-soft mt-2 line-clamp-2 flex-1 text-sm leading-relaxed">
                  {s.accrocheFr}
                </p>
                <span className="text-terracotta-deep mt-4 inline-flex items-center gap-1 text-[13px] font-medium">
                  Découvrir
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr={`La formation « ${f.titreFr} »`}
        serviceLabelEn={`The « ${f.titreFr} » training`}
        serviceSlug="interventions"
        tone="sand"
      />

      <RelatedKnowledge service="interventions-formations" />

      {/* ── CTA FINAL ────────────────────────────────────────────────────── */}
      <CtaBlock
        eyebrow="Démarrer"
        title="Former vos équipes"
        titleEm="à l'IA"
        description="Un formateur IA expert intervient sur votre site, sur vos vrais outils. Vos équipes gagnent des heures dès la première session. Aucun engagement avant signature."
        cta={
          <Cta
            href={isBookable ? reserveHref : "/appel"}
            size="lg"
            className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
          >
            {isBookable ? (
              <CalendarDays aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Phone aria-hidden="true" className="h-4 w-4" />
            )}
            {isBookable ? "Poser une option sur le calendrier" : "Réserver un appel"}
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={serviceJsonLd} />
      <JsonLd data={courseJsonLd} />
      <JsonLd data={faqJsonLd} />
      {howToJsonLd ? <JsonLd data={howToJsonLd} /> : null}
    </>
  );
}
