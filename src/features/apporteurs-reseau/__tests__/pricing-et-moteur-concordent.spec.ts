// pricing.ts (ce que le site et Partners publient) et regles.ts (ce que le moteur PAIE, aligné
// sur le contrat) disent la MÊME chose (décision de Will, 2026-10-07 : « aligne tout sur le
// contrat pour les commissions »). Avant, le 1-to-1 était « sur barème » côté pricing.ts et à
// 30 % côté moteur et contrat ; la demi-journée n'avait aucune commission côté pricing.ts.
// Toute divergence future rougit ici.
import { describe, expect, it } from "vitest";

import {
  FORMATION_PRICE_MATRIX,
  getCommissionById,
  INTERVENTION_TIERS,
  UN_A_UN_RECURRING_TIER,
  UN_A_UN_TIERS,
  type FormationCategorie,
  type FormationDuree,
} from "@/content/pricing";
import { resoudreCommission } from "@/server/partners/commission";
import { FORFAIT_CONFERENCE_CENTS, PALIERS_FORMATION, TAUX_BPS } from "../regles";

const COMMISSION_PAR_DUREE: Record<string, string> = {
  "4h": "com-formation-4h",
  "1j": "com-formation-1j",
  "2j": "com-formation-2j",
};

describe("pricing.ts ↔ moteur de calcul (regles.ts)", () => {
  it("les taux : audit, implémentation, 1-to-1", () => {
    expect((getCommissionById("com-audit").percent ?? 0) * 100).toBe(TAUX_BPS.audit);
    expect((getCommissionById("com-integration").percent ?? 0) * 100).toBe(TAUX_BPS.implementation);
    expect(getCommissionById("com-un-a-un").kind).toBe("percent");
    expect((getCommissionById("com-un-a-un").percent ?? 0) * 100).toBe(TAUX_BPS.un_a_un);
  });

  it("chaque palier de formation : même prix public et même forfait des deux côtés", () => {
    for (const p of PALIERS_FORMATION) {
      const [, categorie, duree] = /^formation-(generale|metier|secteur)-(4h|1j|2j)$/.exec(p.id)!;
      expect(FORMATION_PRICE_MATRIX[categorie as FormationCategorie][duree as FormationDuree]).toBe(
        p.prixCents / 100,
      );
      expect(getCommissionById(COMMISSION_PAR_DUREE[duree!]!).flatEur).toBe(p.forfaitCents / 100);
    }
  });

  it("la conférence", () => {
    expect(getCommissionById("com-conference").flatEur).toBe(FORFAIT_CONFERENCE_CENTS / 100);
  });

  it("les paliers 1-to-1 (dont le coaching) et la demi-journée pointent vers leur commission", () => {
    for (const t of [...UN_A_UN_TIERS, UN_A_UN_RECURRING_TIER]) {
      expect(t.commissionId, t.id).toBe("com-un-a-un");
    }
    expect(INTERVENTION_TIERS.find((t) => t.id === "intervention-4h")?.commissionId).toBe(
      "com-formation-4h",
    );
  });

  // Partners reçoit le montant de `resoudreCommission` : il doit être celui du moteur.
  it("Partners (resoudreCommission) calcule comme le moteur : 500 € × journées, pourcentages à l'inférieur", () => {
    const forfaitJour = PALIERS_FORMATION.find(
      (p) => p.id === "formation-generale-1j",
    )!.forfaitCents;
    for (const jours of [0.5, 1, 2, 3, 5]) {
      const r = resoudreCommission({ activite: "formation", jours, montantHtCents: 1 });
      expect(r.statut, `${jours} j`).toBe("calculee");
      expect(r.montantCents, `${jours} j`).toBe(forfaitJour * jours);
    }
    for (const [activite, bps] of [
      ["un_a_un", TAUX_BPS.un_a_un],
      ["audit", TAUX_BPS.audit],
      ["implementation", TAUX_BPS.implementation],
    ] as const) {
      const ht = 333_333;
      expect(resoudreCommission({ activite, jours: null, montantHtCents: ht }).montantCents).toBe(
        Math.floor((ht * bps) / 10_000),
      );
    }
  });
});
