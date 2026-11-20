/**
 * Liste des devis : pastille « À relancer » — devis envoyé, non signé par le client, encore valide,
 * envoyé depuis 3 jours ou plus, sans relance garée ou envoyée depuis 7 jours.
 * UNE seule lecture groupée des relances, limitée aux candidats.
 */
import { cleanup, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const JOUR = 86_400_000;
const etat = vi.hoisted(() => ({
  relances: new Set<string>(),
  demandes: [] as string[][],
  contresigner: new Set<string>(),
}));

const il_y_a = (j: number) => new Date(Date.now() - j * 86_400_000);
const ligne = (id: string, o: Record<string, unknown> = {}) => ({
  id,
  numero: `AXI-DEV-${id}`,
  clientId: "c1",
  statut: "envoye",
  montantTotalHtCents: 100000,
  montantOpcoEstimeCents: null,
  financementSuggere: null,
  documentGenereId: `doc-${id}`,
  sentAt: il_y_a(5),
  dateValidite: new Date(Date.now() + 10 * 86_400_000),
  ...o,
});

vi.mock("@/server/auth/garde-page", () => ({
  gardePage: () => Promise.resolve({ autorise: true, role: "admin", peutEcrire: true }),
}));
vi.mock("@/server/qualiopi/crm/devis", () => ({
  listDevis: () =>
    Promise.resolve([
      ligne("ok"),
      ligne("recent", { sentAt: il_y_a(1) }),
      ligne("perime", { dateValidite: new Date(Date.now() - JOUR) }),
      ligne("deja-relance"),
      ligne("signe"),
      ligne("accepte", { statut: "accepte" }),
    ]),
}));
vi.mock("@/server/qualiopi/crm/clients", () => ({
  listClients: () => Promise.resolve([{ id: "c1", raisonSociale: "Client fictif" }]),
}));
vi.mock("@/server/qualiopi/documents/signature/pieces-en-attente", () => ({
  idsPiecesDevisAContresigner: () => Promise.resolve(etat.contresigner),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOutbox: {
      findMany: (args: { where: { template: string; entityId: { in: string[] } } }) => {
        if (args.where.template !== "relance-devis-client") return Promise.resolve([]);
        etat.demandes.push(args.where.entityId.in);
        return Promise.resolve(
          args.where.entityId.in
            .filter((i) => etat.relances.has(i))
            .map((entityId) => ({ entityId })),
        );
      },
    },
  },
}));

import QualiopiDevisPage from "../page";

async function afficher(): Promise<HTMLElement> {
  const ui = await QualiopiDevisPage({
    params: Promise.resolve({ locale: "fr", adminPrefix: "adm" }),
    searchParams: Promise.resolve({}),
  });
  return render(ui).container;
}

/** Numéros des lignes portant la pastille. */
const avecPastille = (c: HTMLElement) =>
  [...c.querySelectorAll("tbody tr")]
    .filter((tr) => tr.textContent?.includes("À relancer"))
    .map((tr) => /AXI-DEV-([a-z-]+)/.exec(tr.textContent ?? "")?.[1]);

describe("liste des devis : pastille « À relancer »", () => {
  beforeEach(() => {
    cleanup();
    etat.relances = new Set(["deja-relance"]);
    etat.contresigner = new Set(["doc-signe"]);
    etat.demandes = [];
  });

  it("présente seulement sur le devis envoyé, non signé, valide, vieux de 3 jours, sans relance récente", async () => {
    expect(avecPastille(await afficher())).toEqual(["ok"]);
  });

  it("une seule lecture groupée, limitée aux candidats", async () => {
    await afficher();
    expect(etat.demandes).toHaveLength(1);
    expect(etat.demandes[0]?.sort()).toEqual(["deja-relance", "ok"]);
  });
});
