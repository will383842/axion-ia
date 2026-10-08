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
    // Pour chaque palier du moteur : même montant au prix public, et même prorata de remise
    // (art. 4.1 bis) — jamais un forfait plein pour une facture d'un centime.
    for (const p of PALIERS_FORMATION) {
      const jours = p.id.endsWith("4h") ? 0.5 : p.id.endsWith("2j") ? 2 : 1;
      for (const ht of [1, Math.floor(p.prixCents * 0.8), p.prixCents, p.prixCents * 2]) {
        const moteur =
          ht >= p.prixCents ? p.forfaitCents : Math.floor((p.forfaitCents * ht) / p.prixCents);
        const r = resoudreCommission({
          activite: "formation",
          jours,
          montantHtCents: ht,
          prixReferenceHtCents: p.prixCents,
        });
        expect(r.montantCents, `${p.id} à ${ht}`).toBe(moteur);
      }
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
