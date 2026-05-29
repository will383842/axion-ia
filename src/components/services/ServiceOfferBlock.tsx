/**
 * KB V4.1 Service Binding — Vagues B+C. Bloc « Aller plus loin » sur une page
 * ressource KB rattachée à un service (tag `service:*`).
 *
 * Server Component pur (CLS=0, zéro JS client). Affiche un CTA contextuel vers
 * la page service avec tarif live (« dès X € » tiré de `pricing.ts`) et émet un
 * JSON-LD `Offer` (uniquement si un tarif existe — décision Will).
 *
 * Masqué si le service est inconnu. Pour `sites-web-augmentes` (pas de tiers
 * dédiés), le CTA s'affiche SANS prix et aucun Offer JSON-LD n'est émis.
 */

import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { getServiceCta, buildServiceOfferJsonLd } from "@/lib/knowledge/service-binding";
import type { ServiceSlug } from "@/content/knowledge/services";

interface ServiceOfferBlockProps {
  readonly service: ServiceSlug;
}

export function ServiceOfferBlock({ service }: ServiceOfferBlockProps) {
  const cta = getServiceCta(service);
  if (!cta) return null;
  const offerJsonLd = buildServiceOfferJsonLd(service);

  return (
    <Section tone="sand" aria-labelledby="aller-plus-loin">
      <h2 id="aller-plus-loin" className="display-editorial text-fg mb-4">
        Aller plus loin
      </h2>
      <p className="text-fg-soft mb-6 max-w-2xl text-lg leading-relaxed">
        {cta.fromLabelFr
          ? `Ce contenu fait partie de notre expertise « ${cta.labelFr.replace(/^Découvrir /, "")} ». Concrétisez avec un accompagnement Axion-IA — ${cta.fromLabelFr}.`
          : `Ce contenu fait partie de notre expertise « ${cta.labelFr.replace(/^Découvrir /, "")} ». Concrétisez avec un accompagnement Axion-IA.`}
      </p>
      <Cta href={cta.href as never} size="lg">
        {cta.labelFr}
        {cta.fromLabelFr ? ` · ${cta.fromLabelFr}` : ""} →
      </Cta>
      {offerJsonLd ? <JsonLd data={offerJsonLd} /> : null}
    </Section>
  );
}
