// Lot 7 (plan §4.2, B-1) : le gel ne fait pas dépasser l'échéance en silence. Règles pures.
// D-4 retenue : option B (recommandation du plan) : la ligne reste gelée ; le virement sur l'ancien
// compte n'est possible qu'après un REFUS MOTIVÉ du super_admin, qui lève le gel.
import { describe, expect, it } from "vitest";

import { echeancePaiement } from "../autofacture-donnees";
import { echeanceEnAlerte, etatGelDesLignes, joursRestants } from "../gel-virements-regles";

const J = 86_400_000;
const midi = (iso: string) => new Date(`${iso}T10:00:00Z`);

describe("échéance sous gel", () => {
  const demande = { statut: "confirmee" as const, demandeeAt: midi("2026-12-01") };

  it("autofacture émise à J-27, demande à J0 : alerte immédiate, échéance = émission + 30 jours", () => {
    const j0 = midi("2026-12-01");
    const emission = new Date(j0.getTime() - 27 * J);
    const g = etatGelDesLignes(demande, [{ emissionAt: emission }], j0)!;
    expect(g.plusProcheEcheance.getTime()).toBe(echeancePaiement(emission).getTime());
    expect(joursRestants(g.plusProcheEcheance, j0)).toBe(3);
    expect(g.rouge).toBe(true);
  });

  it("autofacture émise à J-10 : pas d'alerte avant J-5, alerte à J-5", () => {
    const j0 = midi("2026-12-01");
    const emission = new Date(j0.getTime() - 10 * J); // échéance à J+20
    const echeance = echeancePaiement(emission);
    expect(echeanceEnAlerte(echeance, new Date(j0.getTime() + 14 * J))).toBe(false); // 6 jours restants
    expect(echeanceEnAlerte(echeance, new Date(j0.getTime() + 15 * J))).toBe(true); // 5 jours restants
    expect(echeanceEnAlerte(echeance, new Date(j0.getTime() + 16 * J))).toBe(true);
  });

  it("la plus proche échéance est prise parmi plusieurs lignes gelées", () => {
    const j0 = midi("2026-12-01");
    const vieille = new Date(j0.getTime() - 25 * J);
    const recente = new Date(j0.getTime() - 2 * J);
    const g = etatGelDesLignes(demande, [{ emissionAt: recente }, { emissionAt: vieille }], j0)!;
    expect(g.plusProcheEcheance.getTime()).toBe(echeancePaiement(vieille).getTime());
  });

  it("jour de Paris aux bornes : 23 h 30 UTC le 30 décembre est déjà le 31 à Paris", () => {
    const echeance = echeancePaiement(midi("2026-12-06")); // 5 janvier 2027 (Paris)
    const apresMinuitParis = new Date("2026-12-30T23:30:00Z"); // 00 h 30 le 31 à Paris : 5 jours
    const avantMinuitParis = new Date("2026-12-30T22:30:00Z"); // 23 h 30 le 30 à Paris : 6 jours
    expect(joursRestants(echeance, apresMinuitParis)).toBe(5);
    expect(echeanceEnAlerte(echeance, apresMinuitParis)).toBe(true);
    expect(joursRestants(echeance, avantMinuitParis)).toBe(6);
    expect(echeanceEnAlerte(echeance, avantMinuitParis)).toBe(false);
  });

  it("après l'échéance : la ligne reste gelée et rouge (le retard est assumé et tracé), jours négatifs", () => {
    const j0 = midi("2026-12-01");
    const emission = new Date(j0.getTime() - 40 * J);
    const g = etatGelDesLignes(demande, [{ emissionAt: emission }], j0)!;
    expect(g.rouge).toBe(true);
    expect(joursRestants(g.plusProcheEcheance, j0)).toBeLessThan(0);
  });

  it("rend une DATE, jamais un compte à rebours", () => {
    const g = etatGelDesLignes(demande, [{ emissionAt: midi("2026-11-20") }], midi("2026-12-01"))!;
    expect(g.plusProcheEcheance).toBeInstanceOf(Date);
    expect(Object.keys(g)).not.toContain("compteARebours");
  });

  it("aucune ligne : pas d'état", () => {
    expect(etatGelDesLignes(demande, [], midi("2026-12-01"))).toBeNull();
  });
});
