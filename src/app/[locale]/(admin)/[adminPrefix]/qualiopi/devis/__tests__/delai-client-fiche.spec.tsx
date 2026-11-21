/**
 * Fiche d'un devis : bouton « Le client demande un délai… » (présent pour un devis envoyé valide avec
 * droit d'écriture ; absent en lecture seule et pour un devis expiré) et état « délai actif ».
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  devis: {} as Record<string, unknown>,
  peutEcrire: true,
  journal: [] as unknown[],
  journalRejette: false,
}));

const NOW = new Date("2030-01-01T00:00:00Z");
const base = {
  id: "d1",
  numero: "AXI-DEV-2030-001",
  clientId: "c1",
  statut: "envoye",
  montantTotalHtCents: 100000,
  montantOpcoEstimeCents: null,
  resteAChargeCents: null,
  financementSuggere: null,
  opcoEstimationOrigine: null,
  opcoEstimationAvertissement: null,
  // Valide très longtemps : les bornes existent quelle que soit la date d'exécution du test.
  dateValidite: new Date("2099-01-01T00:00:00Z"),
  updatedAt: NOW,
  sentAt: new Date("2029-12-15T10:00:00Z"),
  acceptedAt: null,
  declinedAt: null,
  lignes: [],
  offre: null,
  offreSha256: null,
  formuleRetenue: null,
  documentGenereId: "11111111-1111-4111-8111-111111111111",
  mentionTva: null,
  livraisonDebutAt: null,
  livreAt: null,
};

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/auth/garde-page", () => ({
  gardePage: () => Promise.resolve({ autorise: true, role: "admin", peutEcrire: etat.peutEcrire }),
}));
vi.mock("@/server/qualiopi/crm/devis", () => ({ getDevis: () => Promise.resolve(etat.devis) }));
vi.mock("@/server/qualiopi/crm/clients", () => ({
  getClient: () =>
    Promise.resolve({ id: "c1", raisonSociale: "Client fictif", contactEmail: "c@example.test" }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    factureFormation: { findMany: () => Promise.resolve([]) },
    documentSignature: { findMany: () => Promise.resolve([]) },
    planRecurrent: { count: () => Promise.resolve(0) },
    devis: {
      findFirst: () => Promise.resolve(null),
      findUnique: () => Promise.resolve({ documentGenere: { annuleeAt: null, type: "devis" } }),
    },
    emailOutbox: { findFirst: () => Promise.resolve(null) },
    activityLog: {
      findMany: () =>
        etat.journalRejette
          ? Promise.reject(new Error("journal indisponible"))
          : Promise.resolve(etat.journal),
    },
  },
}));
vi.mock("@/server/qualiopi/devis/canal-emission", () => ({
  lireCanalEmission: async () => "email",
}));
vi.mock("@/server/qualiopi/financements/etat-fonds-opco-lecture", () => ({
  etatFondsDuClient: () => Promise.resolve({}),
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
vi.mock("@/server/qualiopi/devis/confirmation-commande", () => ({
  etatConfirmationCommande: () => Promise.resolve("autre"),
}));
vi.mock("@/features/dossier-client/fiche/actions-relance-devis", () => ({
  preparerRelanceDevisAction: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/signature/lire-horodatages", () => ({
  lireHorodatagesDeSignatures: vi.fn(async () => []),
}));
vi.mock("@/server/actions/qualiopi/devis-remis-main-propre", () => ({
  marquerRemisEnMainPropreAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/devis", () => ({
  sendDevisAction: vi.fn(),
  acceptDevisAction: vi.fn(),
  declineDevisAction: vi.fn(),
  transformDevisToConventionAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/devis-prolonger-validite", () => ({
  prolongerValiditeDevisAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/devis-delai-client", () => ({
  demanderDelaiClientAction: vi.fn(),
  leverDelaiClientAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/facturation-emails", () => ({
  envoyerDevisEmailAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/devis-scan-papier", () => ({
  verserScanDevisSigneAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/piece-signature", () => ({
  contresignerPieceAction: vi.fn(),
  relancerAcceptationDevisAction: vi.fn(),
}));
for (const c of [
  "ChoixClientSigne",
  "DevisContresignature",
  "DevisSuiviLivraison",
  "FacturerDevisButtons",
  "ValiditeBrouillon",
  "SiretEtablissementDevis",
  "BandeauEtatFonds",
]) {
  vi.doMock(`@/components/admin/qualiopi/${c}`, () => ({ [c]: () => null }));
}

async function afficher(): Promise<HTMLElement> {
  const { default: Page } = await import("../[id]/page");
  const ui = await Page({
    params: Promise.resolve({ locale: "fr", adminPrefix: "adm", id: "d1" }),
  });
  return render(ui).container;
}

beforeEach(() => {
  vi.resetModules();
  etat.devis = { ...base };
  etat.peutEcrire = true;
  etat.journal = [];
  etat.journalRejette = false;
});
afterEach(() => cleanup());

const BOUTON = "Le client demande un délai…";

describe("fiche devis : « Le client demande un délai… »", () => {
  it("présent pour un devis envoyé, valide, avec droit d'écriture", async () => {
    expect((await afficher()).textContent).toContain(BOUTON);
  });

  it("absent en lecture seule", async () => {
    etat.peutEcrire = false;
    expect((await afficher()).textContent).not.toContain(BOUTON);
  });

  it("absent pour un devis expiré", async () => {
    etat.devis = { ...base, statut: "expire" };
    expect((await afficher()).textContent).not.toContain(BOUTON);
  });

  it("délai actif : note avec la date choisie, vue à Paris", async () => {
    etat.journal = [
      {
        targetId: "d1",
        action: "qualiopi.devis.delai_client.demande",
        changes: { finDelai: "2098-07-16T22:00:00.000Z" },
        createdAt: new Date(),
        id: "e1",
      },
    ];
    const c = await afficher();
    expect(c.querySelector('[data-testid="delai-client-actif"]')?.textContent).toBe(
      "Le client a demandé un délai : pas de rappel avant le 17/07/2098.",
    );
  });

  it("lecture du délai en erreur : la page s'affiche comme avant, bouton présent", async () => {
    etat.journalRejette = true;
    expect((await afficher()).textContent).toContain(BOUTON);
  });
});
