// @vitest-environment node
// Tests — buildOrganizationJsonLd : certification Qualiopi (hasCredential).
// Le nœud #organization est émis sur TOUTES les pages (signal SEO/AEO/GEO).
// Environnement `node` requis : la fonction lit des env vars SERVEUR (t3-env),
// dont l'accès lève sous jsdom (« server var on client »).

import { describe, it, expect } from "vitest";
import { buildOrganizationJsonLd } from "../seo";

describe("buildOrganizationJsonLd — certification Qualiopi", () => {
  it("n'émet PAS hasCredential sans certification (Phase A)", () => {
    const org = buildOrganizationJsonLd({ locale: "fr" });
    expect("hasCredential" in org).toBe(false);
  });

  it("émet hasCredential EducationalOccupationalCredential en Phase B", () => {
    const org = buildOrganizationJsonLd({
      locale: "fr",
      qualiopiCertification: {
        number: "CERT-2026-001",
        description:
          "La certification qualité a été délivrée au titre de la ou des catégories d'actions suivantes : Actions de formation.",
        issuer: "Certif'OF",
      },
    });
    const cred = (org as { hasCredential?: Record<string, unknown> }).hasCredential;
    expect(cred).toBeDefined();
    expect(cred?.["@type"]).toBe("EducationalOccupationalCredential");
    expect(cred?.identifier).toBe("CERT-2026-001");
    expect(String(cred?.description)).toContain("Actions de formation");
    // Reconnaissance par le Ministère du Travail + organisme certificateur.
    const recognized = JSON.stringify(cred?.recognizedBy);
    expect(recognized).toContain("Ministère du Travail");
    expect(recognized).toContain("Certif'OF");
  });

  it("omet l'organisme certificateur si non fourni", () => {
    const org = buildOrganizationJsonLd({
      locale: "fr",
      qualiopiCertification: {
        number: "CERT-2026-001",
        description: "Catégorie : Actions de formation.",
      },
    });
    const cred = (org as { hasCredential?: { recognizedBy: unknown[] } }).hasCredential;
    // Seul le Ministère du Travail est listé (1 entrée).
    expect(cred?.recognizedBy).toHaveLength(1);
  });
});
