// Composants conversion 2026 dédiés à la page /audit. Server-only sauf
// indication contraire. Regroupés ici pour éviter la dispersion :
//
//   - TrustBadges       : 4 réassurances institutionnelles sous le hero
//   - WhyAxionIA        : 5 différenciants vs cabinets concurrents
//   - SignatureCard     : carte fondateur (Will) — légitimité humaine
//   - AuditFaqSection   : FAQ accordion utilisant content/audit.ts.faqs
//   - BeyondAuditBlock  : bandeau d'upsell vers Module 3 Implémentation
//
// `SocialProof` (témoignages et métriques inventés) SUPPRIMÉ le 2026-10-09
// (DGCCRF) — il n'était plus monté nulle part.
//
// Doctrine v3 respectée (terracotta + serif italique + halo-warm/sand/mocha).

import type { ReactNode } from "react";
import {
  ShieldCheck,
  MapPin,
  ScrollText,
  Cpu,
  Award,
  Wallet,
  Layers,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { Cta } from "@/components/marketing/Cta";
import { cn } from "@/lib/utils";

// =============================================================================
// 1) TrustBadges — 4 pills de réassurance institutionnelle (sous le hero)
// =============================================================================
export function TrustBadges({ isFr }: { isFr: boolean }): ReactNode {
  const badges: ReadonlyArray<{ icon: LucideIcon; label: string; detail: string }> = isFr
    ? [
        {
          icon: MapPin,
          label: "Cabinet européen",
          detail: "Axion-IA · facturation HT",
        },
        {
          icon: ShieldCheck,
          label: "RGPD-first",
          detail: "Données hébergées en UE · pas d'exfiltration",
        },
        {
          icon: ScrollText,
          label: "Compatible AI Act",
          detail: "Audit aligné sur la réglementation 2026",
        },
        {
          icon: Cpu,
          label: "Cabinet IA pure-play",
          detail: "100 % audit & implémentation IA — pas généraliste",
        },
      ]
    : [
        {
          icon: MapPin,
          label: "European consultancy",
          detail: "Axion-IA · excl. VAT invoicing",
        },
        {
          icon: ShieldCheck,
          label: "GDPR-first",
          detail: "EU-hosted data · no exfiltration",
        },
        {
          icon: ScrollText,
          label: "AI Act ready",
          detail: "Audit aligned with 2026 EU regulation",
        },
        {
          icon: Cpu,
          label: "Pure-play AI consultancy",
          detail: "100 % AI audit & implementation — not generalist",
        },
      ];

  return (
    <section className="bg-bg border-border border-b py-6">
      <Container>
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12">
          {badges.map((b) => {
            const Icon = b.icon;
            return (
              <li key={b.label} className="flex items-center gap-2.5">
                <Icon
                  aria-hidden="true"
                  className="text-terracotta-deep h-4 w-4"
                  strokeWidth={2.25}
                />
                <span className="text-fg text-[12.5px] font-bold tracking-wide">{b.label}</span>
                <span className="text-fg-muted hidden text-[11.5px] sm:inline">· {b.detail}</span>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}

// =============================================================================
// 2) WhyAxionIA — 5 différenciants vs concurrence
// =============================================================================
export function WhyAxionIA({ isFr }: { isFr: boolean }): ReactNode {
  const points: ReadonlyArray<{ icon: LucideIcon; title: string; body: string }> = isFr
    ? [
        {
          icon: Cpu,
          title: "Cabinet IA pure-play",
          body: "On ne fait QUE de l'IA. Pas de généralistes, pas de juniors qui découvrent le sujet.",
        },
        {
          icon: Wallet,
          title: "Pas de black box",
          body: "Prix d'entrée affiché, devis clair pour le reste. Pas de 30 k€ qui tombent après 3 réunions." /* price-exempt: devis opaque concurrent (repoussoir), pas un tarif Axion-IA */,
        },
        {
          icon: Layers,
          title: "Du diagnostic à l'implémentation",
          body: "On ne livre pas un PDF qui dort dans un tiroir : on exécute le plan, même équipe.",
        },
        {
          icon: ScrollText,
          title: "Méthode lisible, pas de jargon",
          body: "On observe, on cartographie, on priorise. 4 étapes claires en 5 minutes.",
        },
        {
          icon: Award,
          title: "Spécialisé AI Act 2026",
          body: "L'AI Act intégré dès le diagnostic : gouvernance, traçabilité. Anticipez.",
        },
      ]
    : [
        {
          icon: Cpu,
          title: "Pure-play AI consultancy",
          body: "We do ONLY AI audit and implementation. No generalists doing everything, no juniors learning the topic on your dime.",
        },
        {
          icon: Wallet,
          title: "Public pricing, no black box",
          body: "Our pyramid is published. No opaque quote landing at €30k after 3 framing meetings. You know where you're going before signing." /* price-exempt: competitor opaque quote (foil), not an Axion-IA price */,
        },
        {
          icon: Layers,
          title: "From diagnosis to implementation",
          body: "We don't ship a PDF that ends in a drawer: we execute the plan ourselves (Module 3 Implementation) with the same team.",
        },
        {
          icon: ScrollText,
          title: "Clear method, no jargon",
          body: "We observe, we map, we prioritise, we hand over the plan. 4 simple steps your leadership grasps in 5 minutes.",
        },
        {
          icon: Award,
          title: "AI Act 2026 specialist",
          body: "Our method bakes in AI Act requirements from day one — governance, traceability, use case classification. Anticipate, don't react.",
        },
      ];

  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "Pourquoi Axion-IA" : "Why Axion-IA"}
      title={isFr ? "5 raisons concrètes" : "5 concrete reasons"}
      titleEm={isFr ? "de nous choisir" : "to choose us"}
      description={
        isFr
          ? "Big 4 (cher, lent), freelance (incertain), agence (généraliste) — ou nous. Voici la différence."
          : "Big 4 (expensive, slow), freelance (uncertain), agency (generalist) — or us. Here's the difference."
      }
      contentClassName="lg:px-6 xl:px-10"
    >
      <ul className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        {points.map((p, i) => {
          const Icon = p.icon;
          return (
            <li
              key={p.title}
              className={cn(
                "border-border bg-paper shadow-subtle relative rounded-2xl border-2 p-6",
                // Le 5e (AI Act) traverse les 2 colonnes en bas pour un effet "highlight".
                i === 4 && "lg:col-span-2",
              )}
            >
              <div className="flex items-start gap-4">
                <span className="bg-terracotta-soft text-terracotta-deep flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
                  <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-fg text-lg leading-snug font-bold">{p.title}</h3>
                  <p className="text-fg-soft mt-2 text-[14.5px] leading-relaxed">{p.body}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

// =============================================================================
// 4) SignatureCard — carte fondateur Will (légitimité humaine)
// =============================================================================
export function SignatureCard({ isFr }: { isFr: boolean }): ReactNode {
  return (
    <section className="bg-bg py-12 sm:py-14">
      <Container>
        <article className="border-terracotta/15 bg-halo-warm relative mx-auto max-w-3xl rounded-3xl border-2 p-7 sm:p-9">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
            {/* Avatar placeholder — initiale W terracotta dans cercle paper */}
            <div className="relative shrink-0">
              <div
                aria-hidden="true"
                className="bg-terracotta/15 absolute -inset-2 rounded-full blur-xl"
              />
              <div className="border-terracotta bg-paper shadow-card relative flex h-24 w-24 items-center justify-center rounded-full border-[3px] sm:h-28 sm:w-28">
                <span
                  className="text-terracotta text-5xl leading-none font-medium italic sm:text-6xl"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  W
                </span>
              </div>
            </div>

            {/* Quote + signature */}
            <div className="min-w-0 flex-1">
              <p className="text-fg-muted text-[11px] font-bold tracking-[0.18em] uppercase">
                {isFr ? "Mot du fondateur" : "Founder's note"}
              </p>
              <blockquote
                className="text-fg mt-3 text-[19px] leading-snug font-medium italic sm:text-xl"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {
                  isFr
                    ? "« J'ai créé Axion-IA parce que les entreprises méritent mieux qu'un PowerPoint à 30 k€ et 6 mois de réunions. On va sur le terrain, on identifie ce qui marche, on chiffre, on remet un plan exécutable. »" /* price-exempt: citation fondateur, PowerPoint concurrent 30 k€ */
                    : "“I built Axion-IA because companies deserve more than a €30k slide deck and 6 months of meetings. We go on site, identify what works, cost it, hand over an actionable plan.”" /* price-exempt: founder quote, competitor slide deck €30k */
                }
              </blockquote>
              <p className="text-fg-soft mt-4 text-sm">
                <span className="text-fg font-bold">Will</span>
                <span className="mx-2">·</span>
                <span>{isFr ? "Fondateur Axion-IA" : "Axion-IA founder"}</span>
              </p>
            </div>
          </div>
        </article>
      </Container>
    </section>
  );
}

// =============================================================================
// 5) AuditFaqSection — FAQ accordion utilisant content/audit.ts.faqs
// =============================================================================

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export function AuditFaqSection({
  isFr,
  items,
}: {
  isFr: boolean;
  items: ReadonlyArray<FaqItem>;
}): ReactNode {
  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "Questions fréquentes" : "Frequently asked"}
      title={isFr ? "On vous répond" : "We answer"}
      titleEm={isFr ? "sans détour" : "without spin"}
      description={
        isFr
          ? "Les 6 questions que tout dirigeant pose avant de réserver. Si la vôtre n'y est pas, écrivez-nous — on répond sous 48 h ouvrées."
          : "The 6 questions every leader asks before booking. Not yours? Write us — we reply within 48 business hours."
      }
      contentClassName="lg:px-6 xl:px-10 max-w-4xl"
    >
      <FaqAccordion items={items} />
    </Section>
  );
}

// =============================================================================
// 6) BeyondAuditBlock — bandeau d'upsell vers Module 3 Implémentation
// =============================================================================
export function BeyondAuditBlock({ isFr }: { isFr: boolean }): ReactNode {
  return (
    <section className="bg-halo-cool border-border border-y py-14 sm:py-16">
      <Container>
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-12">
          <div>
            <p className="text-primary text-[12px] font-bold tracking-[0.18em] uppercase">
              <span
                aria-hidden="true"
                className="bg-primary mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {isFr ? "Au-delà de l'audit" : "Beyond the audit"}
            </p>
            <h2
              className="text-fg mt-4 text-[clamp(1.6rem,3vw,2.5rem)] leading-tight font-medium tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "Et après l'audit," : "And after the audit,"}{" "}
              <span className="text-primary italic">
                {isFr ? "on exécute avec vous" : "we execute it with you"}
              </span>
            </h2>
            <p className="text-fg-soft mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">
              {isFr
                ? "Un rapport ne vaut rien dans un tiroir. La même équipe exécute : chatbots, automatisations, agents IA, intégrations CRM/ERP."
                : "A report is worth nothing in a drawer. The same team executes: chatbots, automations, AI agents, CRM/ERP integrations."}
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <Cta
              href="/implementation"
              size="lg"
              className="bg-primary text-primary-fg hover:bg-primary-hover"
            >
              {isFr ? "Voir le Module 3 Implémentation" : "See Module 3 Implementation"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <p className="text-fg-muted text-[12px]">
              {isFr
                ? "Continuité d'équipe garantie · pas de passage de relais."
                : "Continuous team · no handover."}
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
