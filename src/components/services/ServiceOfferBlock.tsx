/**
 * KB V4.1 Service Binding — Vagues B+C. Bloc « Aller plus loin » sur une page
 * ressource KB rattachée à un service (tag `service:*`).
 *
 * Server Component pur (CLS=0, zéro JS client). Affiche un CTA contextuel vers
 * la page service. SANS PRIX (décision Will 2026-06-02 — on ne parle pas de
 * prix, surtout pour l'implémentation) : ni dans le texte, ni dans le CTA, ni
 * en Offer JSON-LD. On dirige simplement vers la page service.
 *
 * Masqué si le service est inconnu.
 */

import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { getServiceCta } from "@/lib/knowledge/service-binding";
import type { ServiceSlug } from "@/content/knowledge/services";

interface ServiceOfferBlockProps {
  readonly service: ServiceSlug;
}

export function ServiceOfferBlock({ service }: ServiceOfferBlockProps) {
  const cta = getServiceCta(service);
  if (!cta) return null;
  const label = cta.labelFr.replace(/^Découvrir /, "");

  return (
    <Section
      tone="sand"
      eyebrow="Aller plus loin"
      title="Concrétisez avec"
      titleEm={`« ${label} »`}
    >
      <p className="text-fg-soft -mt-10 mb-8 max-w-2xl text-lg leading-relaxed">
        Ce sujet fait partie de notre expertise. Passez à l’action avec un accompagnement Axion-IA,
        sur vos vrais cas.
      </p>
      <Cta href={cta.href as never} size="lg">
        {cta.labelFr} →
      </Cta>
    </Section>
  );
}
