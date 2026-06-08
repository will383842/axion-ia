// Server Component — « Comment ça marche ». Visuel = infographie fournie par
// Will (titre + 4 étapes + bénéfices intégrés). Pour le SEO/AEO/accessibilité,
// le titre et les 4 étapes restent en texte réel (sr-only) + alt descriptif :
// une image seule n'est pas crawlable.

import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";
import { ZoomableImage } from "@/components/marketing/ZoomableImage";
import { COMMERCIAL_STEPS } from "@/content/recrutement/commercial-offer";

export interface CommercialHowItWorksProps {
  readonly isFr: boolean;
}

export function CommercialHowItWorks({ isFr }: CommercialHowItWorksProps): ReactNode {
  const stepsText = COMMERCIAL_STEPS.map(
    (s, i) => `${i + 1}. ${isFr ? s.titleFr : s.titleEn} — ${isFr ? s.textFr : s.textEn}`,
  ).join(" ");

  return (
    <section className="bg-paper py-16 sm:py-24">
      <Container>
        {/* SEO / AEO / a11y : titre + étapes en texte réel (l'infographie porte le visuel). */}
        <h2 className="sr-only">
          {isFr
            ? "Comment ça marche — Vendre l'IA, simplement"
            : "How it works — Selling AI, made simple"}
        </h2>
        <p className="sr-only">{stepsText}</p>

        <ZoomableImage
          src="/illustrations/devenir-commercial-comment-ca-marche.webp"
          alt={
            isFr
              ? "Comment ça marche chez Axion-IA en 4 étapes : 01 vous démarchez toutes les entreprises (TPE, artisans, commerçants, PME, ETI, grandes entreprises) ; 02 vous présentez une offre simple d'une dizaine de produits (formations, audits, intégrations) ; 03 vous tracez vos entreprises sur votre dashboard à votre nom ; 04 vous touchez vos commissions (fixe sur les formations, pourcentage de la facture sur les audits et intégrations), sans plafond. Zéro risque, accompagnement, commissions rapides et mensuelles, modèle évolutif."
              : "How it works at Axion-IA in 4 steps: 01 you prospect all companies (micro-businesses, artisans, retailers, SMEs, mid-caps, large enterprises); 02 you present a simple offer of about ten products (trainings, audits, integrations); 03 you log your companies on your dashboard under your name; 04 you earn your commissions (flat on trainings, percentage of the invoice on audits and integrations), uncapped. Zero risk, support, fast monthly commissions, scalable model."
          }
          width={1774}
          height={887}
          sizes="(max-width: 1366px) 94vw, 1238px"
          quality={90}
          figureClassName="w-full"
          zoomLabel={isFr ? "Agrandir" : "Enlarge"}
        />
      </Container>
    </section>
  );
}
