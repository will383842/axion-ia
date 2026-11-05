import { describe, expect, it } from "vitest";

import {
  choixCanonique,
  debutMaintenance,
  echeancierPhases,
  indemniteSortieMaxCents,
  nbMaxFactures,
  prixMensuelNet,
  sha256Choix,
  sha256Offre,
  totauxFormule,
} from "./offre-calculs";
import { offreFictive } from "./offre-fixtures.spec-util";

const phase = (rang: number, pourcentage: number) => ({
  rang,
  libelle: `P${rang}`,
  pourcentage,
  declencheur: "signature" as const,
});

describe("prixMensuelNet", () => {
  it("arrondit AVANT de multiplier par les mois", () => {
    // 1001 * (10000-1500)/10000 = 850,85 -> 851 ; x6 = 5106 (et non 5105,1)
    expect(prixMensuelNet(1001, 1500) * 6).toBe(5106);
  });
  it("sans remise : inchangé", () => {
    expect(prixMensuelNet(1234, 0)).toBe(1234);
  });
});

describe("echeancierPhases", () => {
  it("le dernier palier absorbe le reste, somme = total", () => {
    const r = echeancierPhases(1001, [phase(1, 33), phase(2, 33), phase(3, 34)], [2000]);
    expect(r.map((p) => p.montantHtCents)).toEqual([330, 330, 341]);
    expect(r.reduce((s, p) => s + p.montantHtCents, 0)).toBe(1001);
  });
  it("refuse plusieurs paliers avec plusieurs taux de TVA", () => {
    expect(() => echeancierPhases(1000, [phase(1, 50), phase(2, 50)], [2000, 1000])).toThrow();
  });
  it("accepte un palier unique multi-taux", () => {
    expect(echeancierPhases(1000, [phase(1, 100)], [2000, 1000])).toHaveLength(1);
  });
  it("refuse une somme différente de 100", () => {
    expect(() => echeancierPhases(1000, [phase(1, 50)], [2000])).toThrow();
  });
});

describe("engagement, maintenance, indemnité", () => {
  it("nbMaxFactures", () => {
    expect(nbMaxFactures(12, 6)).toBe(2);
    expect(nbMaxFactures(0, 1)).toBe(0);
  });
  it("debutMaintenance ajoute les mois offerts", () => {
    const d = debutMaintenance(new Date(Date.UTC(2030, 0, 31)), 2);
    expect(d.toISOString().slice(0, 10)).toBe("2030-03-31");
  });
  it("debutMaintenance borne en fin de mois", () => {
    const d = debutMaintenance(new Date(Date.UTC(2030, 0, 31)), 1);
    expect(d.toISOString().slice(0, 10)).toBe("2030-02-28");
  });
  it("indemniteSortieMaxCents = taux x mensualités restantes", () => {
    expect(indemniteSortieMaxCents(15000, 5000)).toBe(7500);
    expect(indemniteSortieMaxCents(0, 5000)).toBe(0);
  });
});

describe("totauxFormule", () => {
  it("achat : lignes multi-taux + automatisations retenues", () => {
    const offre = offreFictive();
    const t = totauxFormule(offre, "achat", ["auto1"]);
    expect(t.totalHtCents).toBe(100000 + 20000 + 5000);
    expect(t.ventilation.length).toBe(2);
  });
  it("abonnement : mise en service seulement", () => {
    expect(totauxFormule(offreFictive(), "abonnement", []).totalHtCents).toBe(30000);
  });
});

describe("hachages", () => {
  it("sha256Offre est indépendant de l'ordre des clés", () => {
    const o = offreFictive();
    const permutee = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(o).reverse())));
    expect(sha256Offre(permutee)).toBe(sha256Offre(o));
    expect(sha256Offre(o)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("sha256Offre change si un montant change", () => {
    const o = offreFictive();
    const o2 = { ...o, garantie: { jours: 31 } };
    expect(sha256Offre(o2)).not.toBe(sha256Offre(o));
  });
  it("choix canonique : codes triés, hachage stable", () => {
    const c1 = choixCanonique({
      devisNumero: "N-1",
      offreSha256: "x",
      formule: "achat",
      automatisationsRetenues: ["b", "a"],
      maintenanceRetenue: true,
      periodiciteMois: 1,
    });
    expect(c1.automatisationsRetenues).toEqual(["a", "b"]);
    expect(c1.v).toBe(1);
    expect(sha256Choix(c1)).toMatch(/^[0-9a-f]{64}$/);
  });
});
