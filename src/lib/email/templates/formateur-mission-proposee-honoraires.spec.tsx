/**
 * F23 — la variante CHIFFRÉE (lot L11b-ux) ne part que si on la demande ;
 * sans elle, l'e-mail de proposition est celui d'avant.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { TEXTE_F23_HONORAIRES } from "./formateur-independant-textes";
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

  // M24 (lot A) — la variante chiffrée sur le gabarit commun des formateurs.
  describe("variante « honoraires » au ton des formateurs (M24)", () => {
    const CHIFFREE = {
      ...PAYLOAD,
      prenom: "Camille",
      variante: "honoraires",
      lignesJours: ["mardi 4 novembre · matin et après-midi", "mercredi 5 novembre · matin"],
      lieuMission: "12 rue Exemple, 69003 Lyon",
      ligneHonoraires: "1,5 journée × 350 € HT = 525 € HT",
      ligneDeplacement: "forfait de 80 € HT par journée de déplacement",
    };
    const FAITS = [
      "IA pour managers",
      "mardi 4 novembre · matin et après-midi ; mercredi 5 novembre · matin",
      "12 rue Exemple, 69003 Lyon",
      "1,5 journée × 350 € HT = 525 € HT",
      "forfait de 80 € HT par journée de déplacement",
      "mardi 14 octobre 2026",
      "Vous êtes libre d'accepter ou de refuser, sans aucune conséquence.",
      "la proposition sera faite à quelqu'un d'autre",
    ];

    it("1er envoi : « Bonjour Prénom, », signature habituelle, le corps ne répète pas le titre", async () => {
      const r = await renderEmailTemplate("formateur-mission-proposee", "fr", CHIFFREE);
      expect(r.subject).toBe("Proposition de mission : IA pour managers");
      expect(r.text).toContain("Bonjour Camille,");
      expect(r.text).toContain("Williams Jullin");
      expect(r.text).toContain("Voir et répondre");
      expect(r.text).not.toContain("Nous vous proposons une mission.");
      for (const f of FAITS) expect(r.text).toContain(f);
      expect(r.text.indexOf("Honoraires")).toBeLessThan(r.text.indexOf("Voir et répondre"));
    });

    it("sans prénom : « Bonjour, »", async () => {
      const { prenom: _p, ...sansPrenom } = CHIFFREE;
      const r = await renderEmailTemplate("formateur-mission-proposee", "fr", sansPrenom);
      expect(r.text).toContain("Bonjour,");
    });

    it("relance : objet sans « Relance », corps différent du 1er envoi, AUCUN fait changé", async () => {
      const premier = await renderEmailTemplate("formateur-mission-proposee", "fr", CHIFFREE);
      const r = await renderEmailTemplate("formateur-mission-proposee", "fr", {
        ...CHIFFREE,
        relance: true,
      });
      expect(r.subject).not.toMatch(/relance/i);
      expect(r.subject).not.toBe(premier.subject);
      expect(r.subject).toContain("IA pour managers");
      expect(r.text).toContain("Bonjour Camille,");
      expect(r.text).toContain("Voir et répondre");
      for (const f of FAITS) expect(r.text).toContain(f);
      const corps = (t: string) => t.slice(t.indexOf("Bonjour"), t.indexOf("Voir et répondre"));
      expect(corps(r.text)).not.toBe(corps(premier.text));
      expect(TEXTE_F23_HONORAIRES.rappel.paragraphes[0]).not.toBe(
        TEXTE_F23_HONORAIRES.envoi.paragraphes[0],
      );
    });

    it("l'envoi joint le prénom à la variante chiffrée seulement (texte de base inchangé)", () => {
      const src = readFileSync(
        join(process.cwd(), "src/server/qualiopi/trainers/mission-formateur.ts"),
        "utf8",
      );
      expect(src).toContain(
        "...(chiffree !== null ? { ...chiffree, prenom: trainer.prenom } : {})",
      );
    });

    it("les textes vivent dans formateur-independant-textes.ts, sans mot interdit", () => {
      const tout = JSON.stringify(TEXTE_F23_HONORAIRES);
      for (const interdit of [
        /\bposte\b/i,
        /entretien/i,
        /recrutement/i,
        /salaire/i,
        /rémunération/i,
        /bienvenue/i,
        /vous devez/i,
        /obligatoire/i,
        /agent commercial/i,
        /Grenoble/i,
        /expert-comptable/i,
        /Aucun gain garanti/i,
        /relance/i,
      ]) {
        expect(tout).not.toMatch(interdit);
      }
    });
  });
});
