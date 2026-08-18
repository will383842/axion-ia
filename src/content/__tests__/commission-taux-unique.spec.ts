/**
 * Garde-fou « un seul taux à la journée » — décision Will 2026-08-18 :
 * « tout mettre à 500 et pas différents tarifs ».
 *
 * ── Ce que ce test aurait attrapé ──────────────────────────────────────────
 * Jusqu'au 2026-08-18 le barème public portait 350 € (1 j), 800 € (2 j) et
 * 1 350 € (3 j+) : lus à la journée, ce sont 350, 400 puis 450 € — trois taux
 * différents pour le même travail. Au même moment `/memo-isere` annonçait
 * 500 €/journée depuis sa PROPRE constante. Les deux barèmes étaient publics
 * en même temps, sur deux pages du même tunnel de recrutement, et rien ne
 * pouvait le signaler : aucun test ne lisait `COMMERCIAL_COMMISSIONS`.
 *
 * ── Ce qu'il exige ─────────────────────────────────────────────────────────
 * Toute commission de formation vaut `COMMISSION_FORMATION_PAR_JOURNEE_EUR`
 * × son nombre de journées. Réécrire un montant à la main (ou rétablir un
 * tarif dégressif/progressif au format) fait ROUGIR ce fichier.
 *
 * Il ne fige PAS la valeur 500 : Will peut la changer d'une ligne dans
 * `pricing.ts`, tout suit. Ce qui est figé, c'est qu'il n'y en ait qu'UNE.
 */
import { describe, it, expect } from "vitest";
import {
  COMMERCIAL_COMMISSIONS,
  COMMISSION_FORMATION_PAR_JOURNEE_EUR,
  commissionFormation,
} from "@/content/pricing";

/**
 * Nombre de journées facturées par format, lu depuis l'id de la commission.
 * `com-formation-3j` est un palier ouvert (« 3 jours et + ») : le montant
 * affiché est celui du plancher, 3 journées.
 */
const JOURNEES_PAR_ID: Readonly<Record<string, number>> = {
  "com-formation-1j": 1,
  "com-formation-2j": 2,
  "com-formation-3j": 3,
};

describe("Commission commerciale — un seul taux à la journée", () => {
  it("expose un taux à la journée strictement positif", () => {
    expect(COMMISSION_FORMATION_PAR_JOURNEE_EUR).toBeGreaterThan(0);
    expect(Number.isInteger(COMMISSION_FORMATION_PAR_JOURNEE_EUR)).toBe(true);
  });

  it("multiplie le taux par le nombre de journées, sans arrondi ni palier", () => {
    for (const jours of [1, 2, 3, 5, 10]) {
      expect(commissionFormation(jours)).toBe(jours * COMMISSION_FORMATION_PAR_JOURNEE_EUR);
    }
  });

  it("couvre toutes les commissions de formation du barème public", () => {
    const idsFormation = COMMERCIAL_COMMISSIONS.filter((c) =>
      c.id.startsWith("com-formation-"),
    ).map((c) => c.id);
    // Si un format est ajouté à pricing.ts sans être décrit ici, le test
    // suivant ne le verrait pas passer — donc on exige la couverture d'abord.
    expect([...idsFormation].sort()).toEqual(Object.keys(JOURNEES_PAR_ID).sort());
  });

  it("applique le MÊME taux à la journée à tous les formats", () => {
    for (const commission of COMMERCIAL_COMMISSIONS) {
      const jours = JOURNEES_PAR_ID[commission.id];
      if (jours == null) continue;

      expect(commission.kind, commission.id).toBe("flat");
      expect(commission.flatEur, commission.id).toBe(commissionFormation(jours));

      // Formulation redondante VOULUE : c'est le taux à la journée qui doit
      // être identique partout, pas seulement le total qui doit tomber juste.
      const tauxJournalier = (commission.flatEur ?? 0) / jours;
      expect(tauxJournalier, `${commission.id} : ${tauxJournalier} €/journée`).toBe(
        COMMISSION_FORMATION_PAR_JOURNEE_EUR,
      );
    }
  });

  it("ne laisse aucune commission de formation sur devis ou en pourcentage", () => {
    for (const id of Object.keys(JOURNEES_PAR_ID)) {
      const commission = COMMERCIAL_COMMISSIONS.find((c) => c.id === id);
      expect(commission, id).toBeDefined();
      expect(commission?.percent, id).toBeUndefined();
      expect(commission?.flatEur, id).toBeTypeOf("number");
    }
  });
});
