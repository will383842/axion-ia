/**
 * B2, PR 5 — la liste des devis porte le badge « E-mail à valider » : UNE seule lecture groupée
 * pour toute la liste, jamais une requête par ligne. Lecture seule.
 */
import { cleanup, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NOW = new Date("2030-01-01T00:00:00Z");
const etat = vi.hoisted(() => ({
  ids: new Set<string>(),
  lectures: 0,
  panne: false,
  demandes: [] as string[][],
}));

const ligne = (id: string, statut: string) => ({
  id,
  numero: `AXI-DEV-2030-${id}`,
  clientId: "c1",
  statut,
  montantTotalHtCents: 100000,
  montantOpcoEstimeCents: null,
  financementSuggere: null,
  dateValidite: NOW,
});

vi.mock("@/server/auth/garde-page", () => ({
  gardePage: () => Promise.resolve({ autorise: true, role: "admin", peutEcrire: true }),
}));
vi.mock("@/server/qualiopi/crm/devis", () => ({
  listDevis: () =>
    Promise.resolve([
      ligne("b1", "brouillon"),
      ligne("b2", "brouillon"),
      ligne("e1", "envoye"),
      ligne("a1", "accepte"),
    ]),
}));
vi.mock("@/server/qualiopi/crm/clients", () => ({
  listClients: () => Promise.resolve([{ id: "c1", raisonSociale: "Client fictif" }]),
}));
vi.mock("@/server/qualiopi/documents/signature/pieces-en-attente", () => ({
  idsPiecesDevisAContresigner: () => Promise.resolve(new Set<string>()),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOutbox: {
      findMany: (args: { where: { entityId: { in: string[] } } }) => {
        etat.lectures += 1;
        if (etat.panne) return Promise.reject(new Error("lecture indisponible"));
        etat.demandes.push(args.where.entityId.in);
        return Promise.resolve(
          args.where.entityId.in.filter((i) => etat.ids.has(i)).map((entityId) => ({ entityId })),
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

const badges = (c: HTMLElement) =>
  [...c.querySelectorAll('[data-testid="badge-email-devis"]')].map((n) => ({
    texte: n.textContent,
    href: n.getAttribute("href"),
  }));

describe("liste des devis : badge « E-mail à valider »", () => {
  beforeEach(() => {
    cleanup();
    etat.ids = new Set();
    etat.lectures = 0;
    etat.panne = false;
    etat.demandes = [];
  });

  it("une seule lecture groupée, limitée aux brouillons et envoyés", async () => {
    etat.ids = new Set(["b1"]);
    await afficher();
    expect(etat.lectures).toBe(1);
    expect(etat.demandes[0]?.sort()).toEqual(["b1", "b2", "e1"]);
  });

  it("badge sur le brouillon en attente seulement, avec lien vers les e-mails à valider", async () => {
    etat.ids = new Set(["b1"]);
    expect(badges(await afficher())).toEqual([
      { texte: "E-mail à valider", href: "/fr/adm/qualiopi/emails" },
    ]);
  });

  it("badge « ancien » pour un devis envoyé dont la ligne est encore à valider", async () => {
    etat.ids = new Set(["e1"]);
    expect(badges(await afficher()).map((b) => b.texte)).toEqual(["E-mail du devis à valider"]);
  });

  it("un devis accepté ne porte jamais le badge, même si une ligne traîne", async () => {
    etat.ids = new Set(["a1"]);
    expect(badges(await afficher())).toEqual([]);
  });

  it("aucun e-mail en attente : aucun badge", async () => {
    expect(badges(await afficher())).toEqual([]);
  });

  it("une panne de lecture des e-mails en attente ne fait pas tomber la liste", async () => {
    etat.panne = true;
    const c = await afficher();
    expect(etat.lectures).toBe(1);
    expect(badges(c)).toEqual([]);
    expect(c.textContent).toContain("AXI-DEV-2030-b1");
  });
});
