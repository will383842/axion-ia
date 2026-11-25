// L'accueil de l'espace d'un apporteur signé porte un lien bien visible vers « Mes documents »,
// près des liens vers la grille et les outils (2026-11-25).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useParams: () => ({}),
}));
vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  lireDossierParLien: vi.fn(async () => ({
    id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
    prenom: "Marie",
    nom: "Dupont",
    restreint: false,
    statut: "signe",
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

import Page from "./page";

describe("accueil de l'espace, contrat signé", () => {
  it("le lien « Mes documents » mène à la page des documents, avant la grille et les outils", async () => {
    const html = renderToStaticMarkup(
      await Page({ params: Promise.resolve({ id: ID, jeton: "jeton-valide" }) }),
    );
    const base = `/apporteur/dossier/${ID}/jeton-valide`;
    const lien = new RegExp(`<a[^>]*href="${base}/documents"[^>]*>([^<]*)</a>`).exec(html);
    expect(lien?.[1]).toContain("Mes documents");
    expect(html.indexOf(`${base}/documents"`)).toBeLessThan(html.indexOf(`${base}/commissions"`));
    expect(html.indexOf(`${base}/documents"`)).toBeLessThan(html.indexOf(`${base}/outils"`));
  });
});
