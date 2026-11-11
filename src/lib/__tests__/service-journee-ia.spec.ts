/**
 * Fondations SEO de La Journée IA (PR-A) : le nœud `Service` partagé et les
 * deux paramètres ajoutés aux builders de `seo.ts`.
 *
 * Garde-fou central (a) : sans les nouveaux paramètres, `buildServiceJsonLd`
 * rend EXACTEMENT ce qu'il rendait avant (une trentaine d'appelants en
 * dépendent). L'attendu est écrit en dur, clé par clé et dans l'ordre : on compare
 * la chaîne JSON, pas seulement l'égalité profonde, pour attraper un ordre changé.
 */

import { describe, it, expect, vi } from "vitest";

// Aucune surcharge d'aperçu posée en console : on ne touche pas la base.
vi.mock("@/server/seo/og-overrides", () => ({ surchargeOgPour: async () => null }));

import { SITE_URL, buildProductMetadata, buildServiceJsonLd, urlOgParDefaut } from "@/lib/seo";
import { JOURNEE_IA_SERVICE_ID, buildJourneeIaServiceJsonLd } from "@/lib/seo/journee-ia-service";
import { JOURNEE_IA_TIER } from "@/content/pricing";
import { OG_IMAGE_HAUTEUR, OG_IMAGE_LARGEUR } from "@/lib/og-format";

describe("buildServiceJsonLd : sortie inchangée sans les nouveaux paramètres", () => {
  it("(a) rend exactement l'objet d'avant, clés dans le même ordre", () => {
    const sortie = buildServiceJsonLd({
      locale: "fr",
      path: "/audit",
      name: "Audit IA",
      description: "Description de test.",
      priceEur: 1900,
      // R7 : sans ce drapeau (interrupteur des prix coupé), aucune Offer ne sort ; on le
      // force pour comparer aussi la forme de l’Offer d’avant.
      prixPublic: true,
      serviceType: "Audit",
      dateModified: "2026-01-02",
      areasServed: [{ type: "Country", name: "France" }],
      availableChannels: [{ name: "Paris", url: "https://exemple.test/paris" }],
    });
    const attendu = {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Audit IA",
      description: "Description de test.",
      url: `${SITE_URL}/fr/audit`,
      dateModified: "2026-01-02",
      provider: { "@type": "Organization", name: "Axion-IA", url: SITE_URL },
      serviceType: "Audit",
      areaServed: [{ "@type": "Country", name: "France" }],
      availableChannel: [
        { "@type": "ServiceChannel", name: "Paris", serviceUrl: "https://exemple.test/paris" },
      ],
      offers: {
        "@type": "Offer",
        price: "1900",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        url: `${SITE_URL}/fr/audit`,
      },
    };
    expect(sortie).toStrictEqual(attendu);
    expect(JSON.stringify(sortie)).toBe(JSON.stringify(attendu));
    const cles = Object.keys(sortie);
    for (const nouvelle of ["@id", "audience", "termsOfService", "mainEntityOfPage"]) {
      expect(cles).not.toContain(nouvelle);
    }
  });

  it("(a bis) sans prix, sans canal, sans zone : aucune clé nouvelle", () => {
    const sortie = buildServiceJsonLd({
      locale: "fr",
      path: "/x",
      name: "X",
      description: "Y",
      areasServed: [],
    });
    expect(Object.keys(sortie)).toStrictEqual([
      "@context",
      "@type",
      "name",
      "description",
      "url",
      "provider",
    ]);
  });

  it("(a ter) un canal avec url garde son serviceUrl, un canal sans url n'en émet pas", () => {
    const sortie = buildServiceJsonLd({
      locale: "fr",
      path: "/x",
      name: "X",
      description: "Y",
      areasServed: [],
      availableChannels: [{ name: "A", url: "https://exemple.test/a" }, { name: "B" }],
    });
    expect(sortie.availableChannel).toStrictEqual([
      { "@type": "ServiceChannel", name: "A", serviceUrl: "https://exemple.test/a" },
      { "@type": "ServiceChannel", name: "B" },
    ]);
  });
});

