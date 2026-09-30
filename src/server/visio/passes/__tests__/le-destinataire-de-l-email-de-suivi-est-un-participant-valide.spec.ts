/**
 * ⛔ LE DESTINATAIRE DE L'E-MAIL DE SUIVI EST UN PARTICIPANT VALIDÉ (PR 7).
 *
 * L'adresse n'est JAMAIS écrite par l'IA : c'est celle de la fiche d'une
 * personne qui a PARTICIPÉ au rendez-vous côté client, active, rattachée à la
 * fiche (professionnelle de préférence). L'étape `email_suivi` le revérifie :
 * un destinataire hors de la rencontre arrête l'étape SANS appeler OpenAI.
 *
 * Mutation qui rougit : retirer `destinataireValide` de l'étape (ou du geste).
 * Contre-témoin : la participante cliente active passe, adresse pro choisie.
 * Angle mort : une personne présente mais non rattachée à un contact (invité
 * non identifié) ne peut pas recevoir l'e-mail : Will la rattache d'abord.
 */

import { describe, expect, it, vi } from "vitest";

import { adresseDEnvoi, destinataireValide } from "../email-suivi";
import { emailSuivi, type DonneesEmail } from "../etapes-a-la-demande";
import type { ContexteEtape } from "../../etapes";

const participants = [
  { contactId: "c-client", role: "client", contactActif: true },
  { contactId: "c-williams", role: "axion", contactActif: true },
  { contactId: "c-parti", role: "client", contactActif: false },
];

describe("⛔ le destinataire de l'e-mail de suivi est un participant validé", () => {
  it("participant client actif : oui ; hors rencontre, côté Axion ou parti : non", () => {
    expect(destinataireValide("c-client", participants)).toBe(true);
    expect(destinataireValide("c-inconnu", participants)).toBe(false);
    expect(destinataireValide("c-williams", participants)).toBe(false);
    expect(destinataireValide("c-parti", participants)).toBe(false);
  });

  it("l'adresse professionnelle est préférée", () => {
    expect(
      adresseDEnvoi([
        { email: "perso@exemple.invalid", nature: "perso" },
        { email: "pro@exemple.invalid", nature: "pro" },
      ]),
    ).toBe("pro@exemple.invalid");
    expect(adresseDEnvoi([])).toBeNull();
  });

  it("l'étape s'arrête sans appeler OpenAI si le destinataire n'est pas un participant", async () => {
    const repondre = vi.fn();
    const donnees: DonneesEmail = {
      emailSuiviId: "e",
      clientId: "cl",
      rencontre: { titre: "RDV fictif", date: null },
      contact: {
        id: "c-inconnu",
        nom: "Inconnu",
        origine: "saisie",
        adresses: [{ email: "x@exemple.invalid", nature: "pro" }],
      },
      participants,
      faits: [
        { id: "f", type: "engagement_axion", enonce: "Envoyer le programme", statut: "valide" },
      ],
      premierMessage: true,
    };
    const ctx = {
      t: { rencontreId: "r" },
      jobId: "visio-email_suivi-r-1",
      deps: {
        openai: () => ({ repondre, transcrire: vi.fn() }),
        cout: { verifierPlafond: vi.fn(), enregistrer: vi.fn() },
        catalogue: async () => ({ texte: "", refs: new Set(), empreinte: "x" }),
        demandes: {
          depot: { pourEmail: async () => donnees },
          envoi: { mettreEnValidation: vi.fn() },
          mode: () => "ouvert",
        },
      },
    } as unknown as ContexteEtape;
    await expect(emailSuivi(ctx)).rejects.toMatchObject({ name: "ArretVisio" });
    expect(repondre).not.toHaveBeenCalled();
  });
});
