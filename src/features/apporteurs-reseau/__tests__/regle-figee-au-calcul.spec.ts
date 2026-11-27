/**
 * Lot R du relevé mensuel : la règle appliquée et la version du contrat sont posées à la CRÉATION de
 * chaque commission (jamais rétroactivement), et AUCUN montant ne change : `calculerCommission` reste
 * la source des montants, `calculerCommissionAvecRegle` n'y ajoute qu'un code de la liste fermée du
 * plan § 5.3.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  calculerCommission,
  calculerCommissionAvecRegle,
  CODES_REGLE_APPLIQUEE,
  versionContratSignee,
} from "../regles";

const AVANT = new Date("2026-11-01T10:00:00.000Z");
const APRES = new Date("2026-12-01T10:00:00.000Z");

type Entree = Parameters<typeof calculerCommission>[0];

const CAS: Array<[string, Entree, string | null]> = [
  [
    "formation au prix public",
    { activite: "formation", palier: "formation-generale-1j", factureHtCents: 190_000 },
    "forfait_palier",
  ],
  [
    "formation remisée",
    { activite: "formation", palier: "formation-generale-1j", factureHtCents: 152_000 },
    "prorata_remise",
  ],
  [
    "formation plusieurs sessions",
    {
      activite: "formation",
      palier: "formation-generale-1j",
      factureHtCents: 380_000,
      quantite: 2,
    },
    "forfait_sessions",
  ],
  [
    "formation sessions remisées",
    {
      activite: "formation",
      palier: "formation-generale-1j",
      factureHtCents: 300_000,
      quantite: 2,
    },
    "prorata_remise",
  ],
  ["audit", { activite: "audit", factureHtCents: 190_000 }, "taux_ht"],
  ["intégration", { activite: "implementation", factureHtCents: 190_000 }, "taux_ht"],
  ["développement web", { activite: "site_web", factureHtCents: 100_000 }, "taux_ht"],
  [
    "conférence avant la date d'effet",
    { activite: "conference", factureHtCents: 80_000, signeeAt: AVANT },
    "tarif_avant_date_effet",
  ],
  [
    "conférence après : aucune",
    { activite: "conference", factureHtCents: 80_000, signeeAt: APRES },
    null,
  ],
  ["un à un : aucune", { activite: "un_a_un", factureHtCents: 80_000 }, null],
  ["à qualifier", { activite: null, factureHtCents: 80_000 }, null],
  [
    "palier inconnu : à qualifier",
    { activite: "formation", palier: "inconnu", factureHtCents: 80_000 },
    null,
  ],
];

describe("lot R — calculerCommissionAvecRegle", () => {
  it.each(CAS)("%s : calcul IDENTIQUE à calculerCommission, code attendu", (_n, e, code) => {
    const ancien = calculerCommission(e);
    const r = calculerCommissionAvecRegle(e);
    // Montants identiques avant/après : l'objet de calcul est exactement celui d'avant.
    expect(r.calcul).toEqual(ancien);
    expect(r.regle).toBe(code);
  });

  it("les codes rendus appartiennent à la liste fermée du plan § 5.3", () => {
    for (const [, e] of CAS) {
      const { regle } = calculerCommissionAvecRegle(e);
      if (regle !== null) expect(CODES_REGLE_APPLIQUEE).toContain(regle);
    }
    expect([...CODES_REGLE_APPLIQUEE].sort()).toEqual(
      [
        "forfait_palier",
        "forfait_sessions",
        "journee_ia",
        "parrainage_10",
        "plafond_base",
        "prorata_remise",
        "tarif_avant_date_effet",
        "taux_ht",
      ].sort(),
    );
    // Réservé, non affiché tant que Q7 n'est pas tranchée.
    expect(CODES_REGLE_APPLIQUEE).not.toContain("formation_3j_plus");
  });

  it("balayage de montants : aucun écart avec calculerCommission", () => {
    for (const activite of ["formation", "audit", "implementation", "site_web"] as const) {
      for (let ht = 0; ht <= 400_000; ht += 7_919) {
        const e: Entree = {
          activite,
          palier: "formation-secteur-2j",
          factureHtCents: ht,
          quantite: 1,
        };
        expect(calculerCommissionAvecRegle(e).calcul).toEqual(calculerCommission(e));
      }
    }
  });
});

describe("lot R — versionContratSignee", () => {
  it("lit la version inscrite dans la signature, sinon null", () => {
    expect(versionContratSignee({ version: "2.6" })).toBe("2.6");
    expect(versionContratSignee({ version: "2.8" })).toBe("2.8");
    expect(versionContratSignee(null)).toBeNull();
    expect(versionContratSignee([])).toBeNull();
    expect(versionContratSignee({})).toBeNull();
    expect(versionContratSignee({ version: 2.8 })).toBeNull();
    expect(versionContratSignee({ version: "n'importe quoi de très long" })).toBeNull();
  });
});

describe("lot R — chaque création de commission pose la règle (source)", () => {
  const lire = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");
  it("passage-quotidien : les créations calculées portent regleAppliquee et versionContrat", () => {
    const s = lire("passage-quotidien.ts");
    expect(s).toMatch(/calculerCommissionSelonGrilleAvecRegle/);
    expect(s).toMatch(/regleAppliquee:/);
    expect(s).toMatch(/versionContrat[:,]/);
    expect(s).toMatch(/parrainage_10/);
  });
  it("reprises, compléments, avoirs : aucun code de règle inventé, aucune écriture rétroactive", () => {
    for (const f of ["avoir-client.ts", "manquement.ts", "resiliation.ts", "facturation.ts"]) {
      expect(lire(f)).toMatch(/regleAppliquee/);
    }
    // Jamais de mise à jour des lignes existantes.
    for (const f of ["passage-quotidien.ts"]) {
      expect(lire(f)).not.toMatch(/updateMany\([^)]*regleAppliquee/s);
    }
  });
});

import { regleApresPlafond } from "../regles";

describe("regleApresPlafond", () => {
  it("taux_ht dont le plafond réduit la base : plafond_base", () => {
    expect(regleApresPlafond("taux_ht", 100_000, 80_000)).toBe("plafond_base");
  });
  it("plafond égal ou supérieur à la base : code d'origine", () => {
    expect(regleApresPlafond("taux_ht", 100_000, 100_000)).toBe("taux_ht");
  });
  it("rien de calculé : null", () => {
    expect(regleApresPlafond(null, 100_000, 80_000)).toBeNull();
  });
  it("un forfait plafonné garde son code (conférence d'avant la date d'effet)", () => {
    expect(regleApresPlafond("tarif_avant_date_effet", 100_000, 80_000)).toBe(
      "tarif_avant_date_effet",
    );
  });
});
