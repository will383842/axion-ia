/**
 * InterventionsHero — Hero du hub /interventions et de chaque page ville.
 *
 * Sprint A Phase 2 (2026-05-25). Server Component pur. Réutilisé par :
 *   - `/[locale]/interventions/page.tsx` (hub canonique, sans villeContext)
 *   - `/[locale]/implantations/{region}/{ville}/interventions/page.tsx`
 *     (430 pages ville × verticale interventions, avec villeContext)
 *
 * Émet un JSON-LD Speakable ciblant le H1 + tagline + ancre #familles pour
 * AEO/voix (Google Assistant, Alexa, ChatGPT voice, Claude voice).
 */

import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { InterventionsHeroSchema } from "@/components/sections/InterventionsHeroSchema";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";
import type { VilleContext } from "@/components/services/types";

interface InterventionsHeroProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
}

const TIGHT_X = "lg:px-6 xl:px-10";

export function InterventionsHero({ isFr, villeContext }: InterventionsHeroProps) {
  const villeAttr = villeContext ? { "data-source-ville": villeContext.villeSlug } : {};

  // H1 ville-aware. Hub : « Formez votre entreprise à l'IA ». Ville :
  // « Formez {ville} à l'IA ».
  const h1Lead = villeContext
    ? isFr
      ? `Formez ${villeContext.name} à l'IA `
      : `Train ${villeContext.name} on AI `
    : isFr
      ? "Formez votre entreprise à l'IA "
      : "Train your company on AI ";

  const h1Em = isFr ? "de 4 h à 3 j+" : "from 4 h to 3 d+";
  const h1Tail = isFr ? " — concrètement, sur site." : " — concretely, on site.";

  const description = isFr
    ? "Et si vos équipes gagnaient plusieurs heures par semaine ? Si les tâches répétitives passaient en automatique ? Si votre dirigeant décidait en connaissance de cause, plan d'action chiffré en main ? Nos interventions sur site livrent du concret — automatisations testées, méthodes installées, impact mesurable dès le lendemain."
    : "What if your teams reclaimed hours each week? If repetitive tasks ran on autopilot? If your executive made decisions backed by a quantified action plan? Our on-site sessions deliver concrete results — tested automations, installed methods, measurable impact from day one.";

  const heroNodes: ReadonlyArray<{
    label: string;
    benefit: string;
    accent: "terracotta" | "primary" | "sage" | "mocha";
  }> = [
    {
      label: isFr ? "Formations équipe" : "Team trainings",
      benefit: isFr ? "De 4 h à 3 j+ · 2 à 30+ personnes" : "From 4 h to 3 d+ · 2 to 30+ people",
      accent: "terracotta",
    },
    {
      label: isFr ? "Coaching individuel" : "Individual coaching",
      benefit: isFr ? "1-to-1 sur mesure" : "Bespoke 1-on-1",
      accent: "primary",
    },
    {
      label: isFr ? "Dirigeants" : "Executives",
      benefit: isFr ? "Journée 1-to-1 · gains chiffrés" : "1-on-1 day · quantified gains",
      accent: "mocha",
    },
    {
      label: isFr ? "Conférence" : "Talk",
      benefit: isFr ? "Plénière 1 journée · 30+" : "1-day plenary · 30+",
      accent: "sage",
    },
  ];

  // Speakable JSON-LD scoping H1 + lead paragraph + familles anchor.
  const speakableJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPageElement",
    speakable: buildSpeakableSpecification({
      selectors: ["h1", "[data-speakable='hero-lead']"],
    }),
  } as const;

  return (
    <>
      <section className="bg-halo-warm text-fg relative overflow-hidden py-20 sm:py-24 lg:py-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--color-border-strong) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border-strong) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage: "radial-gradient(ellipse at center, white 20%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, white 20%, transparent 75%)",
            opacity: 0.18,
          }}
        />
        <Container className={cn("relative", TIGHT_X)}>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            <div className="max-w-xl">
              <h1 className="display-editorial text-fg mt-5">
                {h1Lead}
                <span
                  className="text-terracotta mx-2 italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {h1Em}
                </span>
                {h1Tail}
              </h1>

              <p
                data-speakable="hero-lead"
                className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl"
              >
                {description}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta
                  href="/reserver"
                  size="lg"
                  className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-[0_8px_24px_-8px_rgba(205,107,72,0.6)]"
                  {...villeAttr}
                >
                  {isFr ? "Pré-réservez sur le calendrier" : "Pre-book on the calendar"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Cta>
                <Link
                  href={"#familles" as never}
                  {...villeAttr}
                  className="text-terracotta-deep hover:text-terracotta inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
                >
                  {isFr ? "Découvrez les interventions" : "Discover the sessions"}
                  <ArrowRight aria-hidden="true" className="h-4 w-4 rotate-90" />
                </Link>
              </div>
            </div>

            <InterventionsHeroSchema
              className="hero-schema pointer-events-none"
              centerLabel={
                villeContext
                  ? villeContext.name
                  : isFr
                    ? "Votre entreprise"
                    : "Your company"
              }
              ariaLabel={
                isFr
                  ? "Schéma : votre entreprise au centre, entourée des 4 familles d'interventions Axion-IA — formations équipe, coaching individuel, dirigeants, conférence."
                  : "Diagram: your company at the centre, surrounded by the 4 Axion-IA session families — team trainings, individual coaching, executives, talk."
              }
              nodes={heroNodes}
            />
          </div>
        </Container>
      </section>

      <JsonLd data={speakableJsonLd} />
    </>
  );
}
