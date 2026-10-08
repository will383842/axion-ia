// Point 3 de la vérification finale de a1 (2026-10-08 ; contrat 2.3, art. 3.2 et 3.4) :
//   · l'apporteur reçoit un e-mail quand son attribution devient définitive ou que sa protection
//     est prolongée — une seule fois par événement ;
//   · une déclaration jamais contactée est réputée confirmée 30 + 30 jours après sa réception ;
//   · après 15 jours sans réponse, l'apporteur voit « En attente d'une réponse », sans délai
//     présenté comme contractuel.
import { render } from "@react-email/render";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  presentation: null as Record<string, unknown> | null,
  deja: false,
  envoyer: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { presentationEntreprise: { findUnique: vi.fn(async () => h.presentation) } },
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("../commissions", () => ({ dejaEnvoye: vi.fn(async () => h.deja) }));
vi.mock("../envois", () => ({ envoyer: (...a: unknown[]) => h.envoyer(...a) }));

import {
  ApporteurAttributionConfirmeeEmail,
  apporteurAttributionConfirmeeSubject,
} from "@/lib/email/templates/apporteur-attribution-confirmee";

import { annoncerAttribution, jobIdAnnonceAttribution } from "../attribution-annonce";
import { etatPourApporteur, LIBELLE_ETAT_DECLARATION } from "../declaration-regles";
import { dateConfirmationTaciteSansContact, RAPPEL_SANS_REPONSE_JOURS } from "../regles";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const JOUR = 86_400_000;

describe("l'e-mail « attribution confirmée / protection prolongée »", () => {
  const rendu = (payload: Record<string, unknown>) =>
    render(React.createElement(ApporteurAttributionConfirmeeEmail, { locale: "fr", payload }));

  it("confirmée : objet, entreprise, date en clair, rien de promis sur la commission", async () => {
    const p = { contactName: "Ana Bel", entreprise: "Danone", finProtection: "8 avril 2027" };
    expect(apporteurAttributionConfirmeeSubject("fr", p)).toBe("Danone vous est attribuée");
    const html = await rendu(p);
    expect(html).toContain("Bonjour Ana,");
    expect(html).toContain("Danone est désormais définitive");
    expect(html).toContain("Fin de la protection : 8 avril 2027.");
    expect(html).toContain("ne fait naître aucune commission par elle-même");
    expect(html).not.toMatch(/jusqu['’]/);
  });

  it("prolongée : objet dédié et motif en clair", async () => {
    const p = {
      entreprise: "Danone",
      finProtection: "8 juillet 2027",
      variante: "prolongee",
      motif: "devis_en_cours",
    };
    expect(apporteurAttributionConfirmeeSubject("fr", p)).toBe("Danone : protection prolongée");
    const html = await rendu(p);
    expect(html).toContain("Un devis est en cours avec elle");
    expect(html).toContain("prolongée une fois, de trois mois");
    expect(html).not.toMatch(/jusqu['’]/);
  });
});

describe("annoncerAttribution : une fois par événement, jamais pour un état inattendu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.deja = false;
    h.envoyer.mockResolvedValue("envoye");
    h.presentation = {
      id: ID,
      statut: "confirmee",
      denomination: "Danone",
      protegeeJusquAt: new Date("2027-04-08T10:00:00Z"),
      motifProlongation: null,
      apporteur: { prenom: "Ana", nom: "Bel", email: "ana@exemple.fr" },
    };
  });

  it("confirmée : part avec la clé « une fois » et la date de fin", async () => {
    expect(await annoncerAttribution(ID, "confirmee")).toBe(true);
    const e = h.envoyer.mock.calls[0]![0] as Record<string, unknown>;
    expect(e).toMatchObject({
      gabarit: "apporteur-attribution-confirmee",
      destinataire: "ana@exemple.fr",
      jobId: jobIdAnnonceAttribution(ID, "confirmee"),
      payload: { entreprise: "Danone", finProtection: "8 avril 2027", variante: "confirmee" },
    });
  });

  it("déjà partie : rien n'est renvoyé", async () => {
    h.deja = true;
    expect(await annoncerAttribution(ID, "confirmee")).toBe(false);
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("présentation non confirmée : rien ne part", async () => {
    h.presentation = { ...h.presentation!, statut: "reservee" };
    expect(await annoncerAttribution(ID, "confirmee")).toBe(false);
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("un échec d'envoi ne lève jamais (la confirmation reste acquise)", async () => {
    h.envoyer.mockRejectedValue(new Error("file indisponible"));
    await expect(annoncerAttribution(ID, "prolongee")).resolves.toBe(false);
  });
});

describe("art. 3.2 — déclaration jamais contactée", () => {
  it("réputée confirmée 30 + 30 jours après sa réception", () => {
    const recue = new Date("2026-10-01T09:00:00Z");
    expect(dateConfirmationTaciteSansContact(recue).getTime()).toBe(recue.getTime() + 60 * JOUR);
  });
});

describe("« En attente d'une réponse » côté apporteur (délai de gestion, pas du contrat)", () => {
  const recue = new Date("2026-10-01T09:00:00Z");
  const ligne = {
    statut: "reservee",
    contactEnvoyeAt: null,
    recueAt: recue,
    protegeeJusquAt: null,
  };

  it("avant 15 jours : « À l'étude »", () => {
    const avant = new Date(recue.getTime() + (RAPPEL_SANS_REPONSE_JOURS - 1) * JOUR);
    expect(etatPourApporteur(ligne, avant)?.etat).toBe("a_l_etude");
  });

  it("à 15 jours : « En attente d'une réponse — nous revenons vers vous »", () => {
    const apres = new Date(recue.getTime() + RAPPEL_SANS_REPONSE_JOURS * JOUR);
    expect(etatPourApporteur(ligne, apres)?.etat).toBe("sans_reponse");
    expect(LIBELLE_ETAT_DECLARATION.sans_reponse).toBe(
      "En attente d'une réponse — nous revenons vers vous",
    );
  });

  it("le libellé ne cite aucun délai (ce n'est pas un délai du contrat)", () => {
    expect(LIBELLE_ETAT_DECLARATION.sans_reponse).not.toMatch(/\d|jour/);
  });
});
