// Garde : pas d'allumage du changement d'IBAN sans le gel des virements (lot 7).
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  delete process.env["APPORTEUR_CHANGEMENT_IBAN_ENABLED"];
  vi.resetModules();
  vi.doUnmock("../gel-virements");
});

describe("interrupteur et gel des virements", () => {
  it("le gel existe (lot 7) : la constante vaut true", async () => {
    const { GEL_VIREMENTS_DISPONIBLE } = await import("../gel-virements");
    expect(GEL_VIREMENTS_DISPONIBLE).toBe(true);
  });

  it("allumé avec la variable à « true » seulement, une fois le gel livré", async () => {
    process.env["APPORTEUR_CHANGEMENT_IBAN_ENABLED"] = "true";
    const { changementIbanActif } = await import("../interrupteur-changement-iban");
    expect(changementIbanActif()).toBe(true);
  });

  it("reste éteint, même avec la variable à « true », si le gel est retiré", async () => {
    vi.doMock("../gel-virements", () => ({ GEL_VIREMENTS_DISPONIBLE: false }));
    process.env["APPORTEUR_CHANGEMENT_IBAN_ENABLED"] = "true";
    const { changementIbanActif } = await import("../interrupteur-changement-iban");
    expect(changementIbanActif()).toBe(false);
  });

  it("s'allume avec la variable seulement quand le gel est disponible", async () => {
    vi.doMock("../gel-virements", () => ({ GEL_VIREMENTS_DISPONIBLE: true }));
    process.env["APPORTEUR_CHANGEMENT_IBAN_ENABLED"] = "true";
    const { changementIbanActif } = await import("../interrupteur-changement-iban");
    expect(changementIbanActif()).toBe(true);
    process.env["APPORTEUR_CHANGEMENT_IBAN_ENABLED"] = "1";
    expect(changementIbanActif()).toBe(false);
  });
});
