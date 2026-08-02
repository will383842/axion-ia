/**
 * Durée réelle déduite des journées déclarées.
 *
 * 🔴 `TrainingSession.dureeReelleHeures` n'avait aucun écrivain côté collectif :
 * elle restait nulle à vie. Fiche session « — h », certificat de réalisation
 * sans durée, ventilation horaire OPCO refusée pour « durée réelle non
 * renseignée » — alors que les horaires étaient déclarés depuis la création.
 */
import { describe, it, expect } from "vitest";
import {
  heuresEffectivesJournee,
  heuresReellesDepuisJournees,
  horairesProposes,
} from "./jours-defaut";

describe("heuresEffectivesJournee", () => {
  it("retranche la pause méridienne sur une journée pleine", () => {
    // 09:00–17:00 = 8 h d'amplitude, 7 h de formation. C'est le cas de la
    // session INVEST SUN, dont la durée s'affichait « — h ».
    expect(heuresEffectivesJournee("09:00", "17:00")).toBe(7);
  });

  it("ne retranche aucune pause sur une demi-journée", () => {
    expect(heuresEffectivesJournee("09:00", "13:00")).toBe(4);
    expect(heuresEffectivesJournee("14:00", "17:00")).toBe(3);
  });

  it("est l'inverse exact de `horairesProposes`", () => {
    // La proposition et la relecture doivent se répondre, sinon une journée
    // générée automatiquement se relirait avec une durée différente de celle qui
    // l'a produite.
    for (const heures of [3, 3.5, 4, 5, 7, 7.5]) {
      const { heureDebut, heureFin } = horairesProposes(heures);
      expect(heuresEffectivesJournee(heureDebut, heureFin), `${heures} h`).toBe(heures);
    }
  });

  it("rend 0 sur des horaires incohérents plutôt qu'un négatif", () => {
    expect(heuresEffectivesJournee("17:00", "09:00")).toBe(0);
    expect(heuresEffectivesJournee("09:00", "09:00")).toBe(0);
  });
});

describe("heuresReellesDepuisJournees", () => {
  it("somme les journées d'un parcours étalé", () => {
    expect(
      heuresReellesDepuisJournees([
        { heureDebut: "09:00", heureFin: "17:00" },
        { heureDebut: "09:00", heureFin: "17:00" },
        { heureDebut: "09:00", heureFin: "13:00" },
      ]),
    ).toBe(18);
  });

  it("rend null sans journée déclarée, au lieu de zéro", () => {
    // `null` = « on ne sait pas », et l'appelant n'écrit rien. `0` s'écrirait en
    // base et se lirait « formation de zéro heure » sur une attestation.
    expect(heuresReellesDepuisJournees([])).toBeNull();
  });

  it("rend null si toutes les journées sont incohérentes", () => {
    expect(heuresReellesDepuisJournees([{ heureDebut: "17:00", heureFin: "09:00" }])).toBeNull();
  });
});
