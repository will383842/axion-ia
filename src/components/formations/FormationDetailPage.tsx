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
  CheckCircle2,
  Clock,
  GraduationCap,
  Laptop,
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
import { formationDureeIso, getCategorieMeta } from "@/content/formations/catalog-v2-meta";
import {
  FORMATION_EFFECTIF_DEFAUT,
  formatDureeFr,
  formatModalitesFr,
  getFormationAccessibilite,
  getFormationCasUsage,
  getFormationCourseModes,
  getFormationDelaiAcces,
  getFormationEffectif,
  getFormationEvaluation,
  getFormationImage,
  getFormationImageCredit,
  getFormationMateriel,
  getFormationMethodes,
  getFormationModalites,
  getFormationOutils,
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
  // Refonte 2026-07-19 : l'axe de rattachement est la CATÉGORIE (générale /
  // métier / secteur) — le séminaire n'en a pas (rubrique à part).
  const categorieMeta = f.categorie ? getCategorieMeta(f.categorie) : null;
  const axeLabel = f.axeLabelFr ?? categorieMeta?.shortFr ?? (f.seminaire ? "Séminaire" : null);
  const path = `/formations/${f.slugFr}`;
  const entryPrice = getFormationV2EntryPrice(f);
  const brackets = getFormationV2Brackets(f);
  const ofPublic = isQualiopiPublicDisclosureEnabled();
  const mentionMarque = formatMentionMarqueQualiopi("Actions de formation");

  // formatAmount renvoie déjà « … € HT » → NE PAS re-suffixer « HT ».
  const priceValue = typeof entryPrice === "number" ? formatAmount(entryPrice, "fr") : "Sur devis";
  const modalitesLabel = formatModalitesFr(getFormationModalites(f));
  const materiel = getFormationMateriel(f);
  const effectif = getFormationEffectif(f);
  const prerequis = f.prerequisFr ?? "Aucun — la formation démarre à votre niveau.";
  const image = getFormationImage(f);
  const imageCredit = getFormationImageCredit(f);
  const casUsage = getFormationCasUsage(f);
  // Mentions indicateur 1 (délai d'accès, méthodes, évaluation, accessibilité) —
  // obligations Code du travail génériques, NON gatées Qualiopi (aucun claim de
  // certification). Défauts centralisés dans catalog-v2-facts, surchargeables.
  const delaiAcces = getFormationDelaiAcces(f);
  const methodes = getFormationMethodes(f);
  const evaluation = getFormationEvaluation(f);
  const accessibilite = getFormationAccessibilite(f);
  // « reste à charge » = mention financement (OPCO), pas un tarif produit.
  const financeMention = "Finançable OPCO — jusqu’à 0 € de reste à charge selon votre situation."; // price-exempt

  // ── FAQ : spécifiques (SSOT) + génériques DÉRIVÉES des faits (centralisé, DRY,
  //    toujours en phase avec la durée/le format/le matériel) + financement gaté.
  const genericFaqs: ReadonlyArray<{ question: string; reponse: string }> = [
    {
      question: `À qui s'adresse la formation « ${f.titreFr} » ?`,
      reponse: f.publicViseFr,
    },
    {
      question: "Quelle est la durée et le format de la formation ?",
      reponse: `${formatDureeFr(f)}. ${modalitesLabel}. Le groupe est intra-entreprise : uniquement vos équipes, ${effectif.toLowerCase()}.`,
    },
    {
      question: "Faut-il des prérequis ou du matériel particulier ?",
      reponse: `${prerequis} Côté matériel : ${materiel.toLowerCase()}.`,
    },
    {
      question: "Quels outils d'IA vais-je apprendre à utiliser ?",
      reponse: getFormationOutils(f),
    },
    {
      question: "La formation est-elle adaptée à notre entreprise ?",
      reponse:
        f.categorie === "metier" || f.categorie === "secteur"
          ? `Oui : le programme cadre est celui ${f.categorie === "metier" ? "du métier" : "du secteur"} (${f.axeLabelFr ?? f.titreFr}), et les ateliers travaillent sur les documents et cas réels apportés par vos participants — préparés en amont avec vous lors du cadrage.`
          : "Oui. Les cas d'usage travaillés (mails, comptes-rendus, notes, présentations…) valent dans tout secteur, et vous appliquez la méthode à vos propres situations pendant les exercices. Pour aller plus loin sur une fonction ou un secteur précis, voyez nos formations par métier et par secteur d'activité.",
    },
    {
      question: "Que se passe-t-il après la formation ?",
      reponse:
        "Vos équipes repartent avec des acquis opérationnels dès le lendemain. Le savoir-faire est structuré et reste dans l'entreprise, même en cas de départ.",
    },
  ];
  const financingFaq: ReadonlyArray<{ question: string; reponse: string }> = ofPublic
    ? [
        {
          question: "Cette formation est-elle finançable ?",
          reponse:
            "Oui, en tout ou partie selon votre situation. En tant qu'organisme certifié Qualiopi, nos formations IA sont éligibles aux financements de la formation professionnelle (OPCO pour les salariés, France Travail pour les demandeurs d'emploi). Nous étudions votre prise en charge et montons le dossier avec vous.",
        },
      ]
    : [];
  const allFaqs = [
    ...f.faqs.map((q) => ({ question: q.question, reponse: q.reponse })),
    ...genericFaqs,
    ...financingFaq,
  ];

  const los = brackets
    .map((b) => Number.parseInt(b.split("-")[0] ?? "", 10))
    .filter((n) => Number.isFinite(n));
  const his = brackets
    .map((b) => Number.parseInt(b.split("-")[1] ?? "", 10))
    .filter((n) => Number.isFinite(n));
  // L'effectif annoncé au programme PRIME sur les tranches tarifaires : celles-ci
  // vont jusqu'à 30 pers. et sont vides en « sur devis », alors que le programme
  // engage contractuellement une jauge (15 · 10 · 2 à 6 · 50).
  const groupSizeLabel = f.effectifFr
    ? `${f.effectifFr} · intra-entreprise`
    : his.length > 0
      ? `${Math.min(...los)} à ${Math.max(...his)} participants · intra-entreprise`
      : `${FORMATION_EFFECTIF_DEFAUT} · intra-entreprise`;

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
    {
      icon: Users,
      label: "Groupe",
      value: `Intra-entreprise — vos équipes uniquement, ${effectif.toLowerCase()}`,
    },
    { icon: GraduationCap, label: "Intervenant", value: "Un formateur IA expert Axion-IA" },
    { icon: Target, label: "Public visé", value: f.publicViseFr },
    { icon: CheckCircle2, label: "Prérequis", value: prerequis },
    { icon: Laptop, label: "Matériel", value: materiel },
  ];

  const heroChips = [
    "Cas d’usage transversaux",
    "Intra-entreprise",
    "Opérationnel·le dès le lendemain",
  ];

  // Mentions réglementaires indicateur 1 — 4 blocs neutres (Code du travail).
  const indicateurRows: ReadonlyArray<{ icon: typeof Clock; label: string; value: string }> = [
    { icon: Clock, label: "Délai d'accès", value: delaiAcces },
    { icon: GraduationCap, label: "Méthodes pédagogiques", value: methodes },
    { icon: CheckCircle2, label: "Modalités d'évaluation", value: evaluation },
    { icon: Users, label: "Accessibilité & handicap", value: accessibilite },
  ];

  // ── JSON-LD ─────────────────────────────────────────────────────────────────
  // Toutes les images de la fiche (héro + scènes + cas d'usage) → Course.image
  // (association à l'entité pour Google Images) en ImageObject RICHES (caption),
  // dédupliquées, URL absolues — parité avec les pages landing.
  const pageImageMap = new Map<string, string>();
  pageImageMap.set(image.src, image.altFr);
  for (const c of casUsage) {
    if (c.imageSrc && !pageImageMap.has(c.imageSrc)) pageImageMap.set(c.imageSrc, c.texteFr);
  }
  const courseImages = [...pageImageMap.entries()].map(([src, caption]) => ({
    "@type": "ImageObject",
    url: `${SITE_URL}${src}`,
    contentUrl: `${SITE_URL}${src}`,
    caption,
  }));
  // Service AVEC speakable (parité page-level speakable des landings).
  const serviceJsonLd = buildServiceJsonLd({
    locale,
    path,
    name: `${f.titreFr} · Axion-IA`,
    description: f.accrocheFr,
    serviceType: "AI training",
    area: "Worldwide",
    speakable: true,
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
      about: "IA opérationnelle (ChatGPT, Claude, Gemini, assistants IA, agents, automatisations)",
      ...(typeof entryPrice === "number" ? { priceEurHt: entryPrice } : {}),
    }),
    image: courseImages,
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

  // Formations liées : même catégorie d'abord, puis même durée (jamais le séminaire).
  const siblings = [
    ...FORMATIONS_V2.filter(
      (x) => x.id !== f.id && !x.seminaire && f.categorie && x.categorie === f.categorie,
    ),
    ...FORMATIONS_V2.filter(
      (x) => x.id !== f.id && !x.seminaire && x.categorie !== f.categorie && x.duree === f.duree,
    ),
  ].slice(0, 4);
  const villes = getVillesIndexableNow().slice(0, 48);

  const breadcrumbItems = [
    { href: "/formations", label: "Formations IA" },
    ...(categorieMeta?.slug
      ? [{ href: `/formations/${categorieMeta.slug}`, label: categorieMeta.labelFr }]
      : []),
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
                {axeLabel ? `${axeLabel} · ` : ""}
                {formatDureeFr(f)}
                {f.scindable ? " · scindable 2×1j" : ""}
              </p>
              <p className="text-terracotta-deep mt-4 text-lg font-bold tracking-tight md:text-xl">
                Formation « {f.titreFr} »
              </p>
              <h1 className="display-editorial text-fg mt-2">{f.h1Fr}</h1>
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
              <div className="mt-8 flex flex-wrap items-center gap-3">
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
                <span className="text-fg-muted text-[12px]">Renseignements sans engagement</span>
              </div>
            </div>

            {/* CARTE INFOS-CLÉS — photo de la formation en tête (disposition
                type fiche référence : carte média + récap + CTA), crédit CGU §9. */}
            <aside className="border-terracotta/25 bg-canvas shadow-card overflow-hidden rounded-3xl border-2 lg:sticky lg:top-24 lg:mt-8">
              <div className="relative">
                <Image
                  src={image.src}
                  alt={image.altFr}
                  width={1280}
                  height={800}
                  priority
                  sizes="(max-width: 1024px) 100vw, 460px"
                  className="aspect-[16/9] w-full object-cover"
                  quality={80}
                />
                {imageCredit ? (
                  <UnsplashCredit
                    photographerName={imageCredit.name}
                    photographerUrl={imageCredit.url}
                    className="bg-paper/85 absolute right-2 bottom-2 !mt-0 rounded-full px-2 py-0.5 !text-[9.5px]"
                  />
                ) : null}
              </div>
              <div className="p-6 pt-5 lg:p-7 lg:pt-5">
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
                  {ofPublic ? (
                    <div className="bg-terracotta text-mocha-fg mt-4 flex items-start gap-2 rounded-xl p-3">
                      <Wallet aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                      <span className="text-[13px] leading-snug font-bold">{financeMention}</span>
                    </div>
                  ) : null}
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
                        <dd className="text-fg text-[14px] leading-snug font-medium">
                          {row.value}
                        </dd>
                      </div>
                    </div>
                  ))}
                </dl>
                {ofPublic ? (
                  <div className="border-border mt-5 flex flex-col items-center gap-2 border-t pt-5">
                    <Image
                      src="/qualiopi/qualiopi-actions-de-formation-axion-ia.webp"
                      alt="Logo Qualiopi — Axion-IA, organisme de formation certifié : la certification qualité a été délivrée au titre des actions de formation."
                      width={700}
                      height={423}
                      className="h-auto w-full max-w-[220px] object-contain"
                    />
                    <p className="text-fg-muted text-center text-[12px] leading-relaxed">
                      <Link
                        href={"/certification-qualiopi" as never}
                        className="text-terracotta underline"
                      >
                        Certifié Qualiopi
                      </Link>{" "}
                      ·{" "}
                      <Link
                        href={"/financement-opco-france-travail" as never}
                        className="text-terracotta underline"
                      >
                        Financer cette formation
                      </Link>
                    </p>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        </Container>
      </section>

      {/* ── NAV ANCRES — accès direct aux sections clés (disposition type
          fiche référence : « Programme · Tarifs · Infos pratiques · FAQ »). */}
      <nav
        aria-label="Sections de la fiche formation"
        className="border-border bg-paper/95 sticky top-16 z-30 border-y backdrop-blur-sm"
      >
        <Container className="flex items-center gap-1 overflow-x-auto py-2.5">
          {(
            [
              ["#programme", "Programme"],
              ["#cas-usage", "Cas d'usage"],
              ["#tarif", "Tarif"],
              ["#infos-pratiques", "Infos pratiques"],
              ["#faq", "FAQ"],
            ] as const
          ).map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="text-fg-soft hover:text-terracotta hover:bg-terracotta-soft shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition"
            >
              {label}
            </a>
          ))}
          <span className="ml-auto hidden shrink-0 md:block">
            <Cta
              href="/appel"
              size="sm"
              className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep"
            >
              Réserver un appel
            </Cta>
          </span>
        </Container>
      </nav>

      {/* ── PREUVE SOCIALE (logos) ───────────────────────────────────────── */}
      <ClientLogosMarqueeBand isFr={isFr} />

      {/* ── OBJECTIFS & CAS D'USAGE (fusionnés — cartes + images) ────────── */}
      {/* Objectifs pédagogiques en CHECKLIST compacte (décision Will 2026-07-19 :
          les cartes cas-d'usage sans image faisaient du remplissage — on affiche
          les objectifs Qualiopi, exigés publics par l'indicateur 1, en 2 colonnes).
          Les cas d'usage marketing restent visibles sur les cartes du catalogue. */}
      <Section
        id="cas-usage"
        className="scroll-mt-28"
        tone="sand"
        eyebrow="Objectifs pédagogiques"
        title="À l'issue, chaque participant"
        titleEm="est capable de…"
        description="Des compétences directement applicables au quotidien, travaillées en atelier sur vos cas réels."
      >
        <ul className="mx-auto grid max-w-4xl gap-3 md:grid-cols-2">
          {f.objectifsFr.map((o) => (
            <li
              key={o}
              className="border-border bg-bg shadow-subtle flex items-start gap-3 rounded-2xl border p-4"
            >
              <CheckCircle2
                aria-hidden="true"
                className="text-terracotta mt-0.5 h-5 w-5 shrink-0"
                strokeWidth={2.25}
              />
              <span className="text-fg text-[14.5px] leading-relaxed font-medium">{o}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── PROGRAMME DÉTAILLÉ — disposition type fiche référence : modules
          riches à GAUCHE (numéro, points, QCM, « Livrable inclus » mis en
          valeur), carte RÉCAP STICKY à DROITE (durée/format/effectif/prix/CTA).
          Server-only : sticky en CSS pur, aucun JS. */}
      <Section
        id="programme"
        className="scroll-mt-28"
        tone="sand"
        eyebrow="Le programme"
        title="Programme"
        titleEm="détaillé"
        description="La trame reste celle-ci ; le contenu s'adapte à vos outils, votre secteur et vos cas réels. Cadrage en amont par un appel."
      >
        <div className="mx-auto grid max-w-6xl items-start gap-6 lg:grid-cols-[1fr_340px] lg:gap-8">
          {/* Colonne modules */}
          <div className="flex flex-col gap-5">
            {f.programme.map((sectionDay, idx) => {
              // « Module 2 — Titre » / « Jour 1 — Titre » → badge + titre.
              const dash = sectionDay.titreFr.indexOf("—");
              const badge =
                dash > 0 ? sectionDay.titreFr.slice(0, dash).trim() : `Module ${idx + 1}`;
              const titre =
                dash > 0 ? sectionDay.titreFr.slice(dash + 1).trim() : sectionDay.titreFr;
              const livrables = sectionDay.steps.filter((st) => st.temps === "Livrable");
              const hasQcm = sectionDay.steps.some((st) => /qcm|quiz/i.test(st.titre));
              const steps = sectionDay.steps.filter(
                (st) =>
                  st.titre !== "Pause" && st.temps !== "Livrable" && !/^qcm|^quiz/i.test(st.titre),
              );
              return (
                <article
                  key={idx}
                  className="border-border bg-bg shadow-card flex flex-col gap-4 rounded-2xl border p-6 sm:p-7"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="bg-terracotta text-mocha-fg inline-flex items-center rounded-full px-3 py-1 text-[11.5px] font-bold tracking-wide uppercase">
                      {badge}
                    </span>
                    {hasQcm ? (
                      <span className="border-border text-fg-muted inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold">
                        <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
                        Quiz de validation des acquis
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-fg text-lg leading-snug font-semibold tracking-tight">
                    {titre}
                  </h3>
                  <ul className="flex flex-col gap-2.5">
                    {steps.map((st) => (
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
                  {livrables.map((liv) => (
                    <p
                      key={liv.titre}
                      className="bg-terracotta-soft border-terracotta/25 text-terracotta-deep flex items-start gap-2.5 rounded-xl border p-3.5 text-[13.5px] leading-snug font-semibold"
                    >
                      <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        <span className="mr-1 font-bold uppercase">Livrable inclus :</span>
                        {liv.titre}
                      </span>
                    </p>
                  ))}
                </article>
              );
            })}
          </div>

          {/* Carte récap sticky (à droite du programme) */}
          <aside className="border-terracotta/25 bg-paper shadow-card flex flex-col gap-4 rounded-3xl border-2 p-6 lg:sticky lg:top-32">
            <p className="text-fg text-lg leading-snug font-semibold tracking-tight">{f.titreFr}</p>
            <dl className="divide-border flex flex-col divide-y">
              {(
                [
                  ["Durée", `${formatDureeFr(f)}${f.scindable ? " — scindable 2×1j" : ""}`],
                  ["Format", modalitesLabel],
                  ["Participants", groupSizeLabel],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="text-fg-muted shrink-0 text-[11.5px] font-semibold tracking-wide uppercase">
                    {label}
                  </dt>
                  <dd className="text-fg text-right text-[13.5px] leading-snug font-medium">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="bg-canvas rounded-2xl p-4 text-center">
              <p className="text-fg-muted text-[11.5px] font-semibold tracking-wide uppercase">
                Prix par groupe
              </p>
              <p
                className="text-terracotta mt-1 text-[2rem] leading-none font-medium tabular-nums"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {priceValue}
              </p>
            </div>
            {ofPublic ? (
              <p className="text-fg-soft flex items-start gap-2 text-[12.5px] leading-snug">
                <Wallet aria-hidden="true" className="text-terracotta mt-0.5 h-4 w-4 shrink-0" />
                {financeMention}
              </p>
            ) : null}
            <Cta
              href="/appel"
              size="lg"
              className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta w-full justify-center"
            >
              <Phone aria-hidden="true" className="h-4 w-4" />
              Réserver un appel
            </Cta>
            <Cta href="/contact" variant="outline" size="lg" className="w-full justify-center">
              Nous écrire
            </Cta>
            <p className="text-fg-muted text-center text-[11.5px]">
              Renseignements sans engagement — réponse sous 24-48 h
            </p>
          </aside>
        </div>
      </Section>

      {/* ── RÉSULTATS CONCRETS & MESURABLES ──────────────────────────────── */}
      <Section
        eyebrow="Résultats & bénéfices"
        title="Des résultats concrets"
        titleEm="et mesurables"
        description="Le bénéfice réel de la formation pour vos équipes et pour l'entreprise, au-delà des slides."
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
                Le bénéfice pour l’entreprise
              </span>
              <p className="text-fg-soft text-sm leading-relaxed">{f.beneficeDirigeantFr}</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── MODALITÉS — cartes à icônes (AVANT les secteurs) ─────────────── */}
      <Section
        id="infos-pratiques"
        className="scroll-mt-28"
        tone="paper"
        eyebrow="Modalités"
        title="Toutes les informations"
        titleEm="pratiques"
      >
        <dl className="xs:grid-cols-2 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {modalitesRows.map((row) => (
            <div
              key={row.label}
              className={`border-border bg-bg shadow-card hover:shadow-elevated group flex flex-col gap-3 rounded-2xl border p-5 transition hover:-translate-y-1 ${
                row.label === "Public visé" ? "xs:col-span-2 md:col-span-3 lg:col-span-2" : ""
              }`}
            >
              <span className="bg-terracotta text-mocha-fg shadow-cta-terracotta inline-flex h-11 w-11 items-center justify-center rounded-xl transition group-hover:scale-110">
                <row.icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <dt className="text-terracotta-deep text-[11.5px] font-bold tracking-[0.1em] uppercase">
                {row.label}
              </dt>
              <dd className="text-fg text-sm leading-snug font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* ── INFORMATIONS RÉGLEMENTAIRES (indicateur 1 — Code du travail) ──── */}
      <Section
        eyebrow="Informations réglementaires"
        title="Délais, méthodes,"
        titleEm="évaluation & accessibilité"
        description="Les informations essentielles avant l'inscription, conformément au Code du travail."
      >
        <dl className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
          {indicateurRows.map((row) => (
            <div
              key={row.label}
              className="border-border bg-bg shadow-card flex flex-col gap-3 rounded-2xl border p-6"
            >
              <span className="bg-terracotta text-mocha-fg shadow-cta-terracotta inline-flex h-11 w-11 items-center justify-center rounded-xl">
                <row.icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <dt className="text-terracotta-deep text-[11.5px] font-bold tracking-[0.1em] uppercase">
                {row.label}
              </dt>
              <dd className="text-fg-soft text-sm leading-relaxed">{row.value}</dd>
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
          id="tarif"
          className="scroll-mt-28"
          eyebrow="Tarif"
          title={brackets.length > 1 ? "Un tarif selon" : "Tarif pour"}
          titleEm={brackets.length > 1 ? "votre effectif" : "votre équipe"}
          description="Prix fixe par groupe — jamais par personne. Intra-entreprise, dans vos locaux ou à distance."
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

      {/* ── FAQ (FaqAccordion centralisé — spécifiques + génériques SSOT) ── */}
      {allFaqs.length > 0 ? (
        <Section
          id="faq"
          className="scroll-mt-28"
          eyebrow="FAQ"
          title="Questions"
          titleEm="fréquentes"
        >
          <div className="mx-auto max-w-3xl">
            <FaqAccordion
              items={allFaqs.map((q, i) => ({
                id: `faq-${i + 1}`,
                question: q.question,
                answer: q.reponse,
              }))}
            />
          </div>
        </Section>
      ) : null}

      {/* ── QUALIOPI / OPCO (logo officiel + financement, gaté Phase B) ──── */}
      {ofPublic ? (
        <Section
          tone="sand"
          eyebrow="Sérieux & financement"
          title="Axion-IA.com"
          titleEm="certifié Qualiopi"
          description="Un gage de qualité — et l'assurance d'une formation finançable."
        >
          <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <Image
              src="/qualiopi/axion-ia-qualiopi.png"
              alt="Logo Qualiopi — Axion-IA, organisme de formation certifié (catégorie : actions de formation)"
              width={520}
              height={347}
              quality={90}
              sizes="(max-width: 1024px) 88vw, 40vw"
              className="mx-auto h-auto w-full max-w-[440px] object-contain"
            />
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
        <Section tone="sand" eyebrow="Autres formations" title="Pour aller" titleEm="plus loin">
          <div className="xs:grid-cols-2 grid gap-5 lg:grid-cols-4">
            {siblings.map((s) => (
              <Link
                key={s.id}
                href={`/formations/${s.slugFr}` as never}
                className="border-border bg-bg shadow-card hover:border-terracotta group flex h-full flex-col rounded-2xl border p-6 transition hover:-translate-y-1"
              >
                <span className="text-terracotta-deep text-[11px] font-bold tracking-wide uppercase">
                  {s.axeLabelFr ?? (s.categorie ? getCategorieMeta(s.categorie).shortFr : "")}
                  {" · "}
                  {formatDureeFr(s)}
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
