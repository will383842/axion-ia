/**
 * B6b-1 — garde : sans certification, ni la fiche ni la liste des devis
 * n'emploient un mot de tiers payeur ; les montants restent affichés.
 */
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = new Date("2030-01-01T00:00:00Z");
const DEVIS = {
  id: "d1",
  numero: "AXI-DEV-2030-001",
  clientId: "c1",
  statut: "envoye",
  montantTotalHtCents: 100000,
  montantOpcoEstimeCents: 70000,
  resteAChargeCents: 30000,
  financementSuggere: "opco",
  opcoEstimationOrigine: "bareme",
  opcoEstimationAvertissement: "Texte libre OPCO Qualiopi financement",
  dateValidite: NOW,
  updatedAt: NOW,
  sentAt: null,
  acceptedAt: null,
  declinedAt: null,
  lignes: [],
  offre: null,
  offreSha256: null,
  formuleRetenue: null,
  documentGenereId: null,
  mentionTva: null,
  livraisonDebutAt: null,
  livreAt: null,
};

// L'action de versement du scan papier tire next-auth : la fiche ne fait que la transmettre.
vi.mock("@/server/actions/qualiopi/devis-scan-papier", () => ({
  verserScanDevisSigneAction: vi.fn(),
}));
vi.mock("@/server/auth/garde-page", () => ({
  gardePage: () => Promise.resolve({ autorise: true, role: "admin", peutEcrire: true }),
}));
vi.mock("@/server/qualiopi/crm/devis", () => ({
  listDevis: () => Promise.resolve([DEVIS]),
  getDevis: () => Promise.resolve(DEVIS),
}));
vi.mock("@/server/qualiopi/crm/clients", () => ({
  listClients: () => Promise.resolve([{ id: "c1", raisonSociale: "Client fictif" }]),
  getClient: () => Promise.resolve({ id: "c1", raisonSociale: "Client fictif" }),
}));
vi.mock("@/server/qualiopi/documents/signature/pieces-en-attente", () => ({
  idsPiecesDevisAContresigner: () => Promise.resolve(new Set<string>()),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    factureFormation: { findMany: () => Promise.resolve([]) },
    documentSignature: { findMany: () => Promise.resolve([]) },
    planRecurrent: { count: () => Promise.resolve(0) },
    emailOutbox: {
      findFirst: () => Promise.resolve(null),
      findMany: () => Promise.resolve([]),
    },
  },
}));
vi.mock("@/server/qualiopi/financements/etat-fonds-opco-lecture", () => ({
  etatFondsDuClient: () => Promise.resolve({}),
}));
vi.mock("@/server/qualiopi/financements/etat-fonds-opco", () => ({
  bandeauEtatFonds: () => ({ niveau: "info", message: "Fonds OPCO suspendus" }),
}));
vi.mock("@/components/admin/qualiopi/BandeauEtatFonds", () => ({
  BandeauEtatFonds: ({ bandeau }: { bandeau: unknown }) =>
    bandeau ? <p>Bandeau fonds OPCO financement</p> : null,
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: () => Promise.resolve({ raisonSociale: "Organisme" }),
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: () => Promise.resolve(false),
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: () => Promise.resolve(null),
}));
vi.mock("@/features/apporteurs-reseau/etablissement-presentation", () => ({
  lireSiretsDevis: () => Promise.resolve(new Map()),
}));
// Chaîne du devis : la relance (action serveur) et la lecture d'horodatage ne sont pas l'objet de ce test.
vi.mock("@/features/dossier-client/fiche/actions-relance-devis", () => ({
  preparerRelanceDevisAction: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/signature/lire-horodatages", () => ({
  lireHorodatagesDeSignatures: vi.fn(async () => []),
}));
vi.mock("@/server/actions/qualiopi/piece-signature", () => ({
  contresignerPieceAction: vi.fn(),
  relancerAcceptationDevisAction: vi.fn(),
}));
for (const c of [
  "DevisLifecycleButtons",
  "ChoixClientSigne",
  "DevisContresignature",
  "RelancerAcceptationDevis",
  "DevisSuiviLivraison",
  "FacturerDevisButtons",
  "ValiditeBrouillon",
  "SiretEtablissementDevis",
]) {
  vi.doMock(`@/components/admin/qualiopi/${c}`, () => ({ [c]: () => null }));
}

const MOTS = /opco|cpf|france travail|financ|prise en charge|qualiopi/i;

describe("avant certification", () => {
  beforeEach(() => {
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "false");
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("fiche d'un ancien devis au mode opco : aucun mot de tiers payeur, montants visibles", async () => {
    const { default: Page } = await import("../[id]/page");
    const ui = await Page({
      params: Promise.resolve({ locale: "fr", adminPrefix: "adm", id: "d1" }),
    });
    const { container } = render(ui);
    const texte = container.textContent ?? "";
    expect(texte).not.toMatch(MOTS);
    expect(texte).toContain("Règlement par un tiers (ancien devis)");
    expect(texte).toContain("Mode de règlement");
    expect(texte).toMatch(/700,00/);
    expect(texte).toMatch(/300,00/);
    expect(texte).toMatch(/1\s?000,00/);
    expect(texte).toContain("Note d'estimation enregistrée (non affichée avant certification)");
  });

  it("liste : aucun mot de tiers payeur, montants visibles", async () => {
    const { default: Page } = await import("../page");
    const ui = await Page({
      params: Promise.resolve({ locale: "fr", adminPrefix: "adm" }),
      searchParams: Promise.resolve({}),
    });
    const { container } = render(ui);
    const texte = container.textContent ?? "";
    expect(texte).not.toMatch(MOTS);
    expect(texte).toMatch(/700,00/);
    expect(texte).toContain("Tiers :");
  });
});
