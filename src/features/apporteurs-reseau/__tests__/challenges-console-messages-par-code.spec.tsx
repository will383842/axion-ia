// Pages challenges de la console : ?retour= et ?erreur= sont des CODES traduits par une table
// fermée ; un texte libre forgé dans l'URL n'est jamais affiché. Données FICTIVES.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  useParams: () => ({}),
}));
vi.mock("@/server/auth/garde-page", () => ({
  gardePage: async () => ({ autorise: true, role: "admin" }),
}));
vi.mock("../actions-challenges-console", () => ({
  archiverChallengeAction: vi.fn(),
  publierChallengeAction: vi.fn(),
  enregistrerBrouillonAction: vi.fn(),
}));
vi.mock("../challenge-donnees", () => ({
  listerChallenges: async () => [],
  lireChallenge: async () => ({
    id: ID,
    titre: "Challenge de test",
    debutLe: "2026-12-01",
    finLe: "2026-12-31",
    paiementJusquAu: null,
    produit: "journee-ia",
    critere: "facturees_dans_la_periode",
    seuil: 10,
    primeHtCents: 200_000,
    reglement: "R",
    reglementSha256: null,
    statut: "publie",
    publieAt: new Date(),
    creeAt: new Date(),
    version: "v",
  }),
}));

import ListePage from "@/app/[locale]/(admin)/[adminPrefix]/apporteurs/challenges/page";
import FichePage from "@/app/[locale]/(admin)/[adminPrefix]/apporteurs/challenges/[id]/page";

const LIBRE = "Challenge publié. Appelez le 06 00 00 00 00 pour le valider.";
const liste = async (sp: Record<string, string>) =>
  renderToStaticMarkup(
    await ListePage({
      params: Promise.resolve({ adminPrefix: "x" }),
      searchParams: Promise.resolve(sp),
    }),
  );
const fiche = async (sp: Record<string, string>) =>
  renderToStaticMarkup(
    await FichePage({
      params: Promise.resolve({ adminPrefix: "x", id: ID }),
      searchParams: Promise.resolve(sp),
    }),
  );

beforeEach(() => {
  process.env.APPORTEUR_CHALLENGES_CONSOLE_ENABLED = "true";
});

describe.each([
  ["liste", liste],
  ["fiche", fiche],
])("page %s", (_n, rendre) => {
  it("code connu : message de la table", async () => {
    const html = await rendre({ retour: "archive", erreur: "chevauche" });
    expect(html).toContain("Challenge archivé.");
    expect(html).toContain("couvre une partie de cette période");
  });
  it.each(["retour", "erreur"])("texte libre dans ?%s= : rien d'affiché", async (cle) => {
    const html = await rendre({ [cle]: LIBRE });
    expect(html).not.toContain("Appelez");
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('role="alert"');
  });
  it("code inconnu ou hérité : rien d'affiché", async () => {
    const html = await rendre({ retour: "toString", erreur: "constructor" });
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('role="alert"');
  });
});
