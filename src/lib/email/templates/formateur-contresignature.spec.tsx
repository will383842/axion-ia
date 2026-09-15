/**
 * La demande de contresignature au formateur — ce que l'e-mail DOIT dire.
 *
 * Trois choses, et aucune n'est décorative :
 *  · QUELLES demi-journées attendent sa signature — un « pensez à contresigner »
 *    sans date renvoie chercher dans l'espace ce que le message savait déjà ;
 *  · l'accès DIRECT au geste — la page de la formation, à l'ancre du bloc
 *    d'émargement, derrière sa connexion ;
 *  · que c'est une demande de SA signature, que personne ne pose à sa place.
 */

import { describe, it, expect } from "vitest";
import { renderEmailTemplate } from "./index";
import { estEmailQualiopiAutomatique, libelleTemplateEmail } from "@/server/email/outbox-policy";

const PAYLOAD = {
  formateurPrenomNom: "Camille Dupont",
  titreFormation: "IA pour bien commencer",
  numeroSession: "AXI-SESS-2026-042",
  demiJournees: ["mercredi 16 septembre 2026 — matin", "mercredi 16 septembre 2026 — après-midi"],
  lienEspace: "https://axion-ia.com/fr/espace-formateur/sessions/abc#emargement",
  rangRappel: 0,
  dernierRappel: false,
};

describe("formateur-contresignature", () => {
  it("nomme chaque demi-journée et mène droit au geste", async () => {
    const r = await renderEmailTemplate("formateur-contresignature", "fr", PAYLOAD);
    expect(r.text).toContain("mercredi 16 septembre 2026 — matin");
    expect(r.text).toContain("mercredi 16 septembre 2026 — après-midi");
    expect(r.html).toContain("/fr/espace-formateur/sessions/abc#emargement");
    expect(r.subject).toMatch(/contresign/i);
    expect(r.text).toMatch(/personne ne peut (la )?signer à votre place/i);
  });

  it("un RAPPEL se dit rappel, et le dernier se dit dernier", async () => {
    const rappel = await renderEmailTemplate("formateur-contresignature", "fr", {
      ...PAYLOAD,
      rangRappel: 1,
    });
    expect(rappel.subject).toMatch(/rappel/i);
    const dernier = await renderEmailTemplate("formateur-contresignature", "fr", {
      ...PAYLOAD,
      rangRappel: 2,
      dernierRappel: true,
    });
    expect(dernier.text).toMatch(/dernier rappel/i);
  });

  it("part seule : une demande retenue en validation n'atteint personne", () => {
    expect(estEmailQualiopiAutomatique("formateur-contresignature")).toBe(true);
    expect(libelleTemplateEmail("formateur-contresignature")).not.toMatch(/«/);
  });
});
