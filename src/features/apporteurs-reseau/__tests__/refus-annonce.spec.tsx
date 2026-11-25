// E-mail « l'entreprise n'a pas pu être retenue » : texte, interrupteur éteint par défaut,
// clé d'idempotence `apporteur-refus-<id>`, un seul envoi.
import { render } from "@react-email/render";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  presentation: null as Record<string, unknown> | null,
  deja: false,
  envoyer: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { presentationEntreprise: { findUnique: vi.fn(async () => h.presentation) } },
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));
vi.mock("../commissions", () => ({ dejaEnvoye: vi.fn(async () => h.deja) }));
vi.mock("../envois", () => ({ envoyer: (...a: unknown[]) => h.envoyer(...a) }));

import {
  ApporteurPresentationNonRetenueEmail,
  COPY_NON_RETENUE,
  apporteurPresentationNonRetenueSubject,
} from "@/lib/email/templates/apporteur-presentation-non-retenue";

import { annoncerRefus } from "../refus-annonce";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

describe("le texte de l'e-mail de refus", () => {
  const rendu = (payload: Record<string, unknown>) =>
    render(React.createElement(ApporteurPresentationNonRetenueEmail, { locale: "fr", payload }));

  it.each(["deja-connue", "hors-champ", "non-confirmee"])(
    "motif %s : factuel, sans contrôle de l'apporteur, sans relance ni promesse",
    async (motif) => {
      const p = { contactName: "Ana Bel", entreprise: "Danone", motif };
      expect(apporteurPresentationNonRetenueSubject("fr", p)).toBe(
        "Danone : présentation non retenue",
      );
      const html = await rendu(p);
      expect(html).toContain("Bonjour Ana,");
      expect(html).toContain("Danone n&#x27;a pas pu être retenue");
      const mots = JSON.stringify(COPY_NON_RETENUE);
      expect(mots).not.toMatch(/vérifi|contrôl|relanc|objectif|gain|Grenoble/i);
    },
  );
});

describe("motif d'une présentation démentie (réservée OU confirmée)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.deja = false;
    h.envoyer.mockResolvedValue("envoye");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("reste vrai pour une présentation d'abord confirmée : ne dit pas « pas confirmé cette présentation »", async () => {
    const html = await render(
      React.createElement(ApporteurPresentationNonRetenueEmail, {
        locale: "fr",
        payload: { contactName: "Ana Bel", entreprise: "Danone", motif: "non-confirmee" },
      }),
    );
    expect(COPY_NON_RETENUE.motif["non-confirmee"]).toBe(
      "Cette mise en relation n'a finalement pas pu aboutir.",
    );
    expect(COPY_NON_RETENUE.motif["non-confirmee"]).not.toMatch(/confirm/i);
    expect(html).not.toMatch(/confirm/i);
  });

  it("une confirmée démentie envoie le même motif neutre", async () => {
    vi.stubEnv("APPORTEURS_EMAIL_REFUS", "true");
    h.deja = false;
    h.envoyer.mockResolvedValue("envoye");
    h.presentation = {
      id: ID,
      statut: "dementie",
      denomination: "Danone",
      apporteur: { prenom: "Ana", nom: "Bel", email: "ana@exemple.fr" },
    };
    await annoncerRefus(ID, "dementie");
    expect(h.envoyer.mock.calls.at(-1)![0].payload.motif).toBe("non-confirmee");
    vi.unstubAllEnvs();
  });

  it("pas de gabaritRepli (aucun ancien gabarit n'est vrai) : l'interrupteur reste éteint par défaut", async () => {
    vi.stubEnv("APPORTEURS_EMAIL_REFUS", "true");
    h.presentation = {
      id: ID,
      statut: "dementie",
      denomination: "Danone",
      apporteur: { prenom: "Ana", nom: "Bel", email: "ana@exemple.fr" },
    };
    await annoncerRefus(ID, "dementie");
    expect(h.envoyer.mock.calls.at(-1)![0].payload).not.toHaveProperty("gabaritRepli");
    vi.unstubAllEnvs();
    h.envoyer.mockClear();
    expect(process.env.APPORTEURS_EMAIL_REFUS).toBeUndefined();
    expect(await annoncerRefus(ID, "dementie")).toBe(false);
    expect(h.envoyer).not.toHaveBeenCalled();
  });
});

describe("annoncerRefus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.deja = false;
    h.envoyer.mockResolvedValue("envoye");
    h.presentation = {
      id: ID,
      statut: "dementie",
      denomination: "Danone",
      apporteur: { prenom: "Ana", nom: "Bel", email: "ana@exemple.fr" },
    };
  });
  afterEach(() => vi.unstubAllEnvs());

  it("éteint par défaut : rien ne part", async () => {
    expect(await annoncerRefus(ID, "dementie")).toBe(false);
    expect(h.envoyer).not.toHaveBeenCalled();
  });

  it("allumé : part une fois, avec la clé apporteur-refus-<id>", async () => {
    vi.stubEnv("APPORTEURS_EMAIL_REFUS", "true");
    expect(await annoncerRefus(ID, "dementie")).toBe(true);
    expect(h.envoyer.mock.calls[0]![0]).toMatchObject({
      gabarit: "apporteur-presentation-non-retenue",
      destinataire: "ana@exemple.fr",
      jobId: `apporteur-refus-${ID}`,
    });
    h.deja = true;
    expect(await annoncerRefus(ID, "dementie")).toBe(false);
    expect(h.envoyer).toHaveBeenCalledTimes(1);
  });

  it("allumé mais statut inattendu : rien ne part", async () => {
    vi.stubEnv("APPORTEURS_EMAIL_REFUS", "true");
    h.presentation = { ...h.presentation!, statut: "reservee" };
    expect(await annoncerRefus(ID, "dementie")).toBe(false);
    expect(h.envoyer).not.toHaveBeenCalled();
  });
});
