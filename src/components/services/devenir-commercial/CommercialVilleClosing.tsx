// Server Component — ⭐ clôture ville (VARIABLE). Réponse directe AEO/GEO
// « devenir commercial IA à [ville] » + maillage communes voisines (chips) + CTA.
// Refonte 2026-06-08 (Will) : moins verbeux, « promouvoir » plutôt que « vendre »,
// communes en chips, mention axion-ia.com (désambiguïsation de marque).

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";

export interface CommercialVilleClosingProps {
  readonly isFr: boolean;
  readonly villeName: string;
  readonly departementLabel?: string | undefined;
  readonly region?: string | undefined;
  readonly communesBassin: ReadonlyArray<string>;
}

export function CommercialVilleClosing({
  isFr,
  villeName,
  departementLabel,
  region,
  communesBassin,
}: CommercialVilleClosingProps): ReactNode {
  const zone = [departementLabel, region].filter(Boolean).join(", ");
  const directAnswer = isFr
    ? `Axion-IA (axion-ia.com) recrute des commerciaux indépendants à ${villeName}${
        zone ? ` et alentours (${zone})` : ""
      } pour promouvoir ses formations, audits et intégrations IA auprès des entreprises locales. Statut indépendant, commissions déplafonnées, démarrage gratuit.`
    : `Axion-IA (axion-ia.com) is hiring independent sales reps in ${villeName}${
        zone ? ` and nearby (${zone})` : ""
      } to promote its AI trainings, audits and integrations to local companies. Self-employed, uncapped commissions, free to start.`;

  return (
    <section className="bg-mocha-rich text-mocha-fg py-16 sm:py-20">
      <Container>
        <p className="text-terracotta-soft text-[12px] font-semibold tracking-[0.16em] uppercase">
          {isFr ? `Devenir commercial IA à ${villeName}` : `Become an AI sales rep in ${villeName}`}
        </p>
        <p
          data-speakable
          className="mt-4 max-w-3xl text-[clamp(1.3rem,2.4vw,1.9rem)] leading-snug font-semibold"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {directAnswer}
        </p>

        {communesBassin.length > 0 ? (
          <div className="mt-7">
            <p className="text-mocha-fg/60 text-[11px] font-semibold tracking-[0.14em] uppercase">
              {isFr ? "Aussi dans votre zone" : "Also in your zone"}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {communesBassin.slice(0, 8).map((c) => (
                <li
                  key={c}
                  className="border-mocha-fg/20 text-mocha-fg/85 rounded-full border px-3 py-1 text-sm"
                >
                  {c}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-8">
          <Cta
            href="/devenir-commercial-ia/candidature"
            size="lg"
            className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-subtle"
            track="commercial-ville-closing-apply"
          >
            {isFr ? "Postuler maintenant" : "Apply now"}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Cta>
        </div>
      </Container>
    </section>
  );
}
