// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findMany: vi.fn(),
  personnes: vi.fn(),
  client: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { clientContact: { findMany: h.findMany }, client: { findUnique: h.client } },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({ logQualiopiActivity: vi.fn() }));
vi.mock("@/features/dossier-client/message-affichable", () => ({
  MessagePourWill: class extends Error {},
  messageAffichable: () => "?",
}));
vi.mock("@/features/dossier-client/queries", () => ({ lirePersonnesDuClient: h.personnes }));
vi.mock("@/features/dossier-client/fiche/actions-depart", () => ({
  noterDepartFormAction: async () => undefined,
  annulerDepartFormAction: async () => undefined,
}));
vi.mock("@/server/qualiopi/financements/opco-referentiel", () => ({
  referenceOpcoDuClient: () => null,
  nomOpcoDuClient: () => "",
}));

import { BoutonDepart } from "../fiche/BoutonDepart";
import { personnesDecision } from "../fiche/PersonnesDecision";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const A = "22222222-2222-4222-8222-222222222222";
const B = "33333333-3333-4333-8333-333333333333";
const MAINTENANT = new Date("2026-10-29T10:00:00Z");

const rendre = async (el: Promise<React.ReactElement | null>) =>
  renderToStaticMarkup((await el) ?? <></>);

beforeEach(() => {
  h.findMany.mockReset();
  h.personnes.mockReset();
  h.client.mockReset();
});

describe("BoutonDepart", () => {
  it("personne active : date + « Noter le départ », champs cachés", async () => {
    h.findMany.mockResolvedValue([{ id: A, statut: "actif", partiLe: null }]);
    const html = await rendre(
      BoutonDepart({ clientId: CLIENT, personneId: A, maintenant: MAINTENANT }),
    );
    expect(html).toContain("Noter le départ");
    expect(html).toContain('type="date"');
    expect(html).toContain(`name="contactId" value="${A}"`);
    expect(html).toContain(`name="clientId" value="${CLIENT}"`);
    expect(html).not.toContain("Annuler le départ");
  });

  it("personne partie : date, « Parti » (jamais « Aucun envoi »), « Annuler le départ »", async () => {
    h.findMany.mockResolvedValue([{ id: A, statut: "parti", partiLe: new Date("2026-09-01") }]);
    const html = await rendre(
      BoutonDepart({ clientId: CLIENT, personneId: A, maintenant: MAINTENANT }),
    );
    expect(html).toContain("01/09/2026");
    expect(html).toContain("· Parti");
    expect(html).not.toContain("Aucun envoi");
    expect(html).toContain("Annuler le départ");
    expect(html).not.toContain("Noter le départ");
  });

  it("personne absente de la fiche : rien", async () => {
    h.findMany.mockResolvedValue([{ id: B, statut: "actif", partiLe: null }]);
    expect(
      await rendre(BoutonDepart({ clientId: CLIENT, personneId: A, maintenant: MAINTENANT })),
    ).toBe("");
  });

  it("panne : « Lecture impossible »", async () => {
    h.findMany.mockRejectedValue(new Error("db"));
    const html = await rendre(
      BoutonDepart({ clientId: CLIENT, personneId: A, maintenant: MAINTENANT }),
    );
    expect(html).toMatch(/Départ : /);
  });
});

describe("PersonnesDecision", () => {
  const ctx = (voitEchanges: boolean) => ({ clientId: CLIENT, voitEchanges }) as never;

  it("sans droit sur les échanges : null, aucune requête", async () => {
    expect(await personnesDecision(ctx(false))).toBeNull();
    expect(h.findMany).not.toHaveBeenCalled();
    expect(h.personnes).not.toHaveBeenCalled();
    expect(h.client).not.toHaveBeenCalled();
  });

  it("panne de lecture : « Qui décide : … »", async () => {
    h.personnes.mockRejectedValue(new Error("db"));
    h.findMany.mockResolvedValue([]);
    h.client.mockResolvedValue(null);
    const html = await rendre(personnesDecision(ctx(true)));
    expect(html).toContain("Qui décide : ");
  });
});
