// Server Component — fiche détail d'UNE formation du catalogue V2 (template partagé
// par les 17 formations). Refonte 2026-07-05 (Will) : mise en page repensée pour
// que le visiteur comprenne TOUT immédiatement.
//   - HÉRO avec CARTE INFOS-CLÉS proéminente (prix + durée + format + public +
//     prérequis + matériel + CTA) — tout dérivé du SSOT (catalog-v2 + facts).
//   - Riche en visuels : carte, image immersive, cartes à icônes, blocs colorés.
//   - PAS d'horaires détaillés. Secteurs + villes (compact). Ordre optimisé 2026.
//
// AUCUN prix en dur (matrice pricing.ts). AUCUN avis/note fabriqué (E-E-A-T).
// Financement gaté Phase B (jamais logo OPCO/FT, jamais CPF).

import type { ReactNode } from "react";
import Image from "next/image";
import {
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  GraduationCap,
  Laptop,
  MapPin,
  Phone,
  Sparkles,
  Target,
  Users,
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
import { RelatedKnowledge } from "@/components/services/RelatedKnowledge";
import { ClientLogosMarqueeBand } from "@/components/services/audit/ClientLogosMarqueeBand";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
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
  getFormationScenePhotos,
} from "@/content/formations/catalog-v2-facts";
import { formatAmount, type FormationBracket } from "@/content/pricing";
import { CLIENT_SECTORS } from "@/content/sectors";
import { getVillesIndexableNow } from "@/content/villes";
import { buildCourseJsonLd, buildHowToJsonLd, buildServiceJsonLd, SITE_URL } from "@/lib/seo";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { isQualiopiPublicDisclosureEnabled } from "@/server/qualiopi/config/flag";
import { formatMentionMarqueQualiopi } from "@/server/qualiopi/legal/legal-mentions";

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
  const mentionMarque = formatMentionMarqueQualiopi("Actions de formation");

  // formatAmount renvoie déjà « … € HT » → NE PAS re-suffixer « HT ».
  const priceValue = typeof entryPrice === "number" ? formatAmount(entryPrice, "fr") : "Sur devis";
  const modalitesLabel = formatModalitesFr(getFormationModalites(f));
  const materiel = getFormationMateriel(f);
  const prerequis = f.prerequisFr ?? "Aucun — la formation démarre à votre niveau.";
  const image = getFormationImage(f);
  const casUsage = getFormationCasUsage(f);
  const scenePhotos = getFormationScenePhotos(f);
  const objectifsPhoto = scenePhotos[0];

  const los = brackets
    .map((b) => Number.parseInt(b.split("-")[0] ?? "", 10))
    .filter((n) => Number.isFinite(n));
  const his = brackets
    .map((b) => Number.parseInt(b.split("-")[1] ?? "", 10))
    .filter((n) => Number.isFinite(n));
  const groupSizeLabel =
    his.length > 0
      ? `${Math.min(...los)} à ${Math.max(...his)} participants · intra-entreprise`
      : "Intra-entreprise, sur site";

  // ── CARTE INFOS-CLÉS (héro) — tout depuis le SSOT ───────────────────────────
  const factRows: ReadonlyArray<{ icon: typeof Clock; label: string; value: string }> = [
    { icon: Clock, label: "Durée", value: formatDureeFr(f) },
    { icon: MapPin, label: "Format", value: modalitesLabel },
    { icon: Users, label: "Public visé", value: f.publicViseFr },
    { icon: CheckCircle2, label: "Prérequis", value: prerequis },
    { icon: Laptop, label: "Matériel", value: materiel },
  ];

  const modalitesRows: ReadonlyArray<{ icon: typeof Clock; label: string; value: string }> = [
    { icon: MapPin, label: "Format", value: modalitesLabel },
    { icon: Clock, label: "Durée", value: formatDureeFr(f) },
    { icon: Users, label: "Groupe", value: "Intra-entreprise — vos équipes uniquement" },
    { icon: GraduationCap, label: "Intervenant", value: "Un formateur IA expert Axion-IA" },
    { icon: Target, label: "Public visé", value: f.publicViseFr },
    { icon: CheckCircle2, label: "Prérequis", value: prerequis },
    { icon: Laptop, label: "Matériel", value: materiel },
  ];

  const heroChips = [
    "Sur vos vrais outils",
    "Intra-entreprise",
    "Opérationnel·le dès le lendemain",
  ];

  // ── JSON-LD ─────────────────────────────────────────────────────────────────
  // Toutes les images de la fiche (héro + scènes + cas d'usage) → Course.image
  // (association à l'entité pour Google Images), dédupliquées, en URL absolue.
  const pageImageUrls = [
    ...new Set([
      image.src,
      ...scenePhotos.map((p) => p.src),
      ...casUsage.map((c) => c.imageSrc).filter((s): s is string => Boolean(s)),
    ]),
  ].map((src) => `${SITE_URL}${src}`);
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
    image: pageImageUrls,
  };
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
  const villes = getVillesIndexableNow().slice(0, 48);

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

      {/* ── HÉRO — contenu (gauche) + CARTE INFOS-CLÉS (droite) ──────────── */}
      <section className="bg-halo-warm relative overflow-hidden py-12 md:py-16 lg:py-20">
        <Container className="relative">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
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
              <ul className="mt-6 flex flex-wrap gap-2">
                {heroChips.map((chip) => (
                  <li
                    key={chip}
                    className="bg-terracotta-soft text-terracotta-deep border-terracotta/25 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold tracking-tight"
                  >
                    <ArrowRight aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
                    {chip}
                  </li>
                ))}
              </ul>
            </div>

            {/* CARTE INFOS-CLÉS */}
            <aside className="border-terracotta/25 bg-canvas shadow-card rounded-3xl border-2 p-6 lg:sticky lg:top-24 lg:p-7">
              <div className="border-border border-b pb-5">
                <p className="text-fg-muted text-[12px] font-semibold tracking-wide uppercase">
                  À partir de
                </p>
                <p
                  className="text-terracotta mt-1 text-[2.5rem] leading-none font-medium tabular-nums"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {priceValue}
                </p>
                <p className="text-fg-muted mt-2 text-[13px]">{groupSizeLabel}</p>
              </div>
              <dl className="divide-border flex flex-col divide-y">
                {factRows.map((row) => (
                  <div key={row.label} className="flex items-start gap-3 py-3">
                    <span className="bg-terracotta/10 text-terracotta mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                      <row.icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <dt className="text-fg-muted text-[11.5px] font-semibold tracking-wide uppercase">
                        {row.label}
                      </dt>
                      <dd className="text-fg text-[14px] leading-snug font-medium">{row.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
              <Cta
                href="/appel"
                size="lg"
                className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta mt-5 w-full justify-center"
              >
                <Phone aria-hidden="true" className="h-4 w-4" />
                Réserver un appel
              </Cta>
              <Cta href="/contact" variant="ghost" size="md" className="mt-2 w-full justify-center">
                Nous écrire
              </Cta>
              <p className="text-fg-muted mt-2 text-center text-[12px]">
                Renseignements sans engagement
              </p>
              {ofPublic ? (
                <p className="text-fg-muted mt-4 text-center text-[12px] leading-relaxed">
                  Organisme{" "}
                  <Link
                    href={"/certification-qualiopi" as never}
                    className="text-terracotta underline"
                  >
                    Qualiopi
                  </Link>{" "}
                  ·{" "}
                  <Link
                    href={"/financement-opco-france-travail" as never}
                    className="text-terracotta underline"
                  >
                    finançable OPCO / France Travail
                  </Link>
                </p>
              ) : null}
            </aside>
          </div>
        </Container>
      </section>

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

      {/* ── OBJECTIFS (2 colonnes + photo) ───────────────────────────────── */}
      {f.objectifsFr.length > 0 ? (
        <Section
          eyebrow="Objectifs pédagogiques"
          title="Ce que chacun"
          titleEm="saura faire"
          description="À l'issue de la formation, voici les compétences acquises et pratiquées en séance."
        >
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
            <ul className="flex flex-col gap-3.5">
              {f.objectifsFr.map((o) => (
                <li
                  key={o}
                  className="border-border bg-canvas shadow-subtle flex items-start gap-3 rounded-xl border p-4"
                >
                  <CheckCircle2
                    aria-hidden="true"
                    className="text-terracotta mt-0.5 h-5 w-5 shrink-0"
                    strokeWidth={2}
                  />
                  <span className="text-fg text-[15px] leading-relaxed">{o}</span>
                </li>
              ))}
            </ul>
            {objectifsPhoto ? (
              <Image
                src={objectifsPhoto.src}
                alt={objectifsPhoto.altFr}
                width={1000}
                height={667}
                sizes="(max-width: 1024px) 100vw, 48vw"
                loading="lazy"
                className="shadow-card aspect-[3/2] h-auto w-full rounded-2xl object-cover lg:sticky lg:top-24"
              />
            ) : null}
          </div>
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

      {/* ── BANDEAU PHOTO (immersion — image spécifique de la formation) ──── */}
      <Container className="py-6 md:py-8">
        <div className="relative overflow-hidden rounded-3xl">
          <Image
            src={image.src}
            alt={image.altFr}
            width={1600}
            height={640}
            sizes="(max-width: 1366px) 100vw, 1366px"
            loading="lazy"
            className="h-[240px] w-full object-cover md:h-[340px]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
            <p className="text-[13px] font-bold tracking-[0.16em] text-white/80 uppercase">
              Sur site, dans vos locaux
            </p>
            <p className="mt-2 max-w-2xl text-xl leading-tight font-semibold text-white md:text-2xl">
              Sur vos vrais outils, vos vrais dossiers — opérationnel dès le lendemain.
            </p>
          </div>
          {f.imageCredit ? (
            <div className="absolute top-3 right-3">
              <UnsplashCredit
                photographerName={f.imageCredit.name}
                photographerUrl={f.imageCredit.url}
                className="text-[10px] text-white/70"
              />
            </div>
          ) : null}
        </div>
      </Container>

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
                  className="from-terracotta-soft border-terracotta/20 flex flex-col items-center gap-1 rounded-2xl border bg-gradient-to-b to-transparent p-6 text-center"
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

      {/* ── CAS D'USAGE CONCRETS (avec petites images) ───────────────────── */}
      {casUsage.length > 0 ? (
        <Section
          tone="sand"
          eyebrow="Sur vos vrais dossiers"
          title="Cas d'usage"
          titleEm="concrets"
          description="Des exemples directement applicables dans votre métier, travaillés en atelier."
        >
          <ul className="xs:grid-cols-2 mx-auto grid max-w-5xl gap-4 lg:grid-cols-3">
            {casUsage.map((c) => (
              <li
                key={c.texteFr}
                className="border-border bg-canvas shadow-subtle flex flex-col overflow-hidden rounded-2xl border"
              >
                {c.imageSrc ? (
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Image
                      src={c.imageSrc}
                      alt={c.texteFr}
                      fill
                      sizes="(min-width: 1024px) 30vw, (min-width: 479px) 50vw, 100vw"
                      loading="lazy"
                      className="object-cover"
                    />
                  </div>
                ) : null}
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <Sparkles aria-hidden="true" className="text-terracotta h-4 w-4" />
                  <p className="text-fg-soft flex-1 text-sm leading-relaxed">{c.texteFr}</p>
                  {c.imageCredit ? (
                    <UnsplashCredit
                      photographerName={c.imageCredit.name}
                      photographerUrl={c.imageCredit.url}
                      className="text-[10px]"
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* ── MODALITÉS — cartes à icônes (AVANT les secteurs) ─────────────── */}
      <Section eyebrow="Modalités" title="Toutes les informations" titleEm="pratiques">
        <dl className="xs:grid-cols-2 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {modalitesRows.map((row) => (
            <div
              key={row.label}
              className="border-border bg-canvas shadow-subtle flex flex-col gap-2 rounded-2xl border p-5"
            >
              <span className="bg-terracotta/10 text-terracotta inline-flex h-10 w-10 items-center justify-center rounded-xl">
                <row.icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <dt className="text-fg-muted text-[12px] font-semibold tracking-wide uppercase">
                {row.label}
              </dt>
              <dd className="text-fg text-sm leading-snug font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* ── SECTEURS D'ACTIVITÉ ──────────────────────────────────────────── */}
      <Section
        tone="sand"
        eyebrow="Tous secteurs"
        title="Adaptée à"
        titleEm="votre secteur"
        description="Le contenu et les exemples sont ajustés à votre domaine d'activité et à vos métiers."
      >
        <ul className="xs:grid-cols-2 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {CLIENT_SECTORS.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/secteurs/${s.slug}` as never}
                className="shadow-subtle hover:shadow-elevated group bg-canvas flex h-full flex-col overflow-hidden rounded-2xl transition hover:-translate-y-0.5"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={`/illustrations/secteurs/${s.slug}.avif`}
                    alt={`Formation IA « ${f.titreFr} » pour ${s.fullFr} — Axion-IA`}
                    fill
                    sizes="(min-width: 1024px) 20vw, (min-width: 768px) 33vw, (min-width: 479px) 50vw, 100vw"
                    loading="lazy"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <span
                    aria-hidden="true"
                    className="bg-canvas/90 shadow-subtle absolute top-2.5 left-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-base"
                  >
                    {s.emoji}
                  </span>
                </div>
                <div className="flex flex-1 items-center justify-between gap-2 p-4">
                  <span className="text-fg text-sm font-semibold tracking-tight">{s.labelFr}</span>
                  <ArrowRight aria-hidden="true" className="text-terracotta h-4 w-4 shrink-0" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── TARIF (tranches par effectif) ────────────────────────────────── */}
      {brackets.length > 0 ? (
        <Section
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
                      <p className="mt-4 flex items-baseline gap-1.5">
                        <span
                          className="text-fg text-[clamp(2.5rem,5vw,3.5rem)] leading-none font-medium tracking-tight tabular-nums"
                          style={{ fontFamily: "var(--font-serif)" }}
                        >
                          {formatAmount(price, "fr", { compact: true })}
                        </span>
                        <span className="text-fg-muted text-sm font-semibold">HT</span>
                      </p>
                      <p className="text-fg-soft mt-4 text-base leading-relaxed">
                        {formatDureeFr(f)}, dans vos locaux. {f.accrocheFr}
                      </p>
                      <div className="mt-auto pt-6">
                        <Cta href="/appel" size="lg" className="w-full justify-center">
                          Réserver un appel
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

      {/* ── QUALIOPI / OPCO (logo officiel + financement, gaté Phase B) ──── */}
      {ofPublic ? (
        <Section
          tone="paper"
          eyebrow="Sérieux & financement"
          title="Un organisme"
          titleEm="certifié Qualiopi"
          description="Un gage de qualité — et l'assurance d'une formation finançable."
        >
          <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-8 lg:grid-cols-[0.75fr_1.25fr]">
            <div className="border-border bg-canvas shadow-subtle mx-auto flex w-full max-w-[360px] items-center justify-center rounded-2xl border p-8">
              <Image
                src="/qualiopi/axion-ia-qualiopi.png"
                alt="Logo Qualiopi — Axion-IA, organisme de formation certifié (catégorie : actions de formation)"
                width={360}
                height={240}
                quality={90}
                sizes="(max-width: 1024px) 70vw, 28vw"
                className="h-auto w-full max-w-[280px] object-contain"
              />
            </div>
            <div className="flex flex-col gap-4">
              <p className="text-fg text-base leading-relaxed" data-speakable>
                {mentionMarque}
              </p>
              <p className="text-fg-soft text-sm leading-relaxed">
                Parce que nous sommes certifiés Qualiopi, cette formation est éligible aux
                financements de la formation professionnelle : <strong>OPCO</strong> pour vos
                salariés, <strong>France Travail</strong> pour les demandeurs d’emploi — en tout ou
                partie selon votre situation. Nous montons le dossier avec vous.
              </p>
              <div className="flex flex-wrap gap-3">
                <Cta href="/certification-qualiopi" variant="outline" size="md">
                  Notre certification Qualiopi
                </Cta>
                <Cta href="/financement-opco-france-travail" variant="outline" size="md">
                  Financer cette formation
                </Cta>
              </div>
            </div>
          </div>
        </Section>
      ) : null}

      {/* ── BANDEAU CONTACT ──────────────────────────────────────────────── */}
      <ContactBand
        isFr={isFr}
        eyebrow="Une question sur cette formation ?"
        title="On vous oriente,"
        titleEm="à votre rythme"
        description="Un échange pour comprendre vos équipes et vos objectifs, et vous dire le format qui vous correspond. Sans engagement."
        track="-formation-detail"
      />

      {/* ── FAQ (FaqAccordion centralisé — émet FAQPage + Speakable) ─────── */}
      {f.faqs.length > 0 ? (
        <Section tone="paper" eyebrow="FAQ" title="Questions" titleEm="fréquentes">
          <div className="mx-auto max-w-3xl">
            <FaqAccordion
              items={f.faqs.map((q, i) => ({
                id: `faq-${i + 1}`,
                question: q.question,
                answer: q.reponse,
              }))}
            />
          </div>
        </Section>
      ) : null}

      {/* ── VILLES (maillage compact — pas d'espace superflu) ────────────── */}
      <Section
        tone="sand"
        eyebrow="Partout en France"
        title="Cette formation,"
        titleEm="près de chez vous"
        description="Nous intervenons en présentiel dans vos locaux, dans toute la France."
      >
        <ul role="list" className="flex flex-wrap gap-x-2 gap-y-2.5">
          {villes.map((v) => (
            <li key={v.slug}>
              <Link
                href={`/formations/par-ville/${v.slug}` as never}
                className="text-fg-soft bg-canvas border-border hover:border-terracotta hover:text-terracotta inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-medium transition"
              >
                Formation IA {v.nameFr}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── FORMATIONS COMPLÉMENTAIRES (cartes contrastées) ──────────────── */}
      {siblings.length > 0 ? (
        <Section tone="paper" eyebrow="Autres formations" title="Pour aller" titleEm="plus loin">
          <div className="xs:grid-cols-2 grid gap-5 lg:grid-cols-4">
            {siblings.map((s) => (
              <Link
                key={s.id}
                href={`/formations/${s.slugFr}` as never}
                className="border-border-strong bg-canvas shadow-subtle hover:border-terracotta hover:shadow-card group flex h-full flex-col rounded-2xl border-2 p-6 transition hover:-translate-y-1"
              >
                <span className="text-terracotta-deep text-[11px] font-bold tracking-wide uppercase">
                  {getGammeMeta(s.gamme).labelFr} · {formatDureeFr(s)}
                </span>
                <p className="text-fg mt-2.5 text-[15px] leading-snug font-semibold">{s.titreFr}</p>
                <p className="text-fg-soft mt-2 line-clamp-2 flex-1 text-sm leading-relaxed">
                  {s.accrocheFr}
                </p>
                <span className="text-terracotta bg-terracotta/10 mt-4 inline-flex items-center gap-1 self-start rounded-full px-3 py-1 text-[13px] font-semibold transition group-hover:gap-2">
                  Découvrir
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      <RelatedKnowledge service="interventions-formations" />

      {/* ── CTA FINAL (2 CTA, renseignements sans engagement) ────────────── */}
      <CtaBlock
        eyebrow="Démarrer"
        title="Former vos équipes"
        titleEm="à l'IA"
        description="Un formateur IA expert intervient sur votre site, sur vos vrais outils. Vos équipes gagnent des heures dès la première session. Contactez-nous pour des renseignements, sans engagement."
        cta={
          <>
            <Cta
              href="/appel"
              size="lg"
              className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
            >
              <Phone aria-hidden="true" className="h-4 w-4" />
              Réserver un appel
            </Cta>
            <Cta href="/contact" variant="outline" size="lg">
              Nous écrire
            </Cta>
          </>
        }
        tone="dark"
      />

      <JsonLd data={serviceJsonLd} />
      <JsonLd data={courseJsonLd} />
      {howToJsonLd ? <JsonLd data={howToJsonLd} /> : null}
    </>
  );
}
