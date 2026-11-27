/**
 * Sous-plafonds du pilotage SEO (P0) : lecture tolérante, l'erreur va toujours vers le plus strict.
 */
import { describe, it, expect } from "vitest";
import {
  BORNE_JOUR_USD,
  BORNE_MOIS_USD,
  CLES_PILOTAGE,
  PILOTAGE_JOUR_DEFAUT_USD,
  PILOTAGE_MOIS_DEFAUT_USD,
  lireSousPlafondsPilotage,
} from "../blog-claude-plafonds";

describe("sous-plafonds du pilotage", () => {
  it("clés et défauts : 2 $ par jour, 30 $ par mois", () => {
    expect(CLES_PILOTAGE).toEqual({
      jour: "pilotage_cout_max_jour_usd",
      mois: "pilotage_cout_max_mois_usd",
    });
    expect(PILOTAGE_JOUR_DEFAUT_USD).toBe(2);
    expect(PILOTAGE_MOIS_DEFAUT_USD).toBe(30);
  });

  it("clés absentes : défauts", () => {
    expect(lireSousPlafondsPilotage(undefined, undefined)).toEqual({ jour: 2, mois: 30 });
  });

  it("valeurs posées : reprises", () => {
    expect(lireSousPlafondsPilotage(1, 12)).toEqual({ jour: 1, mois: 12 });
  });

  it("valeur illisible (chaîne, négatif, NaN, null) : défaut", () => {
    expect(lireSousPlafondsPilotage("5", -1)).toEqual({ jour: 2, mois: 30 });
    expect(lireSousPlafondsPilotage(Number.NaN, null)).toEqual({ jour: 2, mois: 30 });
    expect(lireSousPlafondsPilotage(Number.POSITIVE_INFINITY, {})).toEqual({ jour: 2, mois: 30 });
  });

  it("zéro explicite : tout est refusé (jamais ramené au défaut)", () => {
    expect(lireSousPlafondsPilotage(0, 0)).toEqual({ jour: 0, mois: 0 });
  });

  it("au-dessus des bornes de garde : défaut plafonné à la borne", () => {
    expect(lireSousPlafondsPilotage(BORNE_JOUR_USD + 1, BORNE_MOIS_USD + 1)).toEqual({
      jour: 2,
      mois: 30,
    });
  });

  it("jour > mois : le jour est ramené au mois", () => {
    expect(lireSousPlafondsPilotage(10, 4)).toEqual({ jour: 4, mois: 4 });
  });
});
