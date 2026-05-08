import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Hero } from "@/components/sections/Hero";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { ProcessSteps } from "@/components/sections/ProcessSteps";
import { MetricsRow } from "@/components/sections/MetricsRow";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { TimelineBlock } from "@/components/sections/TimelineBlock";
import { TeamGrid } from "@/components/sections/TeamGrid";
import { TrustBar } from "@/components/sections/TrustBar";
import { TestimonialsCarousel } from "@/components/sections/TestimonialsCarousel";
import { CaseStudiesShowcase } from "@/components/sections/CaseStudiesShowcase";
import { FaqBlock } from "@/components/sections/FaqBlock";
import { FadeInOnView } from "@/components/motion/FadeInOnView";
import { Button } from "@/components/ui/button";

// Dev-only sections gallery. /fr/sections + /en/sections (disallow robots).
export default function SectionsPage() {
  return (
    <>
      <Hero
        eyebrow="Editorial v3.1 — composite gallery"
        title="Sections live"
        description="All composite blocks rendered with realistic placeholders. Reference page for design parity audits."
        cta={
          <>
            <Button>Primary CTA</Button>
            <Button variant="outline">Secondary</Button>
          </>
        }
      />

      <Section eyebrow="FeatureGrid · 3 cols">
        <FeatureGrid
          items={[
            { id: "a", title: "Mobile-first", description: "Tested at 360 px first." },
            { id: "b", title: "WCAG 2.2 AA", description: "Touch targets 44 px, focus visible." },
            {
              id: "c",
              title: "Editorial v3.1",
              description: "Manrope + Fraunces + 5-layer shadow stack.",
            },
          ]}
        />
      </Section>

      <Section eyebrow="ProcessSteps · horizontal">
        <ProcessSteps
          steps={[
            { id: "d", title: "Découverte", description: "1 j sur site." },
            { id: "i", title: "Implémentation", description: "Sprint guidé." },
            { id: "h", title: "Hand-off", description: "Doc + 30 j de support." },
          ]}
        />
      </Section>

      <Section eyebrow="MetricsRow · 4 stats">
        <MetricsRow
          stats={[
            { id: "roi", number: "+38", suffix: "%", label: "ROI moyen", variant: "primary" },
            { id: "h", number: "2.4", suffix: "h/jour", label: "Temps gagné", variant: "green" },
            { id: "cs", number: "11", suffix: "cas", label: "Études concrètes", variant: "purple" },
            { id: "sla", number: "48", suffix: "h", label: "Réponse audit", variant: "orange" },
          ]}
        />
      </Section>

      <Section eyebrow="TrustBar · monochrome wordmarks">
        <TrustBar
          label="Ils nous ont fait confiance"
          logos={[
            {
              id: "a",
              name: "Aerospace Co",
              logo: <span className="font-mono text-sm tracking-tight">AEROSPACE</span>,
            },
            {
              id: "b",
              name: "Banque B",
              logo: <span className="font-mono text-sm tracking-tight">BANK · B</span>,
            },
            {
              id: "c",
              name: "Cabinet C",
              logo: <span className="font-mono text-sm tracking-tight">CABINET · C</span>,
            },
            {
              id: "d",
              name: "Distrib D",
              logo: <span className="font-mono text-sm tracking-tight">DISTRIB · D</span>,
            },
          ]}
        />
      </Section>

      <Section eyebrow="CaseStudiesShowcase">
        <CaseStudiesShowcase
          items={[
            {
              id: "1",
              href: "/cas-concrets/exemple-1",
              title: "Industrie · -32% admin",
              excerpt: "Implémentation IA sur les flux comptables.",
              industry: "Industrie",
              metric: "-32%",
            },
            {
              id: "2",
              href: "/cas-concrets/exemple-2",
              title: "Cabinet · +18% productivité",
              excerpt: "Automatisation des comptes-rendus juridiques.",
              industry: "Juridique",
              metric: "+18%",
            },
            {
              id: "3",
              href: "/cas-concrets/exemple-3",
              title: "Retail · -45% temps SAV",
              excerpt: "Triage IA des tickets clients sur 6 semaines.",
              industry: "Retail",
              metric: "-45%",
            },
          ]}
        />
      </Section>

      <Section eyebrow="TestimonialsCarousel · CSS scroll-snap">
        <TestimonialsCarousel
          items={[
            {
              id: "1",
              quote: "Une intervention dense, des résultats opérationnels dès le lendemain.",
              author: "C. Lambert",
              role: "DAF",
              company: "PME industrielle",
            },
            {
              id: "2",
              quote: "Méthodologie carrée, livrables actionnables. On a déployé en 4 semaines.",
              author: "M. Petit",
              role: "COO",
              company: "Cabinet juridique",
            },
            {
              id: "3",
              quote: "L'audit a mis à jour 12 quick-wins que nos équipes n'avaient pas vus.",
              author: "S. Roussel",
              role: "DG",
              company: "Retail",
            },
            {
              id: "4",
              quote: "Démarche pragmatique, ROI mesurable, support post-livraison rare.",
              author: "L. Vidal",
              role: "Directeur transformation",
              company: "Banque B",
            },
          ]}
        />
      </Section>

      <Section eyebrow="TimelineBlock">
        <Container className="max-w-3xl">
          <TimelineBlock
            events={[
              {
                id: "2024",
                date: "2024",
                title: "Création Axion-IA OÜ",
                description: "Lancement du cabinet IA opérationnel.",
              },
              {
                id: "2025",
                date: "2025",
                title: "Premiers cabinets pilotes",
                description: "10 missions terrain, méthodologie itérée.",
              },
              {
                id: "2026",
                date: "2026",
                title: "Plateforme axion-ia.com",
                description: "Refonte complète, mobile-first, multilingue.",
              },
            ]}
          />
        </Container>
      </Section>

      <Section eyebrow="TeamGrid">
        <TeamGrid
          members={[
            { id: "w", name: "Will", role: "Fondateur · Lead consultant" },
            { id: "a", name: "Associé A", role: "Senior consultant" },
            { id: "b", name: "Associé B", role: "AI engineer" },
          ]}
        />
      </Section>

      <FadeInOnView>
        <FaqBlock
          title="Questions fréquentes"
          items={[
            {
              id: "1",
              question: "Quelle est la durée d'une intervention Essentielle ?",
              answer: "Une journée sur site avec livraison d'un plan d'action.",
            },
            {
              id: "2",
              question: "Que reste-t-il après ?",
              answer: "Un plan chiffré + 30 jours de support pour itérer.",
            },
          ]}
        />
      </FadeInOnView>

      <CtaBlock
        eyebrow="Réservez"
        title="Prête à voir ce que l'IA peut faire pour votre entreprise ?"
        description="Une journée d'intervention, des résultats opérationnels mesurables."
        cta={<Button size="lg">Réserver une intervention →</Button>}
        tone="dark"
      />
    </>
  );
}
