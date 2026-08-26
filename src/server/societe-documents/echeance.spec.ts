/**
 * L'état d'échéance se calcule, il ne se stocke pas.
 *
 * Ces tests portent surtout sur les BORNES, parce que c'est là qu'une pièce
 * bascule : le jour de la péremption, le lendemain, et le seuil d'alerte. Un
 * test qui ne vérifierait que « dans six mois c'est à jour » passerait aussi
 * sur une implémentation décalée d'un jour.
 */

import { describe, it, expect } from "vitest";

import { calculerEcheance, libelleEcheance, SEUIL_ALERTE_JOURS } from "./echeance";

const AUJOURD_HUI = new Date("2026-08-26T14:30:00.000Z");

function le(jour: string): Date {
  return new Date(`${jour}T00:00:00.000Z`);
}

describe("calculerEcheance", () => {
  it("une pièce sans date d'expiration n'a pas d'échéance", () => {
    expect(calculerEcheance(null, AUJOURD_HUI)).toEqual({
      etat: "sans_echeance",
      joursRestants: null,
    });
    expect(calculerEcheance(undefined, AUJOURD_HUI).etat).toBe("sans_echeance");
  });

  it("le jour de la péremption, la pièce est encore valide", () => {
    // Une attestation « valable jusqu'au 26 août » l'est le 26 août.
    const e = calculerEcheance(le("2026-08-26"), AUJOURD_HUI);
    expect(e.etat).toBe("bientot");
    expect(e.joursRestants).toBe(0);
  });

  it("le lendemain, elle est périmée", () => {
    const e = calculerEcheance(le("2026-08-25"), AUJOURD_HUI);
    expect(e.etat).toBe("perimee");
    expect(e.joursRestants).toBe(-1);
  });

  it("l'heure du jour ne fait pas basculer l'état", () => {
    // Le calcul compare des JOURS : 00 h 01 et 23 h 59 doivent donner le même
    // verdict, sans quoi une pièce changerait d'état au fil de la journée.
    const matin = calculerEcheance(le("2026-09-25"), new Date("2026-08-26T00:01:00.000Z"));
    const soir = calculerEcheance(le("2026-09-25"), new Date("2026-08-26T23:59:00.000Z"));
    expect(matin).toEqual(soir);
  });

  it("le seuil d'alerte est inclusif, et le jour suivant ne l'est plus", () => {
    const surLeSeuil = new Date(AUJOURD_HUI.getTime() + SEUIL_ALERTE_JOURS * 86_400_000);
    const juste = calculerEcheance(surLeSeuil, AUJOURD_HUI);
    expect(juste.etat).toBe("bientot");
    expect(juste.joursRestants).toBe(SEUIL_ALERTE_JOURS);

    const auDela = new Date(AUJOURD_HUI.getTime() + (SEUIL_ALERTE_JOURS + 1) * 86_400_000);
    expect(calculerEcheance(auDela, AUJOURD_HUI).etat).toBe("a_jour");
  });

  it("le Kbis du 30 juillet est à jour fin août et périme le 30 octobre", () => {
    expect(calculerEcheance(le("2026-10-30"), AUJOURD_HUI).etat).toBe("a_jour");
    expect(calculerEcheance(le("2026-10-30"), new Date("2026-10-31T09:00:00.000Z")).etat).toBe(
      "perimee",
    );
  });
});

describe("libelleEcheance", () => {
  it("le texte porte l'information, jamais la couleur seule", () => {
    expect(libelleEcheance(calculerEcheance(null, AUJOURD_HUI))).toBe("Sans échéance");
    expect(libelleEcheance(calculerEcheance(le("2026-08-26"), AUJOURD_HUI))).toBe(
      "Périme aujourd'hui",
    );
    expect(libelleEcheance(calculerEcheance(le("2026-08-27"), AUJOURD_HUI))).toBe("Périme demain");
    expect(libelleEcheance(calculerEcheance(le("2026-08-25"), AUJOURD_HUI))).toBe(
      "Périmée depuis hier",
    );
    expect(libelleEcheance(calculerEcheance(le("2026-09-05"), AUJOURD_HUI))).toBe(
      "Périme dans 10 jours",
    );
    expect(libelleEcheance(calculerEcheance(le("2027-08-26"), AUJOURD_HUI))).toBe("À jour");
  });
});
