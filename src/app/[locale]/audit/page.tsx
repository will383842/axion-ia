import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Calendar, Mail, ShieldCheck, Clock, FileText, Users } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { AuditHubToggle } from "@/components/sections/AuditHubToggle";
import {
  TrustBadges,
  WhyAxionIA,
  SocialProof,
  SignatureCard,
  AuditFaqSection,
  BeyondAuditBlock,
} from "@/components/sections/AuditConversionBlocks";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { LocalGeoFaqSection } from "@/components/sections/LocalGeoFaqSection";
import { ProcessSteps } from "@/components/sections/ProcessSteps";
import { AUDIT_TIERS, formatAmount, formatAmountRange, getTierById } from "@/content/pricing";
import { AUDIT_BY_SIZE, AUDIT_TIERS_META, auditTierPath } from "@/content/audit-taxonomy";
import { buildProductMetadata, buildServiceJsonLd, buildItemListJsonLd, SITE_URL } from "@/lib/seo";
import { Illustration } from "@/components/visual/Illustration";

// ============================================================================
// Sprint 14.10.8 (Will 2026-05-12) — refonte hub /audit en 2 axes toggle.
//
// Pattern miroir de /interventions :
//   - Hero court
//   - Switch « Par taille » / « Par situation » (composant AuditHubToggle)
//   - Sections de réassurance (TrustBadges, WhyAxionIA, SignatureCard, SocialProof)
//   - FAQ
//   - Section anti-fear « quel que soit votre niveau IA »
//   - BeyondAuditBlock (upsell module Implémentation)
//   - LocalCoverage + LocalGeoFaq (pSEO villes/régions)
//   - CtaBlock + StickyMobileCta
//   - JSON-LD : Service + ItemList (4 tiers)
// ============================================================================

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

const TIGHT_X = "lg:px-6 xl:px-10";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const loc: "fr" | "en" = locale === "fr" ? "fr" : "en";
  const flashTier = getTierById(AUDIT_TIERS, "audit-flash");
  const cibleTier = getTierById(AUDIT_TIERS, "audit-cible");
  const pmeTier = getTierById(AUDIT_TIERS, "audit-strategique-pme");
  const etiTier = getTierById(AUDIT_TIERS, "audit-strategique-eti");
  const flash = formatAmount(flashTier.priceFlat!, loc, { compact: true });
  const cibleRange = formatAmountRange(cibleTier.priceMin!, cibleTier.priceMax!, loc, {
    compact: true,
  });
  const pmeRange = formatAmountRange(pmeTier.priceMin!, pmeTier.priceMax!, loc, { compact: true });
  const etiFrom = formatAmount(etiTier.priceMin!, loc, { compact: true });
  return buildProductMetadata({
    locale,
    path: "/audit",
    title:
      loc === "fr"
        ? `Audit IA PME & ETI · 4 niveaux · Flash dès ${flash} · Axion-IA`
        : `AI audit for SMEs & mid-caps · 4 levels · from ${flash} · Axion-IA`,
    description:
      loc === "fr"
        ? `4 niveaux d'audit IA : Flash ${flash}, Audit ciblé ${cibleRange}, Stratégique PME ${pmeRange}, Stratégique ETI à partir de ${etiFrom}. Choisissez selon votre taille ou votre situation.`
        : `4-level AI audit: Flash ${flash}, Targeted ${cibleRange}, Strategic SMB ${pmeRange}, Strategic mid-cap from ${etiFrom}. Choose by size or by situation.`,
  });
}

