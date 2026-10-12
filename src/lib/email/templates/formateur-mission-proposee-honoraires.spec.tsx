/**
 * F23 — la variante CHIFFRÉE (lot L11b-ux) ne part que si on la demande ;
 * sans elle, l'e-mail de proposition est celui d'avant.
 */

import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "./index";

const PAYLOAD = {
  formateurPrenomNom: "Camille Dupont",
  titreFormation: "IA pour managers",
  numeroSession: "AXI-SESS-2026-042",
  dateDebut: "4 novembre 2026",
  dateFin: "7 novembre 2026",
  modalite: "Présentiel",
  lieu: "Lyon",
  effectif: "8 stagiaires",
  roleLibelle: "formateur principal",
  lienReponse: "https://axion-ia.com/fr/espace-formateur/mission/jeton",
  dateLimiteReponse: "mardi 14 octobre 2026",
};

describe("formateur-mission-proposee", () => {
  it("sans variante : le texte d'avant, aucun montant", async () => {
    const r = await renderEmailTemplate("formateur-mission-proposee", "fr", PAYLOAD);
    expect(r.subject).toBe("Mission proposée — IA pour managers");
    expect(r.text).not.toContain("Honoraires");
    expect(r.text).toContain("Répondre à la proposition");
  });

  it("variante « honoraires » : le montant, le déplacement et la date limite AVANT le bouton", async () => {
    const r = await renderEmailTemplate("formateur-mission-proposee", "fr", {
      ...PAYLOAD,
      variante: "honoraires",
      lignesJours: ["mardi 4 novembre · matin et après-midi"],
      lieuMission: "12 rue Exemple, 69003 Lyon",
      ligneHonoraires: "1 journée × 350 € HT = 350 € HT",
      ligneDeplacement: "compris",
    });
    expect(r.subject).toBe("Proposition de mission : IA pour managers");
    expect(r.text).toContain("Honoraires");
    expect(r.text).toContain("350 € HT");
    expect(r.text).toContain("Vous êtes libre d'accepter ou de refuser, sans aucune conséquence.");
    expect(r.text).toContain("Voir et répondre");
    expect(r.text.indexOf("Honoraires")).toBeLessThan(r.text.indexOf("Voir et répondre"));
    for (const interdit of [
      /rémunération/i,
      /salaire/i,
      /obligatoire/i,
      /vous devez/i,
      /répondre vite/i,
    ]) {
      expect(r.text).not.toMatch(interdit);
    }
  });
});
