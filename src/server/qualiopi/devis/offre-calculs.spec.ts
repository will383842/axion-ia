import { describe, expect, it } from "vitest";

import {
  choixCanonique,
  debutMaintenance,
  echeancierPhases,
  indemniteSortieMaxCents,
  nbMaxFactures,
  prixMensuelNet,
  prixPeriode,
  sha256Choix,
  sha256Offre,
  totauxFormule,
} from "./offre-calculs";
import { empreinteCanonique, versValeurJson } from "../../mcp/json-canonique";
import { offreFictive } from "./offre-fixtures.spec-util";
import { offreDevisV1 } from "./offre-devis";

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

describe("corrections audit (a)(d)", () => {
  it("indemniteSortieMaxCents refuse un taux hors [0, 10000] ou non entier", () => {
    expect(() => indemniteSortieMaxCents(1000, 10001)).toThrow(RangeError);
    expect(() => indemniteSortieMaxCents(1000, -1)).toThrow(RangeError);
    expect(() => indemniteSortieMaxCents(1000, 50.5)).toThrow(RangeError);
  });
  it("choixCanonique dédoublonne : [a,a] et [a] => même empreinte", () => {
    const base = {
      devisNumero: "N-1",
      offreSha256: "x",
      formule: "achat" as const,
      maintenanceRetenue: false,
      periodiciteMois: null,
    };
    const c1 = choixCanonique({ ...base, automatisationsRetenues: ["a", "a"] });
    const c2 = choixCanonique({ ...base, automatisationsRetenues: ["a"] });
    expect(c1.automatisationsRetenues).toEqual(["a"]);
    expect(sha256Choix(c1)).toBe(sha256Choix(c2));
  });
});

describe("prixMensuelNet — jamais négatif", () => {
  it("refuse une remise hors [0, 10000] au lieu de rendre un prix négatif", () => {
    expect(prixMensuelNet(9000, 10000)).toBe(0);
    expect(() => prixMensuelNet(9000, 10001)).toThrow(RangeError);
    expect(() => prixMensuelNet(9000, -1)).toThrow(RangeError);
  });
});

describe("hachages — durcissement (audit)", () => {
  it("n'empreinte que la sortie de parse : le défaut modeAvance ne change pas l'empreinte", () => {
    const o = offreFictive();
    const { modeAvance: _m, ...sansMode } = o.abonnement!;
    expect(sha256Offre({ ...o, abonnement: sansMode })).toBe(sha256Offre(o));
  });
  it("refuse d'empreinter une offre invalide", () => {
    expect(() => sha256Offre({ ...offreFictive(), v: 2 })).toThrow();
  });
  it("normalise les textes en NFC avant empreinte", () => {
    const o = offreFictive();
    const nfc = {
      ...o,
      garantie: o.garantie,
      automatisations: [{ ...o.automatisations[0]!, libelle: "Café" }],
    };
    const nfd = { ...nfc, automatisations: [{ ...nfc.automatisations[0]!, libelle: "Café" }] };
    expect(sha256Offre(nfd)).toBe(sha256Offre(nfc));
    const c = (n: string) =>
      choixCanonique({
        devisNumero: n,
        offreSha256: "x",
        formule: "achat",
        automatisationsRetenues: [],
        maintenanceRetenue: false,
        periodiciteMois: null,
      });
    expect(sha256Choix(c("Café"))).toBe(sha256Choix(c("Café")));
  });
  it("un v passé à l'exécution n'écrase pas la version de choixCanonique", () => {
    const c = choixCanonique({
      v: 2,
      devisNumero: "N-1",
      offreSha256: "x",
      formule: "achat",
      automatisationsRetenues: [],
      maintenanceRetenue: false,
      periodiciteMois: null,
    } as never);
    expect(c.v).toBe(1);
  });
  it("même empreinte que json-canonique (empreinteCanonique) sur la sortie de parse", () => {
    const o = offreDevisV1.parse(offreFictive());
    expect(`sha256:${sha256Offre(o)}`).toBe(empreinteCanonique(versValeurJson(o)));
  });
});

describe("relecture du lot 1 — bornes", () => {
  it("prixPeriode refuse des mois négatifs, non entiers ou non finis", () => {
    expect(() => prixPeriode(1000, 0, -1)).toThrow(RangeError);
    expect(() => prixPeriode(1000, 0, 1.5)).toThrow(RangeError);
    expect(() => prixPeriode(1000, 0, Number.NaN)).toThrow(RangeError);
    expect(prixPeriode(1000, 0, 0)).toBe(0);
    expect(prixPeriode(1000, 0, 12)).toBe(12000);
  });
  it("indemniteSortieMaxCents refuse un restant négatif ou non fini", () => {
    expect(() => indemniteSortieMaxCents(-1, 5000)).toThrow(RangeError);
    expect(() => indemniteSortieMaxCents(Number.NaN, 5000)).toThrow(RangeError);
    expect(() => indemniteSortieMaxCents(Number.POSITIVE_INFINITY, 5000)).toThrow(RangeError);
    expect(indemniteSortieMaxCents(0, 5000)).toBe(0);
    expect(indemniteSortieMaxCents(10000, 5000)).toBe(5000);
  });
});

describe("totauxFormule — régime de TVA", () => {
  it("assujetti (défaut) : TVA par groupe de taux saisi", () => {
    const t = totauxFormule(offreFictive(), "achat");
    expect(t.totalHtCents).toBe(120000);
    // 100 000 × 20 % + 20 000 × 25 %
    expect(t.totalTvaCents).toBe(25000);
    expect(t.totalTtcCents).toBe(145000);
  });
  it.each(["franchise_293b", "exoneration_261"] as const)(
    "%s : taux 0 partout, TTC = HT, même si les lignes portent un taux",
    (regime) => {
      const t = totauxFormule(offreFictive(), "achat", ["auto1"], regime);
      expect(t.totalHtCents).toBe(125000);
      expect(t.totalTvaCents).toBe(0);
      expect(t.totalTtcCents).toBe(125000);
      expect(t.ventilation.every((v) => v.tauxPercent === 0)).toBe(true);
    },
  );
});