export default async function AuditHub({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  // JSON-LD Service global pour le hub /audit (factory centralisée).
  // Sprint 14.10.8 : retrait `priceEur: 0` qui pouvait être interprété par
  // Google comme « service gratuit » → mauvais signal rich results. Le prix
  // d'entrée 490 € est exposé sur les pages détail tier (où il est
  // contextualisé).
  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: "/audit",
    name: isFr ? "Audit IA en entreprise · Axion-IA" : "Enterprise AI audit · Axion-IA",
    description: isFr
      ? "4 niveaux d'audit IA selon la taille de l'entreprise et la situation. France & international."
      : "4 AI audit levels by company size and situation. France & international.",
    serviceType: "AI audit",
  });

  // ItemList JSON-LD — 4 tiers d'audit. AEO 2026 : LLMs énumèrent les niveaux
  // d'audit quand quelqu'un demande « quels audits IA propose Axion-IA ? ».
  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: "/audit",
    name: isFr ? "Niveaux d'audit IA Axion-IA" : "Axion-IA AI audit levels",
    items: AUDIT_TIERS_META.map((tier, idx) => ({
      position: idx + 1,
      name: isFr ? tier.labelFr : tier.labelEn,
      url: `${SITE_URL}/${loc}${auditTierPath(tier, loc)}`,
      description: isFr ? tier.taglineFr : tier.taglineEn,
    })),
  });

  // 4 trust pills hero
  const heroPills = isFr
    ? [
        { icon: Clock, label: "Réponse 48 h ouvrées" },
        { icon: ShieldCheck, label: "Confidentialité totale" },
        { icon: FileText, label: "Livrables actionnables" },
        { icon: Users, label: "TPE → grandes entreprises" },
      ]
    : [
        { icon: Clock, label: "Reply within 48 business hours" },
        { icon: ShieldCheck, label: "Total confidentiality" },
        { icon: FileText, label: "Actionable deliverables" },
        { icon: Users, label: "Small businesses → enterprise" },
      ];

  const breadcrumbItems = [{ href: "/audit", label: isFr ? "Audit IA" : "AI audit" }];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO */}
      <section className="bg-halo-warm relative overflow-hidden py-14 sm:py-18 lg:py-22">
        <Container className={cn("relative", TIGHT_X)}>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {isFr
                ? "Audit IA PME & ETI · 4 niveaux · 2 portes d'entrée"
                : "AI audit for SMEs & mid-caps · 4 levels · 2 entry doors"}
            </p>

            <h1 className="display-editorial text-fg mt-5">
              {isFr ? "Audit IA pour PME & ETI " : "AI Audit for SMEs & mid-caps "}
              <span
                className="text-terracotta-deep mx-2 italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "dès 490 €" : "from €490"}
              </span>
            </h1>

            <p className="text-fg-soft mx-auto mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {isFr
                ? "4 niveaux d'audit IA pour entreprise — du diagnostic Flash 490 € à l'audit Stratégique ETI 12 000 €+. Choisissez l'angle qui vous parle : la taille de votre entreprise OU votre situation."
                : "4 AI audit levels for companies — from €490 Flash diagnosis to €12,000+ Strategic mid-cap audit. Choose the angle that speaks to you: your company size OR your situation."}
            </p>

            {/* Trust pills */}
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {heroPills.map((p) => {
                const Icon = p.icon;
                return (
                  <li
                    key={p.label}
                    className="bg-paper border-border text-fg inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium"
                  >
                    <Icon aria-hidden="true" className="text-terracotta-deep h-3.5 w-3.5" />
                    {p.label}
                  </li>
                );
              })}
            </ul>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Cta
                href="/reserver?intervention=audit-flash-onsite"
                size="lg"
                className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
              >
                <Calendar aria-hidden="true" className="h-4 w-4" />
                {isFr ? `Réserver un Flash terrain · 890 €` : `Book on-site Flash · €890`}
              </Cta>
              <Cta href="/audit/demande" variant="outline" size="lg">
                <Mail aria-hidden="true" className="h-4 w-4" />
                {isFr ? "Demander un cadrage" : "Request framing"}
              </Cta>
            </div>

            {/* Hero illustration — Sprint visual 2026-05-22 */}
            <div className="mx-auto mt-10 max-w-3xl">
              <Illustration
                slot="AUDIT-HUB-01-hero"
                aspectRatio="16:9"
                priority
                filenameTarget="public/illustrations/audit-hub-hero.avif"
                alt={
                  isFr
                    ? "Illustration éditoriale — audit IA en entreprise, équipe Axion-IA"
                    : "Editorial illustration — AI audit for business, Axion-IA team"
                }
                caption={isFr ? "Audit IA · Axion-IA" : "AI Audit · Axion-IA"}
              />
            </div>
          </div>
        </Container>
      </section>

      {/* HUB TOGGLE — 2 axes Par taille / Par situation */}
      <Section
        eyebrow={isFr ? "2 portes d'entrée" : "2 entry doors"}
        title={isFr ? "Comment voulez-vous" : "How do you want"}
        titleEm={isFr ? "choisir ?" : "to choose?"}
        contentClassName={TIGHT_X}
      >
        <AuditHubToggle
          locale={loc}
          labels={{
            bySizeTab: isFr ? "Par taille d'entreprise" : "By company size",
            bySituationTab: isFr ? "Par situation" : "By situation",
            bySizeDescription: isFr
              ? `${AUDIT_BY_SIZE.length} segments selon votre effectif INSEE : TPE, PME, ETI, grande entreprise. Chaque segment pointe vers le niveau d'audit le mieux calibré.`
              : `${AUDIT_BY_SIZE.length} segments by your INSEE headcount: small business, SME, mid-cap, enterprise. Each segment points to the best-calibrated audit level.`,
            bySituationDescription: isFr
              ? "4 angles d'entrée selon votre contexte business : urgence, premier audit, approfondissement, gouvernance multi-BU."
              : "4 entry angles by business context: urgent, first audit, deepening, multi-BU governance.",
            learnMore: isFr ? "Voir le format" : "See format",
          }}
        />
      </Section>

      {/* TRUST BADGES — Sprint conversion 14.7+ */}
      <TrustBadges isFr={isFr} />

      {/* POURQUOI AXIONIA — différenciants vs concurrence */}
      <WhyAxionIA isFr={isFr} />

      {/* SIGNATURE FONDATEUR — légitimité humaine entre WhyAxionIA et SocialProof */}
      <SignatureCard isFr={isFr} />

      {/* PREUVE SOCIALE — métriques + bandeau secteurs + 3 témoignages */}
      <SocialProof isFr={isFr} />

      {/* FAQ — 6 questions clés + JSON-LD FAQPage (via FaqAccordion factory) */}
      <AuditFaqSection
        isFr={isFr}
        items={
          isFr
            ? [
                {
                  id: "duree-reservation",
                  question: "Combien de temps prend la réservation ?",
                  answer:
                    "L'audit Flash terrain (890 €) se réserve directement sur le calendrier en 2 minutes. Pour Flash distance et les niveaux Ciblé / Stratégique, vous recevez un devis personnalisé sous 48 h ouvrées avec un créneau d'appel de cadrage proposé.",
                },
                {
                  id: "remote-onsite",
                  question: "À distance ou sur site, quelle différence ?",
                  answer:
                    "À distance : visio sécurisée + entretiens + analyse des données partagées. Plus rapide à organiser, tarif réduit. Sur site : observation directe, immersion équipe, ateliers métier physiques. Recommandé dès le niveau Ciblé pour les ateliers métier.",
                },
                {
                  id: "data",
                  question: "Quelles données dois-je vous fournir ?",
                  answer:
                    "Aucune donnée sensible n'est exfiltrée hors UE. Tous les entretiens et analyses se font sur place ou en visio sécurisée. Pour calibrer le devis : taille de l'équipe, secteur, outils en place, périmètre cible. Aucun accès production demandé avant signature.",
                },
                {
                  id: "after",
                  question: "Que se passe-t-il après l'audit ?",
                  answer:
                    "Vous repartez avec un plan d'action chiffré, exécutable par vos équipes ou par Axion-IA (module Implémentation). Une session de suivi peut être programmée 30 à 60 jours après la livraison pour challenger la mise en œuvre — sans frais additionnels si elle tient en 60 minutes.",
                },
                {
                  id: "eu-jurisdiction",
                  question: "Axion-IA peut-elle facturer en France ?",
                  answer:
                    "Oui. Axion-IA est une société européenne dûment enregistrée, opérant en libre prestation de services dans toute l'UE (incluant France). Facturation HT, paiement par virement SEPA ou carte. Données hébergées exclusivement en UE (Hetzner Frankfurt). Conformité RGPD complète.",
                },
                {
                  id: "starting-point",
                  question: "Et si je ne sais pas par où commencer ?",
                  answer:
                    "Notre rapport est volontairement priorisé : le quick-win #1 doit être lançable dans la semaine qui suit la restitution. Si vous hésitez, nous proposons un appel de clarification gratuit de 30 minutes dans les 30 jours suivant la livraison. Et le module Implémentation peut prendre le relais sans transition.",
                },
              ]
            : [
                {
                  id: "duree-reservation",
                  question: "How long does booking take?",
                  answer:
                    "The on-site Flash audit (€890) is booked directly on the calendar in 2 minutes. For remote Flash and Targeted / Strategic levels, you receive a personalised quote within 48 business hours with a proposed framing call slot.",
                },
                {
                  id: "remote-onsite",
                  question: "Remote or on site — what's the difference?",
                  answer:
                    "Remote: secure video + interviews + analysis of shared data. Faster to organise, reduced fee. On site: direct observation, team immersion, physical business workshops. Recommended from Targeted level for business workshops.",
                },
                {
                  id: "data",
                  question: "What data do I need to provide?",
                  answer:
                    "No sensitive data is exfiltrated outside the EU. All interviews and analysis happen on-site or in secure video conferencing. To calibrate the quote: team size, sector, tools in place, target scope. No production access requested before signing.",
                },
                {
                  id: "after",
                  question: "What happens after the audit?",
                  answer:
                    "You leave with a costed action plan, executable by your teams or by Axion-IA (Implementation module). A follow-up session can be scheduled 30 to 60 days after delivery to challenge execution — at no additional cost if it fits in 60 minutes.",
                },
                {
                  id: "eu-jurisdiction",
                  question: "Can Axion-IA invoice in France?",
                  answer:
                    "Yes. Axion-IA is a duly registered European company, operating under EU free-services-provision (including France). Excl. VAT invoicing, SEPA transfer or card payment. Data hosted exclusively in the EU (Hetzner Frankfurt). Full GDPR compliance.",
                },
                {
                  id: "starting-point",
                  question: "What if I don't know where to start?",
                  answer:
                    "Our report is deliberately prioritised: quick-win #1 must be launchable within a week of the debrief. If you hesitate, we offer a free 30-minute clarification call within the 30 days following delivery. And the Implementation module can take over without transition.",
                },
              ]
        }
      />

      {/* SECTION ANTI-FEAR — quel que soit votre niveau IA */}
      <Section
        tone="sand"
        eyebrow={isFr ? "Concerné·e quel que soit votre niveau" : "A fit for every AI maturity"}
        title={isFr ? "De zéro IA à équipes IA-fluentes," : "From zero AI to fluent teams,"}
        titleEm={isFr ? "un audit pour chaque entreprise" : "an audit for every company"}
        description={
          isFr
            ? "Aucune entreprise n'est trop petite ni trop grande, aucun secteur n'est trop spécifique. Vous repartez avec une roadmap claire, chiffrée — peu importe d'où vous partez."
            : "No company is too small or too large, no sector is too niche. You leave with a clear, costed roadmap — whatever your starting point."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 sm:grid-cols-3">
          {(isFr
            ? [
                {
                  level: "Niveau 1",
                  title: "Aucun usage IA en place",
                  body: "Le diagnostic Flash identifie 3 à 5 endroits où l'IA peut s'insérer immédiatement, sans bouleverser votre quotidien. Vous gardez la main.",
                  recommendation: "Flash · Ciblé",
                },
                {
                  level: "Niveau 2",
                  title: "Premiers usages IA déjà testés",
                  body: "L'audit Ciblé sur un département structure ce qui marche, élimine ce qui n'en vaut pas la peine, et chiffre la suite avec un plan 6-12 mois.",
                  recommendation: "Ciblé · Stratégique PME",
                },
                {
                  level: "Niveau 3",
                  title: "Usages IA matures, recherche d'optimisation",
                  body: "L'audit Stratégique pose un benchmark concurrentiel et identifie les leviers de scalabilité multi-sites encore inexploités.",
                  recommendation: "Stratégique PME · ETI",
                },
              ]
            : [
                {
                  level: "Stage 1",
                  title: "No AI use in place",
                  body: "The Flash diagnosis identifies 3 to 5 places where AI can fit in immediately, without disrupting your day-to-day. You keep control.",
                  recommendation: "Flash · Targeted",
                },
                {
                  level: "Stage 2",
                  title: "Early AI uses already tried",
                  body: "The Targeted audit on a department structures what works, drops what doesn't, and costs the next step with a 6-12 month plan.",
                  recommendation: "Targeted · Strategic SMB",
                },
                {
                  level: "Stage 3",
                  title: "Mature AI uses, looking to optimize",
                  body: "The Strategic audit benchmarks competitors and identifies unexploited multi-site scaling levers.",
                  recommendation: "Strategic SMB · mid-cap",
                },
              ]
          ).map((card, idx) => (
            <article key={idx} className="bg-paper border-border relative rounded-2xl border p-6">
              <p className="text-terracotta-deep text-[12px] font-semibold tracking-[0.16em] uppercase">
                {card.level}
              </p>
              <h3 className="text-fg mt-2 text-xl leading-snug font-semibold">{card.title}</h3>
              <p className="text-fg-soft mt-3 text-base leading-relaxed">{card.body}</p>
              <p className="text-fg-muted mt-4 text-[12px] tracking-wide">
                <span className="text-fg font-medium">
                  {isFr ? "Niveau conseillé : " : "Recommended level: "}
                </span>
                {card.recommendation}
              </p>
            </article>
          ))}
        </div>
      </Section>

      {/* AU-DELÀ DE L'AUDIT — upsell module Implémentation */}
      <BeyondAuditBlock isFr={isFr} />

      {/* CROSS-MODULES — Sprint 14.10.8 (Will 2026-05-12) : harmonisation
          tunnels. Si l'audit n'est pas le bon format, proposer Interventions
          (formation équipe) ou Implémentation (mise en œuvre). */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Pas le bon format ?" : "Not the right format?"}
        title={isFr ? "Vous préférez" : "Would you rather"}
        titleEm={isFr ? "former ou implémenter ?" : "train or implement?"}
        description={
          isFr
            ? "L'audit est l'angle « comprendre et chiffrer ». Si vous savez déjà ce que vous voulez et cherchez à former vos équipes ou à passer à l'action, ces 2 modules sont vos prochaines étapes."
            : "Audit is the « understand and quantify » angle. If you already know what you want and seek to train teams or move to action, these 2 modules are your next steps."
        }
        contentClassName={TIGHT_X}
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:gap-7">
          <Cta
            href="/interventions"
            variant="outline"
            size="lg"
            className="hover:bg-terracotta-soft justify-start py-6 text-left"
          >
            <Users aria-hidden="true" className="text-terracotta-deep h-5 w-5" />
            <span className="flex flex-col items-start gap-0.5">
              <span className="text-fg text-base font-semibold">
                {isFr ? "Former vos équipes →" : "Train your teams →"}
              </span>
              <span className="text-fg-soft text-[13px] leading-snug">
                {isFr
                  ? "14 formats interventions IA · Collectives, individuelles, dirigeants, conférences"
                  : "14 AI session formats · Team, individual, executive, talks"}
              </span>
            </span>
          </Cta>
          <Cta
            href="/implementation"
            variant="outline"
            size="lg"
            className="hover:bg-terracotta-soft justify-start py-6 text-left"
          >
            <FileText aria-hidden="true" className="text-terracotta-deep h-5 w-5" />
            <span className="flex flex-col items-start gap-0.5">
              <span className="text-fg text-base font-semibold">
                {isFr ? "Implémenter l'IA →" : "Implement AI →"}
              </span>
              <span className="text-fg-soft text-[13px] leading-snug">
                {isFr
                  ? "Mise en production IA · agents, automatisations, IA custom, intégrations"
                  : "Production AI · agents, automations, custom AI, integrations"}
              </span>
            </span>
          </Cta>
        </div>
      </Section>

      {/* MÉTHODOLOGIE — 4 étapes (Sprint uniformisation 2026-05-24) */}
      <Section
        eyebrow={isFr ? "Méthodologie" : "Methodology"}
        title={isFr ? "Notre démarche" : "Our approach"}
        titleEm={isFr ? "en 4 étapes" : "in 4 steps"}
      >
        <Container>
          <ProcessSteps
            orientation="horizontal"
            steps={[
              {
                id: "step-1-cadrage",
                title: isFr ? "Cadrage 30 min" : "30-min scoping",
                description: isFr
                  ? "Appel découverte gratuit. On définit le périmètre (toute l'entreprise ou un service), la taille du diagnostic et la date d'intervention."
                  : "Free discovery call. We define the scope (entire company or one department), diagnostic size, and intervention date.",
              },
              {
                id: "step-2-investigation",
                title: isFr ? "Investigation terrain" : "Field investigation",
                description: isFr
                  ? "1 à 5 jours sur site selon le niveau (Flash, Ciblé, Stratégique). Entretiens collaborateurs, observation des processus réels, analyse des outils existants."
                  : "1 to 5 days on-site depending on level (Flash, Targeted, Strategic). Employee interviews, observation of real processes, analysis of existing tools.",
              },
              {
                id: "step-3-restitution",
                title: isFr ? "Restitution chiffrée" : "Costed delivery",
                description: isFr
                  ? "Livrable PDF priorisé sous 48 h à 5 jours : chaque opportunité IA chiffrée individuellement (coût mise en place vs gain annuel attendu sur 12 mois)."
                  : "Prioritised PDF delivery within 48 h to 5 days: each AI opportunity costed individually (deployment cost vs expected 12-month annual gain).",
              },
              {
                id: "step-4-action",
                title: isFr ? "Plan d'action" : "Action plan",
                description: isFr
                  ? "Roadmap séquencée des quick-wins (≤ 30 j) aux chantiers structurels (3-12 mois). Vous décidez si vous implémentez en interne, avec nous, ou pas du tout."
                  : "Sequenced roadmap from quick-wins (≤ 30 days) to structural projects (3-12 months). You decide whether you implement in-house, with us, or not at all.",
              },
            ]}
          />
        </Container>
      </Section>

      {/* COUVERTURE NATIONALE (pSEO villes/régions) */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="L'audit IA"
        serviceLabelEn="AI audit"
        serviceSlug="audit"
        tone="paper"
      />

      {/* FAQ GÉOLOCALISÉE (pSEO villes/régions) */}
      <LocalGeoFaqSection isFr={isFr} service="audit" tone="sand" />

      {/* CTA FINAL */}
      <CtaBlock
        eyebrow={isFr ? "Démarrer concrètement" : "Start concretely"}
        title={isFr ? "Réservez votre Flash terrain" : "Book your on-site Flash"}
        titleEm={isFr ? `à 890 €` : `at €890`}
        description={
          isFr
            ? "1 journée complète dans vos locaux, démos live, plan d'action sous 48 h. Réservation directe sur le calendrier maison. Sans engagement avant signature."
            : "Full day on your premises, live demos, action plan within 48 h. Direct booking on our calendar. No commitment before signing."
        }
        cta={
          <Cta
            href="/reserver?intervention=audit-flash-onsite"
            size="lg"
            className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-cta-terracotta"
          >
            <Calendar aria-hidden="true" className="h-4 w-4" />
            {isFr ? "Réserver sur le calendrier" : "Book on the calendar"}
          </Cta>
        }
        tone="dark"
      />

      {/* STICKY CTA MOBILE */}
      <StickyMobileCta
        href="/reserver?intervention=audit-flash-onsite"
        label={isFr ? `Flash terrain · 890 €` : `On-site Flash · €890`}
        track="audit-flash-onsite-sticky"
        threshold={500}
      />

      {/* V-04 P1 (Sprint Correctif suite 2026-05-22) — Service inline (SEO racine
          critique), ItemList déféré afterInteractive (-100 à -200 ms TBT). */}
      <JsonLd data={serviceJsonLd} />
      <JsonLd data={itemListJsonLd} strategy="afterInteractive" scriptId="jsonld-audit-itemlist" />
    </>
  );
}
