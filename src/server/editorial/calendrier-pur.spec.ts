/**
 * Console éditoriale — tests de la logique de calendrier (lot 0).
 *
 * Ces fonctions décident de ce que l'écran montre. Elles vivaient dans un
 * module `server-only`, donc intestable ; les en avoir sorties est ce qui
 * rend ce fichier possible.
 *
 * L'accent est mis sur les **entrées hostiles** : les paramètres viennent
 * d'une URL, et une URL n'est jamais de confiance.
 */

import { describe, it, expect } from "vitest";
import {
  estFiltreIdentite,
  bornesDuMois,
  moisVoisin,
  lireMois,
  lireAnnee,
  estCleJour,
  compterParJour,
} from "./calendrier-pur";

describe("estFiltreIdentite", () => {
  it("reconnaît les deux seules identités", () => {
    expect(estFiltreIdentite("perso")).toBe("perso");
    expect(estFiltreIdentite("pro")).toBe("pro");
  });

  it("retombe sur « toutes » pour tout le reste", () => {
    expect(estFiltreIdentite(undefined)).toBe("toutes");
    expect(estFiltreIdentite("")).toBe("toutes");
    expect(estFiltreIdentite("PRO")).toBe("toutes");
    expect(estFiltreIdentite("professionnel")).toBe("toutes");
    expect(estFiltreIdentite("../../etc/passwd")).toBe("toutes");
  });
});

describe("bornesDuMois", () => {
  it("borne le mois en UTC, fin exclusive", () => {
    const { debut, fin } = bornesDuMois(2026, 9);
    expect(debut.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(fin.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("🔴 passe l'année sur décembre, sans déborder", () => {
    const { debut, fin } = bornesDuMois(2026, 12);
    expect(debut.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(fin.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("prend février bissextile pour ce qu'il est", () => {
    const { fin } = bornesDuMois(2028, 2);
    expect(fin.toISOString()).toBe("2028-03-01T00:00:00.000Z");
  });
});

describe("moisVoisin", () => {
  it("avance et recule d'un mois", () => {
    expect(moisVoisin(2026, 9, 1)).toEqual({ annee: 2026, mois: 10 });
    expect(moisVoisin(2026, 9, -1)).toEqual({ annee: 2026, mois: 8 });
  });

  it("🔴 franchit correctement les deux bords d'année", () => {
    // Le bug classique : `mois + 1 = 13` affiché tel quel, ou `mois - 1 = 0`.
    expect(moisVoisin(2026, 12, 1)).toEqual({ annee: 2027, mois: 1 });
    expect(moisVoisin(2026, 1, -1)).toEqual({ annee: 2025, mois: 12 });
  });
});

describe("lireMois", () => {
  it("accepte les douze mois", () => {
    for (let m = 1; m <= 12; m += 1) {
      expect(lireMois(String(m), 6)).toBe(m);
    }
  });

  it("🔴 REFUSE tout ce qui ferait rendre `MOIS[mois - 1]` undefined", () => {
    // Sans ce bornage, le titre devient « Calendrier — undefined 2026 ».
    for (const v of ["0", "13", "99", "-4", "abc", "", undefined, "3.9.9"]) {
      const r = lireMois(v as string | undefined, 6);
      expect(r, `pour ${String(v)}`).toBeGreaterThanOrEqual(1);
      expect(r, `pour ${String(v)}`).toBeLessThanOrEqual(12);
    }
  });

  it("retient le défaut quand l'entrée est absurde", () => {
    expect(lireMois("99", 6)).toBe(6);
    expect(lireMois(undefined, 9)).toBe(9);
  });

  it("tolère « 09 », que produit un lien construit avec padStart", () => {
    expect(lireMois("09", 6)).toBe(9);
  });
});

describe("lireAnnee", () => {
  it("accepte une année plausible", () => {
    expect(lireAnnee("2026", 2026)).toBe(2026);
    expect(lireAnnee("2030", 2026)).toBe(2030);
  });

  it("REFUSE hors fenêtre et non numérique", () => {
    expect(lireAnnee("1", 2026)).toBe(2026);
    expect(lireAnnee("9999", 2026)).toBe(2026);
    expect(lireAnnee("abcd", 2026)).toBe(2026);
    expect(lireAnnee(undefined, 2026)).toBe(2026);
  });
});

describe("estCleJour", () => {
  it("accepte une clé bien formée", () => {
    expect(estCleJour("2026-09-01")).toBe(true);
  });

  it("REFUSE tout le reste", () => {
    for (const v of ["2026-9-1", "01/09/2026", "", undefined, "2026-09-01T00:00:00Z"]) {
      expect(estCleJour(v), `pour ${String(v)}`).toBe(false);
    }
  });
});

describe("compterParJour", () => {
  it("additionne les publications d'un même jour", () => {
    const parJour = compterParJour([
      { dayKey: "2026-09-01" },
      { dayKey: "2026-09-01" },
      { dayKey: "2026-09-02" },
    ]);
    expect(parJour.get("2026-09-01")).toBe(2);
    expect(parJour.get("2026-09-02")).toBe(1);
  });

  it("🔴 compte bien DEUX quand un écho tombe le jour de sa source", () => {
    // C'est le cas réel de septembre : 15 publications du profil et 4 échos
    // de page aux mêmes dates. Ce ne sont pas des doublons — deux diffusions.
    const parJour = compterParJour([{ dayKey: "2026-09-01" }, { dayKey: "2026-09-01" }]);
    expect(parJour.get("2026-09-01")).toBe(2);
  });

  it("rend une table vide sans rien inventer", () => {
    expect(compterParJour([]).size).toBe(0);
  });
});
