// City Domination 2026-05-18 P1-2 — Tests buildCourseJsonLd.
// Course schema activé sur /interventions/collectives/* pour citation AEO
// "formation IA" sans dilution du naming brand "intervention".

import { describe, it, expect } from "vitest";
import { buildCourseJsonLd } from "../seo";

describe("buildCourseJsonLd — P1-2 Course schema interventions/collectives", () => {
  it("émet @type Course + @id + provider org", () => {
    const out = buildCourseJsonLd({
      locale: "fr",
      path: "/interventions/collectives/1-jour",
      name: "Intervention collective 1 jour IA opérationnelle",
      description:
        "Session de 1 jour pour décideurs et équipes opérationnelles. Adoption d'outils IA générative dans un cadre métier concret.",
    });
    expect(out["@type"]).toBe("Course");
    expect(out.name).toMatch(/Intervention collective 1 jour/);
    expect(out.provider).toEqual({ "@id": expect.stringMatching(/#organization$/) });
  });

  it("émet hasCourseInstance avec mode Onsite par défaut", () => {
    const out = buildCourseJsonLd({
      locale: "fr",
      path: "/interventions/collectives/4h",
      name: "Intervention collective 4 h",
      description: "Format court session 4 h pour management ou équipes ciblées.",
    });
    expect(Array.isArray(out.hasCourseInstance)).toBe(true);
    expect(out.hasCourseInstance).toHaveLength(1);
    expect(out.hasCourseInstance[0]).toMatchObject({
      "@type": "CourseInstance",
      courseMode: "Onsite",
    });
  });

  it("Onsite émet location Place France sans adresse fixe", () => {
    const out = buildCourseJsonLd({
      locale: "fr",
      path: "/interventions/collectives/1-jour",
      name: "X",
      description: "Une description suffisamment longue pour passer le rich results gate Google.",
    });
    const instance = out.hasCourseInstance[0] as Record<string, unknown>;
    const location = instance.location as Record<string, unknown>;
    expect(location?.["@type"]).toBe("Place");
    expect((location?.address as Record<string, unknown>)?.addressCountry).toBe("FR");
  });

  it("multi-mode (Onsite + Hybrid) émet 2 CourseInstance", () => {
    const out = buildCourseJsonLd({
      locale: "fr",
      path: "/interventions/collectives/2-jours",
      name: "Intervention 2 jours",
      description: "Format approfondi 2 jours avec partie distanciel possible.",
      courseMode: ["Onsite", "Hybrid"],
    });
    expect(out.hasCourseInstance).toHaveLength(2);
    expect((out.hasCourseInstance[0] as Record<string, unknown>).courseMode).toBe("Onsite");
    expect((out.hasCourseInstance[1] as Record<string, unknown>).courseMode).toBe("Hybrid");
  });

  it("émet Offer si priceEurHt fourni", () => {
    const out = buildCourseJsonLd({
      locale: "fr",
      path: "/interventions/collectives/1-jour",
      name: "X",
      description: "Description complète intervention 1 jour pour test offre prix HT.",
      priceEurHt: 1990,
    });
    const offers = out.offers as Record<string, unknown> | undefined;
    expect(offers).toBeDefined();
    expect(offers?.["@type"]).toBe("Offer");
    expect(offers?.priceCurrency).toBe("EUR");
    expect(offers?.price).toBe("1990");
  });

  it("émet audience BusinessAudience si audienceType fourni", () => {
    const out = buildCourseJsonLd({
      locale: "fr",
      path: "/interventions/collectives/3-jours-plus",
      name: "X",
      description: "Format long 3 jours plus pour acculturation IA approfondie multi-niveaux.",
      audienceType: "Décideurs, managers, équipes opérationnelles",
    });
    const audience = out.audience as Record<string, unknown> | undefined;
    expect(audience?.["@type"]).toBe("BusinessAudience");
    expect(audience?.audienceType).toMatch(/Décideurs/);
  });

  it("inLanguage = fr-FR pour locale fr", () => {
    const out = buildCourseJsonLd({
      locale: "fr",
      path: "/x",
      name: "X",
      description: "Description suffisamment longue pour validation rich results 2026.",
    });
    expect(out.inLanguage).toBe("fr-FR");
  });

  it("inLanguage = en-US pour locale en", () => {
    const out = buildCourseJsonLd({
      locale: "en",
      path: "/x",
      name: "X",
      description: "A description long enough to satisfy the rich results gate for 2026.",
    });
    expect(out.inLanguage).toBe("en-US");
  });
});
