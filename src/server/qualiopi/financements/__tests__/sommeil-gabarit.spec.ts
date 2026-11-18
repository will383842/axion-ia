// L9b — `gabaritEnSommeil` : seule question posée par la console et le worker.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GABARITS_FINANCEMENT_TIERS_EN_SOMMEIL,
  gabaritEnSommeil,
} from "@/server/qualiopi/financements/sommeil";

afterEach(() => vi.unstubAllEnvs());

describe("gabaritEnSommeil", () => {
  it.each(["false", "", "1", "TRUE"])(
    "vrai pour les deux gabarits quand le drapeau vaut %j",
    (valeur) => {
      vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", valeur);
      for (const g of GABARITS_FINANCEMENT_TIERS_EN_SOMMEIL) expect(gabaritEnSommeil(g)).toBe(true);
    },
  );

  it("vrai quand le drapeau est absent", () => {
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", undefined as unknown as string);
    delete process.env["QUALIOPI_CERTIFICATION_OBTENUE"];
    for (const g of GABARITS_FINANCEMENT_TIERS_EN_SOMMEIL) expect(gabaritEnSommeil(g)).toBe(true);
  });

  it.each(["devis-envoi", "contact-confirmed", "", null, undefined])(
    "faux pour un autre gabarit : %j",
    (t) => {
      vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "false");
      expect(gabaritEnSommeil(t)).toBe(false);
    },
  );

  it("témoin : drapeau à « true » → faux pour les deux", () => {
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "true");
    for (const g of GABARITS_FINANCEMENT_TIERS_EN_SOMMEIL) expect(gabaritEnSommeil(g)).toBe(false);
  });
});
