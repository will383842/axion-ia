import { describe, it, expect } from "vitest";
import { resolveLegacyRedirect } from "./legacy-redirects";

describe("resolveLegacyRedirect — aplatissement des chaînes (audit indexation 2026-06-17)", () => {
  it("résout les slugs exacts vers la cible finale (sans préfixe locale)", () => {
    expect(resolveLegacyRedirect("/interventions")).toBe("/formations");
    expect(resolveLegacyRedirect("/interventions/collectives")).toBe("/formations");
    expect(resolveLegacyRedirect("/interventions/collectives/4h")).toBe("/formations");
    expect(resolveLegacyRedirect("/codage-developpement")).toBe("/sites-web-augmentes");
    expect(resolveLegacyRedirect("/codage-developpement/web-digital")).toBe("/sites-web-augmentes");
    expect(resolveLegacyRedirect("/audit/flash")).toBe("/audit/tpe-1-jour");
    expect(resolveLegacyRedirect("/audit/process")).toBe("/audit/cible");
    // Tunnel apporteurs renommé le 2026-09-04. C'est la forme NON préfixée
    // (`axion-ia.com/facebook`) qui a pu circuler dans les publicités Meta :
    // sans cette entrée elle ferait 2 sauts au lieu d'un.
    expect(resolveLegacyRedirect("/facebook")).toBe("/apporteur-affaires");
    expect(resolveLegacyRedirect("/facebook/merci")).toBe("/apporteur-affaires/merci");
    // La page SEO voisine partage le PRÉFIXE du nouveau slug : elle ne doit
    // surtout pas être happée par la redirection.
    expect(
      resolveLegacyRedirect("/apporteur-affaires-independant-formation-ia-entreprise"),
    ).toBeNull();
    expect(resolveLegacyRedirect("/faq/definition")).toBe("/faq/definition-axion-ia");
    expect(resolveLegacyRedirect("/interventions/dirigeant-productivite")).toBe(
      "/interventions/dirigeants",
    );
  });

  it("résout la forme dynamique /interventions/par-ville/<ville>", () => {
    expect(resolveLegacyRedirect("/interventions/par-ville/lyon")).toBe(
      "/formations/par-ville/lyon",
    );
    expect(resolveLegacyRedirect("/interventions/par-ville/saint-etienne")).toBe(
      "/formations/par-ville/saint-etienne",
    );
  });

  it("résout les anciennes pages ville×verticale vers la page service", () => {
    expect(
      resolveLegacyRedirect("/implantations/provence-alpes-cote-d-azur/aix-en-provence/audits"),
    ).toBe("/audit");
    expect(
      resolveLegacyRedirect("/implantations/ile-de-france/boulogne-billancourt/implementations"),
    ).toBe("/implementation");
    expect(resolveLegacyRedirect("/locations/hauts-de-france/amiens/sites-web-ia")).toBe(
      "/sites-web-augmentes",
    );
    expect(resolveLegacyRedirect("/implantations/hauts-de-france/amiens/un-a-un")).toBe("/un-a-un");
  });

  it("retourne null pour les chemins non-legacy (fail-safe → préfixage /fr normal)", () => {
    expect(resolveLegacyRedirect("/audit")).toBeNull();
    expect(resolveLegacyRedirect("/formations")).toBeNull();
    expect(resolveLegacyRedirect("/a-propos")).toBeNull();
    expect(resolveLegacyRedirect("/implantations/ile-de-france/paris")).toBeNull();
    expect(resolveLegacyRedirect("/blog/un-article")).toBeNull();
    expect(resolveLegacyRedirect("/")).toBeNull();
  });
});
