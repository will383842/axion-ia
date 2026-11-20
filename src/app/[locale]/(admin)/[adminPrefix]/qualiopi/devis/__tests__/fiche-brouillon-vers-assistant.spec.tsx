/**
 * E19-2 — « Modifier le brouillon » d'une fiche de devis BROUILLON classique mène à l'assistant
 * (`new?devis=<id>`) quand un brouillon d'assistant est lié ET que l'assistant agit ; sinon à
 * `/corriger`, inchangé. Lecture seule.
 */
import { cleanup, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NOW = new Date("2030-01-01T00:00:00Z");
const etat = vi.hoisted(() => ({
  interrupteur: "eteint" as "eteint" | "essai" | "actif",
  lie: false,
  ficheEssai: false,
}));

const base = {
  id: "d1",
  numero: "AXI-DEV-2030-001",
  clientId: "c1",
  statut: "brouillon",
  montantTotalHtCents: 100000,
  montantOpcoEstimeCents: null,
  resteAChargeCents: null,
  financementSuggere: null,
  opcoEstimationOrigine: null,
  opcoEstimationAvertissement: null,
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

vi.mock("@/server/auth/garde-page", () => ({
  gardePage: () => Promise.resolve({ autorise: true, role: "admin", peutEcrire: true }),
}));
vi.mock("@/server/qualiopi/crm/devis", () => ({ getDevis: () => Promise.resolve({ ...base }) }));
vi.mock("@/server/qualiopi/crm/clients", () => ({
  getClient: () => Promise.resolve({ id: "c1", raisonSociale: "Client fictif" }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    factureFormation: { findMany: () => Promise.resolve([]) },
    documentSignature: { findMany: () => Promise.resolve([]) },
    planRecurrent: { count: () => Promise.resolve(0) },
    emailOutbox: { findFirst: () => Promise.resolve(null) },
    devisAssistantBrouillon: {
      findUnique: () => Promise.resolve(etat.lie ? { id: "b1" } : null),
    },
    client: {
      findFirst: () => Promise.resolve(etat.ficheEssai ? { id: "c1" } : null),
    },
  },
}));
vi.mock("@/server/qualiopi/socle/interrupteurs", async (orig) => ({
  ...(await orig<typeof import("@/server/qualiopi/socle/interrupteurs")>()),
  lireInterrupteurQualiopi: () => Promise.resolve(etat.interrupteur),
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
  etatConfirmationCommande: () => Promise.resolve(null),
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
  "DevisSuiviLivraison",
  "FacturerDevisButtons",
  "ValiditeBrouillon",
  "SiretEtablissementDevis",
  "BandeauEtatFonds",
  "RelancerAcceptationDevis",
]) {
  vi.doMock(`@/components/admin/qualiopi/${c}`, () => ({ [c]: () => null }));
}

async function lienModifier(): Promise<string | null> {
  const { default: Page } = await import("../[id]/page");
  const ui = await Page({
    params: Promise.resolve({ locale: "fr", adminPrefix: "adm", id: "d1" }),
  });
  const { container } = render(ui);
  const a = [...container.querySelectorAll("a")].find((x) =>
    /Modifier le brouillon/.test(x.textContent ?? ""),
  );
  return a?.getAttribute("href") ?? null;
}

const CORRIGER = "/fr/adm/qualiopi/devis/d1/corriger";
const ASSISTANT = "/fr/adm/qualiopi/devis/new?devis=d1";

describe("fiche devis brouillon : « Modifier le brouillon » vers l'assistant (E19-2)", () => {
  beforeEach(() => {
    cleanup();
    vi.resetModules();
    etat.interrupteur = "eteint";
    etat.lie = false;
    etat.ficheEssai = false;
  });

  it("assistant actif + brouillon lié : l'assistant", async () => {
    etat.interrupteur = "actif";
    etat.lie = true;
    expect(await lienModifier()).toBe(ASSISTANT);
  });

  it("assistant actif sans brouillon lié : /corriger inchangé", async () => {
    etat.interrupteur = "actif";
    expect(await lienModifier()).toBe(CORRIGER);
  });

  it("assistant éteint, même avec un brouillon lié : /corriger inchangé", async () => {
    etat.lie = true;
    expect(await lienModifier()).toBe(CORRIGER);
  });

  it("essai + fiche d'essai + lié : l'assistant", async () => {
    etat.interrupteur = "essai";
    etat.lie = true;
    etat.ficheEssai = true;
    expect(await lienModifier()).toBe(ASSISTANT);
  });

  it("essai + vraie fiche + lié : /corriger inchangé", async () => {
    etat.interrupteur = "essai";
    etat.lie = true;
    expect(await lienModifier()).toBe(CORRIGER);
  });
});
