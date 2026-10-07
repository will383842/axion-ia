// @req REQ-EXT-022
// @req REQ-DM-015
// @req REQ-DM-014
/**
 * INT-T53-A — la conférence reçoit sa commission au forfait (décision de Williams du 2026-10-01,
 * 12:36:59Z : « 500 pour une conference »), et l'intervention sur demande reste sans barème (« plus
 * tard car je ne le sais pas encore »).
 *
 * Un palier a SOIT un `commissionId` qui mène à un taux, SOIT une ligne de `BAREMES_INDEFINIS` —
 * jamais les deux, jamais aucun (garde de la grille). Et la surface publique des forfaits de
 * formation n'affiche PAS la conférence comme une formation : elle en est exclue explicitement.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  BAREMES_INDEFINIS,
  COMMERCIAL_COMMISSIONS,
  COMMISSION_CONFERENCE_EUR,
  COMMISSIONS_DE_FORMATION,
  INTERVENTION_TIERS,
  getCommissionById,
  getTierById,
} from "./pricing";
import { verifierCoherenceGrille } from "@/server/partners-sync/grille/export";

describe("REQ-EXT-022 — la conférence est commissionnée au forfait", () => {
  it("REQ-EXT-022 : TÉMOIN — le palier « intervention-conference » porte une commission flat, du montant décidé", () => {
    const palier = getTierById(INTERVENTION_TIERS, "intervention-conference");
    expect(palier.commissionId).toBeDefined();
    const commission = getCommissionById(palier.commissionId!);
    expect(commission.kind).toBe("flat");
    expect(commission.flatEur).toBe(COMMISSION_CONFERENCE_EUR);
    expect(commission.percent).toBeUndefined();
    expect(Number.isInteger(COMMISSION_CONFERENCE_EUR) && COMMISSION_CONFERENCE_EUR > 0).toBe(true);
  });

  it("REQ-DM-014 : TÉMOIN — la conférence SORT des barèmes indéfinis ; l'intervention sur demande y RESTE, sans commission", () => {
    const indefinis = BAREMES_INDEFINIS.map((b) => b.tierId);
    expect(indefinis).not.toContain("intervention-conference");
    const surDemande = BAREMES_INDEFINIS.find((b) => b.tierId === "intervention-sur-demande");
    expect(surDemande?.motif).toBe("hors_perimetre_w6");
    expect(
      getTierById(INTERVENTION_TIERS, "intervention-sur-demande").commissionId,
    ).toBeUndefined();
  });

  it("REQ-DM-014 : la grille reste cohérente : chaque palier a SOIT un taux, SOIT une ligne d'indéfini", () => {
    expect(verifierCoherenceGrille()).toEqual([]);
  });

  it("REQ-DM-015 : la commission de la conférence n'est PAS une commission de formation : elle n'entre pas dans le taux unique à la journée", () => {
    const conference = COMMERCIAL_COMMISSIONS.find(
      (c) => c.id === getTierById(INTERVENTION_TIERS, "intervention-conference").commissionId,
    );
    expect(conference?.id.startsWith("com-formation-")).toBe(false);
    expect(COMMISSIONS_DE_FORMATION.map((c) => c.id)).not.toContain(conference?.id);
    for (const c of COMMISSIONS_DE_FORMATION) expect(c.id.startsWith("com-formation-")).toBe(true);
  });
});

describe("REQ-EXT-022 — la surface publique des forfaits de formation n'affiche pas la conférence", () => {
  it("REQ-EXT-022 : TÉMOIN — les cartes « Formations IA » lisent COMMISSIONS_DE_FORMATION, jamais toutes les commissions flat", () => {
    const source = readFileSync(
      "src/components/services/devenir-commercial/CommercialProductsEarnings.tsx",
      "utf8",
    );
    expect(source).toMatch(/\bCOMMISSIONS_DE_FORMATION\b/);
    expect(source).not.toMatch(
      /COMMERCIAL_COMMISSIONS\.filter\(\s*\(c\)\s*=>\s*c\.kind\s*===\s*"flat"\s*\)/,
    );
  });
});
