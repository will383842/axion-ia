// PR K (2464) : la page d'archive d'un résilié payé ne montre pas de lien mort quand
// l'interrupteur « Mes commissions » est éteint.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
vi.mock("server-only", () => ({}));
vi.mock("@/features/apporteurs-reseau/resiliation", () => ({
  lireResiliationEnCours: async () => null,
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  lireDossierParLien: vi.fn(async () => ({
    id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
    prenom: "Marie",
    nom: "Dupont",
    restreint: true,
    archive: true,
    statut: "resilie",
    aContratSigne: true,
    pieces: [],
  })),
  vigilanceDemandeeA: vi.fn(async () => false),
}));
vi.mock("@/features/apporteurs-reseau/declaration-entreprise", () => ({
  lireDeclarationsDe: vi.fn(async () => []),
}));
vi.mock("@/features/apporteurs-reseau/contrat-pdf", () => ({
  empreinte: () => "",
  texteDuContrat: () => "",
}));
vi.mock("@/features/apporteurs-reseau/signature", async () => {
  const regles = await import("@/features/apporteurs-reseau/signature-regles");
  return {
    etatDeLaPage: regles.etatDeLaPage,
    libelleMotif: regles.libelleMotif,
    manquesDuDossier: regles.manquesDuDossier,
    valeursDuContrat: regles.valeursDuContrat,
  };
});
vi.mock("./DeclarationEntreprise", () => ({ DeclarationEntreprise: () => null }));
vi.mock("./ListeDeclarations", () => ({ ListeDeclarations: () => null }));
vi.mock("./DepotPiece", () => ({ DepotPiece: () => null }));
vi.mock("./DossierEnLigne", () => ({ DossierEnLigne: () => null }));
vi.mock("./ContratLisible", () => ({ ContratLisible: () => null }));

const etat = vi.hoisted(() => ({ actif: true }));
vi.mock("@/features/apporteurs-reseau/interrupteur-mes-commissions", () => ({
  mesCommissionsActive: () => etat.actif,
}));

import Page from "./page";

async function rendre() {
  return renderToStaticMarkup(
    await Page({ params: Promise.resolve({ id: ID, jeton: "jeton-valide" }) }),
  );
}

describe("page d'archive d'un résilié payé", () => {
  it("interrupteur allumé : autofactures, relevés et contrat", async () => {
    etat.actif = true;
    const html = await rendre();
    expect(html).toContain("mes-commissions#pieces");
    expect(html).toContain("mes-commissions#releves");
    expect(html).toContain("/contrat?dl=1");
  });
  it("interrupteur éteint : plus de lien vers mes-commissions (404), le contrat reste", async () => {
    etat.actif = false;
    const html = await rendre();
    expect(html).not.toContain("mes-commissions");
    expect(html).toContain("/contrat?dl=1");
  });
});