describe("buildJourneeIaServiceJsonLd : le nœud partagé", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const noeud = buildJourneeIaServiceJsonLd() as unknown as Record<string, any>;

  it("(b) porte son @id et référence l'Organization au lieu de la réémettre", () => {
    expect(noeud["@id"]).toBe(JOURNEE_IA_SERVICE_ID);
    expect(JOURNEE_IA_SERVICE_ID).toBe(`${SITE_URL}/fr/journee-ia#service`);
    expect(noeud.provider).toStrictEqual({ "@id": `${SITE_URL}/#organization` });
    expect(noeud.offers.seller).toStrictEqual({ "@id": `${SITE_URL}/#organization` });
  });

  it("(b) le prix vient de JOURNEE_IA_TIER, HT, à la journée", () => {
    expect(noeud.offers.price).toBe(String(JOURNEE_IA_TIER.priceFlat));
    expect(noeud.offers.priceSpecification.price).toBe(JOURNEE_IA_TIER.priceFlat);
    expect(noeud.offers.priceSpecification.priceCurrency).toBe("EUR");
    expect(noeud.offers.priceSpecification.valueAddedTaxIncluded).toBe(false);
    expect(noeud.offers.priceSpecification.unitCode).toBe("DAY");
    expect(noeud.offers.priceSpecification.unitText).toBe("journée");
    expect(noeud.offers.eligibleCustomerType).toBe("http://purl.org/goodrelations/v1#Business");
  });

  it("(b) conditions, page principale, public et canal", () => {
    expect(noeud.termsOfService.endsWith("/fr/conditions-generales")).toBe(true);
    expect(noeud.mainEntityOfPage).toStrictEqual({ "@id": `${SITE_URL}/fr/journee-ia#webpage` });
    expect(noeud.audience).toStrictEqual({
      "@type": "BusinessAudience",
      audienceType: "PME et TPE",
      numberOfEmployees: { "@type": "QuantitativeValue", minValue: 5, maxValue: 249 },
    });
    expect(noeud.availableChannel).toStrictEqual([
      { "@type": "ServiceChannel", name: "Dans les locaux du client, partout en France" },
    ]);
    expect(noeud.areaServed).toStrictEqual([{ "@type": "Country", name: "France" }]);
    expect(noeud.serviceType).toBe("Audit et formation à l’IA en entreprise");
  });

  it("(b) description résolue, sans jeton, et sans type interdit", () => {
    expect(noeud.description).not.toContain("{{");
    expect(noeud.description).toMatch(/prix unique\.$/);
    expect(JSON.stringify(noeud)).not.toMatch(/Review|AggregateRating|"Course"|"Product"|"Event"/);
  });

  it("deux appels rendent le même objet (source unique)", () => {
    expect(JSON.stringify(buildJourneeIaServiceJsonLd())).toBe(JSON.stringify(noeud));
  });
});

describe("buildProductMetadata : ogImageAlt", () => {
  const BASE = {
    locale: "fr" as const,
    path: "/audit",
    title: "Audit IA en entreprise",
    description:
      "Cartographie complète, priorités identifiées et rapport chiffré sous sept jours ouvrés pour votre entreprise.",
  };

  it("(c) avec ogImageAlt : alt Open Graph ET image Twitter objet avec alt", async () => {
    const meta = await buildProductMetadata({ ...BASE, ogImageAlt: "Texte alternatif" });
    const og = (meta.openGraph?.images as Array<{ url: string; alt?: string }>)[0]!;
    expect(og.alt).toBe("Texte alternatif");
    const tw = (meta.twitter?.images as Array<unknown>)[0] as { url: string; alt: string };
    expect(tw).toStrictEqual({ url: og.url, alt: "Texte alternatif" });
  });

  it("(c) sans ogImageAlt : alt = titre d'aperçu, Twitter reste un tableau de chaînes", async () => {
    const meta = await buildProductMetadata(BASE);
    const og = (meta.openGraph?.images as Array<{ url: string; alt?: string }>)[0]!;
    expect(og.alt).toBe(BASE.title);
    expect(meta.twitter?.images).toStrictEqual([og.url]);
  });
});

describe("urlOgParDefaut", () => {
  it("reprend le calcul historique de l'URL /api/og", () => {
    expect(urlOgParDefaut({ title: "A & B" })).toBe(`${SITE_URL}/api/og?title=A%20%26%20B`);
    expect(urlOgParDefaut({ title: "T", accent: "green", eyebrow: "Sur-titre é" })).toBe(
      `${SITE_URL}/api/og?title=T&accent=green&eyebrow=Sur-titre%20%C3%A9`,
    );
  });

  it("buildProductMetadata l'utilise : l'image Open Graph en est issue", async () => {
    const meta = await buildProductMetadata({
      locale: "fr",
      path: "/audit",
      title: "Audit IA en entreprise",
      description:
        "Cartographie complète, priorités identifiées et rapport chiffré sous sept jours ouvrés.",
      ogEyebrow: "Sur-titre",
      ogAccent: "purple",
    });
    const og = (
      meta.openGraph?.images as Array<{ url: string; width?: number; height?: number }>
    )[0]!;
    expect(og.url).toBe(
      urlOgParDefaut({ title: "Audit IA en entreprise", accent: "purple", eyebrow: "Sur-titre" }),
    );
    expect(og.width).toBe(OG_IMAGE_LARGEUR);
    expect(og.height).toBe(OG_IMAGE_HAUTEUR);
  });
});
