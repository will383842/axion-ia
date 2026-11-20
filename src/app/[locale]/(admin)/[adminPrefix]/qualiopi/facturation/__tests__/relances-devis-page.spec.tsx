/**
 * Page Facturation : le `findMany` des relances reçoit le filtre PARTAGÉ, et le lien
 * « Ouvrir le devis » n'apparaît que pour la relance de devis, pas pour celle de facture.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ appels: [] as Array<{ where: unknown }> }));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/server/actions/qualiopi/facturation-hub", () => ({
  envoyerRelanceAction: vi.fn(),
  traiterRelanceAction: vi.fn(),
}));
vi.mock("@/server/qualiopi/config/flag", () => ({ isFacturationHubEnabled: () => true }));
vi.mock("@/server/auth/garde-page", () => ({
  gardePage: () => Promise.resolve({ autorise: true, role: "admin" }),
}));
vi.mock("@/server/qualiopi/crm/clients", () => ({ listClients: () => Promise.resolve([]) }));
vi.mock("@/server/qualiopi/financements/relance-contexte", () => ({
  getDetailsRelances: () => Promise.resolve(new Map()),
  getFraicheurPointageBancaire: () =>
    Promise.resolve({ dernierEncaissementAt: null, joursDepuis: null, avertissement: null }),
}));
vi.mock("@/lib/prisma", () => {
  const relances = [
    {
      id: "r-devis",
      type: "devis_sans_reponse",
      palier: "j3",
      suggestion: null,
      factureFormationId: null,
      factureFormation: null,
      devisId: "d1",
      devis: { numero: "AXI-DEV-1" },
    },
    {
      id: "r-facture",
      type: "facture_impayee",
      palier: "j15",
      suggestion: null,
      factureFormationId: "f1",
      factureFormation: { numero: "AXI-FAC-1" },
      devisId: null,
      devis: null,
    },
  ];
  const modele = (nom: string) =>
    new Proxy(
      {},
      {
        get: (_c, methode: string) => (args: { where?: unknown }) => {
          if (nom === "relanceProposee" && methode === "findMany") {
            etat.appels.push({ where: args.where });
            return Promise.resolve(relances);
          }
          if (methode === "count") return Promise.resolve(0);
          if (methode === "aggregate") return Promise.resolve({ _sum: {} });
          if (methode === "findMany" || methode === "groupBy") return Promise.resolve([]);
          return Promise.resolve(null);
        },
      },
    );
  return {
    prisma: new Proxy({}, { get: (_c, nom: string) => modele(nom) }),
  };
});

import { relancesAtraiterWhere } from "@/server/qualiopi/devis/relances-a-traiter-filtre";
import FacturationHubPage from "../page";

afterEach(cleanup);

async function afficher() {
  const ui = await FacturationHubPage({
    params: Promise.resolve({ locale: "fr", adminPrefix: "adm" }),
    searchParams: Promise.resolve({}),
  });
  return render(ui);
}

describe("page Facturation : relances à traiter", () => {
  it("lit les relances avec le filtre partagé", async () => {
    etat.appels = [];
    await afficher();
    expect(etat.appels).toHaveLength(1);
    // `now` est pris dans la page : les dates sont masquées des deux côtés avant comparaison.
    const masque = (v: unknown) =>
      JSON.stringify(v).replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, "<date>");
    expect(masque(etat.appels[0]!.where)).toBe(masque(relancesAtraiterWhere(new Date())));
    expect(masque(etat.appels[0]!.where)).toContain("devis_sans_reponse");
  });

  it("« Ouvrir le devis » seulement pour la relance de devis", async () => {
    await afficher();
    const liens = screen.getAllByRole("link", { name: "Ouvrir le devis" });
    expect(liens).toHaveLength(1);
    expect(liens[0]!.getAttribute("href")).toBe("/fr/adm/qualiopi/devis/d1");
  });
});
