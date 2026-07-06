import { ServicesGrid } from "@/components/services/ServicesGrid";
import { serviceOfficial, type ServiceId } from "@/content/services";

// Strip compact « 5 activités Axion-IA » pour l'espace presse.
//
// Depuis 2026-07-06, ce composant n'est plus qu'un WRAPPER de `ServicesGrid`
// (variante `strip`) : la SSOT visuelle (icône + couleur d'accent par service)
// et les dimensions vivent désormais dans un composant unique partagé avec la
// home et /visibilite-entreprise — fin de la divergence d'icônes/couleurs.
// Le seul contenu propre à la presse = les blurbs (1 ligne, i18n sourcée),
// injectés via `renderBody`. Server component, zéro JS client (budget Web Vitals).

interface PressActivitiesStripProps {
  isFr: boolean;
  /** Phrase descriptive courte (1 ligne) par activité — i18n, sourcée. */
  blurbs: Record<ServiceId, string>;
  /** Libellé accessible du lien (ex. « Découvrir »). */
  discoverLabel: string;
}

export function PressActivitiesStrip({ isFr, blurbs, discoverLabel }: PressActivitiesStripProps) {
  return (
    <ServicesGrid
      variant="strip"
      isFr={isFr}
      cardAriaLabel={({ service }) => `${discoverLabel} : ${serviceOfficial(service, isFr)}`}
      renderBody={({ service }) => (
        <span className="text-fg-soft mt-2 text-sm leading-relaxed">{blurbs[service.id]}</span>
      )}
    />
  );
}
