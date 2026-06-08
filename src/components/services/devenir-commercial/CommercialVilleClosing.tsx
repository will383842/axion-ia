// Server Component — ⭐ section ville de clôture (VARIABLE). Réponse directe
// AEO/GEO « devenir commercial IA à [ville] » + périmètre département/région +
// maillage des communes du bassin. Pensée pour la citabilité (paragraphe direct,
// data-speakable). Contenu généré depuis la donnée réelle, donc unique par ville.

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";

export interface CommercialVilleClosingProps {
  readonly isFr: boolean;
  readonly villeName: string;
  readonly departementLabel?: string | undefined;
  readonly region?: string | undefined;
  /** Noms des communes voisines (maillage / périmètre). */
  readonly communesBassin: ReadonlyArray<string>;
}

export function CommercialVilleClosing({
  isFr,
  villeName,
  departementLabel,
  region,
  communesBassin,
}: CommercialVilleClosingProps): ReactNode {
  // Réponse directe (citable) — assemblée depuis la donnée réelle.
  const zone = [departementLabel, region].filter(Boolean).join(", ");
  const directAnswer = isFr
    ? `Axion-IA recrute des commerciaux indépendants à ${villeName}${
        zone ? ` et dans toute la zone (${zone})` : ""
      } pour vendre ses formations, audits, accompagnements 1-to-1 et intégrations IA aux entreprises locales. Statut indépendant, produits souvent finançables, revenus à la commission déplafonnés — et démarrer ne coûte rien.`
    : `Axion-IA is hiring independent sales reps in ${villeName}${
        zone ? ` and across the area (${zone})` : ""
      } to sell its AI trainings, audits, 1-on-1 support and integrations to local companies. Self-employed status, often-fundable products, uncapped commission income — and getting started costs nothing.`;

  return (
    <section className="bg-mocha-rich text-mocha-fg py-16 sm:py-20">
      <Container>
        <p className="text-terracotta-soft text-[12px] font-semibold tracking-[0.16em] uppercase">
          {isFr ? `Devenir commercial IA à ${villeName}` : `Become an AI sales rep in ${villeName}`}
        </p>
        <p
          data-speakable
          className="mt-4 max-w-3xl text-[clamp(1.25rem,2.4vw,1.85rem)] leading-snug font-semibold"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {directAnswer}
        </p>

        {communesBassin.length > 0 ? (
          <p className="text-mocha-fg/75 mt-6 max-w-3xl text-sm leading-relaxed">
            {isFr
              ? "Également ouvert aux communes voisines : "
              : "Also open to neighbouring towns: "}
            {communesBassin.join(", ")}.
          </p>
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
