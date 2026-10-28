import { beforeEach, describe, expect, it, vi } from "vitest";

const sync = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/server/crm-sync", () => ({ syncFormSubmissionToCrm: sync }));

import { SOURCE_CRM_TOUR, envoyerAuCrm } from "../crm";

const demande = {
  id: "3f2b8c1e-5d4a-4b7e-9c1d-0a1b2c3d4e5f",
  nom: "Alice Martin",
  email: "alice@societe-exemple.fr",
  telephone: "0612345678",
  ville: "Lyon",
  depuis: "linkedin",
  utmSource: "linkedin",
  utmMedium: null,
  utmCampaign: "tour",
  utmContent: null,
};

beforeEach(() => {
  sync.mockClear();
});

describe("envoi de la demande au CRM Pro", () => {
  it("passe par la synchro existante : formulaire « autre », source tour-france-ia", async () => {
    await envoyerAuCrm(demande);
    expect(sync).toHaveBeenCalledTimes(1);
    const arg = (sync.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(arg["formType"]).toBe("autre");
    expect(arg["sourceSlug"]).toBe("tour-france-ia");
    expect(SOURCE_CRM_TOUR).toBe("tour-france-ia");
  });

  it("seule l'adresse part sous la clé de la personne : ni nom, ni téléphone, ni entreprise", async () => {
    await envoyerAuCrm(demande);
    const arg = (sync.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    // Un visiteur peut taper l'adresse d'un client : son nom et son numéro ne doivent pas pouvoir
    // écraser ceux d'une personne déjà connue du CRM.
    expect(arg["person"]).toEqual({ email: "alice@societe-exemple.fr" });
    expect(arg).not.toHaveProperty("company");
  });

  it("ne pose ni consentement ni étiquette (la base légale est la demande de la personne)", async () => {
    await envoyerAuCrm(demande);
    const arg = (sync.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(arg).not.toHaveProperty("consent");
    expect(arg).not.toHaveProperty("tags");
  });

  it("l'identifiant d'événement est stable : rejouer l'envoi ne crée pas une seconde activité", async () => {
    await envoyerAuCrm(demande);
    await envoyerAuCrm(demande);
    const a = (sync.mock.calls[0] as unknown as [{ eventId: string }])[0].eventId;
    const b = (sync.mock.calls[1] as unknown as [{ eventId: string }])[0].eventId;
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(a).toBe(b);
  });

  it("la charge porte la ville, le nom et le téléphone TAPÉS, et les repères de campagne présents", async () => {
    await envoyerAuCrm(demande);
    const arg = (sync.mock.calls[0] as unknown as [{ payload: Record<string, unknown> }])[0];
    expect(arg.payload).toEqual({
      circuit: "tour_france_ia",
      ville: "Lyon",
      nom_saisi: "Alice Martin",
      telephone_saisi: "0612345678",
      depuis: "linkedin",
      utm_source: "linkedin",
      utm_campaign: "tour",
    });
  });
});
