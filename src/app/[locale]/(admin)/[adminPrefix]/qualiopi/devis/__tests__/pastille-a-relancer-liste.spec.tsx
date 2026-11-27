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
  mainPropre: new Set<string>(),
  demandesMainPropre: [] as string[][],
  /** devisId → fin du délai demandé par le client (ISO). */
  delais: new Map<string, string>(),
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
      ligne("main-propre"),
      ligne("delai"),
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
    activityLog: {
      findMany: (args: {
        where: { action: string | { in: string[] }; targetId: { in: string[] } };
      }) => {
        // Lecture des délais demandés par le client (actions `...delai_client.*`).
        if (typeof args.where.action !== "string") {
          return Promise.resolve(
            args.where.targetId.in
              .filter((i) => etat.delais.has(i))
              .map((targetId) => ({
                targetId,
                action: "qualiopi.devis.delai_client.demande",
                changes: { finDelai: etat.delais.get(targetId) },
                createdAt: new Date(),
                id: `e-${targetId}`,
              })),
          );
        }
        etat.demandesMainPropre.push(args.where.targetId.in);
        return Promise.resolve(
          args.where.targetId.in
            .filter((i) => etat.mainPropre.has(i))
            .map((targetId) => ({ targetId })),
        );
      },
    },
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
    etat.mainPropre = new Set(["main-propre"]);
    etat.demandesMainPropre = [];
    etat.delais = new Map([["delai", new Date(Date.now() + 5 * JOUR).toISOString()]]);
  });

  it("présente seulement sur le devis envoyé, non signé, valide, vieux de 3 jours, sans relance récente", async () => {
    expect(avecPastille(await afficher())).toEqual(["ok"]);
  });

  it("une seule lecture groupée, limitée aux candidats", async () => {
    await afficher();
    expect(etat.demandes).toHaveLength(1);
    expect(etat.demandes[0]?.sort()).toEqual(["deja-relance", "delai", "main-propre", "ok"]);
  });

  it("pas de pastille sur un devis remis en main propre, une seule lecture groupée", async () => {
    expect(avecPastille(await afficher())).not.toContain("main-propre");
    expect(etat.demandesMainPropre).toHaveLength(1);
    expect(etat.demandesMainPropre[0]?.sort()).toEqual([
      "deja-relance",
      "delai",
      "main-propre",
      "ok",
    ]);
  });

  it("pas de pastille sur un devis en délai demandé par le client", async () => {
    expect(avecPastille(await afficher())).not.toContain("delai");
  });

  it("délai échu : la pastille revient", async () => {
    etat.delais = new Map([["delai", new Date(Date.now() - 1000).toISOString()]]);
    expect(avecPastille(await afficher())).toContain("delai");
  });
});
