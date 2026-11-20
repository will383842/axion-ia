/**
 * Une signature manuscrite sur papier (méthode `papier_scanne`) apparaît sous « Devis signé sur
 * papier », jamais sous « Signature électronique ».
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = new Date("2030-01-01T00:00:00Z");
const etat = vi.hoisted(() => ({
  devis: {} as Record<string, unknown>,
  role: "admin",
  peutEcrire: true,
  signatures: [] as Array<{ partie: string; methode: string }>,
  canal: "inconnu" as "email" | "main_propre" | "inconnu" | "rejet",
}));

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
  dateValidite: NOW,
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
  gardePage: () =>
    Promise.resolve({ autorise: true, role: etat.role, peutEcrire: etat.peutEcrire }),
}));
vi.mock("@/server/qualiopi/crm/devis", () => ({ getDevis: () => Promise.resolve(etat.devis) }));
vi.mock("@/server/qualiopi/crm/clients", () => ({
  getClient: () =>
    Promise.resolve({ id: "c1", raisonSociale: "Client fictif", contactEmail: "c@example.test" }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    factureFormation: { findMany: () => Promise.resolve([]) },
    documentSignature: {
      findMany: () =>
        Promise.resolve(
          etat.signatures.map((s, i) => ({
            id: `s${i}`,
            partie: s.partie,
            signataireNom: "Signataire",
            signataireQualite: null,
            signeAt: NOW,
            selfHash: "h",
            methode: s.methode,
            hashVersion: 1,
            choixOffre: null,
            choixOffreSha256: null,
            documentGenere: { annuleeAt: null },
          })),
        ),
    },
    planRecurrent: { count: () => Promise.resolve(0) },
    devis: {
      findFirst: () => Promise.resolve(null),
      findUnique: () => Promise.resolve({ documentGenere: { annuleeAt: null, type: "devis" } }),
    },
    emailOutbox: { findFirst: () => Promise.resolve(null) },
  },
}));
vi.mock("@/server/qualiopi/devis/canal-emission", () => ({
  lireCanalEmission: async () => {
    if (etat.canal === "rejet") throw new Error("lecture KO");
    return etat.canal;
  },
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
  etat.role = "admin";
  etat.peutEcrire = true;
  etat.signatures = [];
  etat.canal = "inconnu";
});
afterEach(() => cleanup());

function titres(c: HTMLElement): string[] {
  return Array.from(c.querySelectorAll("h2")).map((h) => h.textContent ?? "");
}

describe("fiche devis : signature papier", () => {
  it("papier_scanne : rendue sous « Devis signé sur papier », pas sous « Signature électronique »", async () => {
    etat.signatures = [{ partie: "client", methode: "papier_scanne" }];
    const c = await afficher();
    const papier = c.querySelector('[data-testid="section-devis-papier"]');
    expect(papier).not.toBeNull();
    expect(papier?.querySelector("h2")?.textContent).toBe("Devis signé sur papier");
    expect(papier?.textContent).toContain("Copie numérisée versée le");
    expect(papier?.textContent).toContain("Ouvrir le scan versé (PDF)");
    const h2 = titres(c);
    expect(h2.indexOf("Devis signé sur papier")).toBe(h2.indexOf("Signature électronique") + 1);
    const electronique = Array.from(c.querySelectorAll("section")).find(
      (sec) => sec.querySelector("h2")?.textContent === "Signature électronique",
    );
    expect(electronique).toBeDefined();
    expect(electronique?.textContent).not.toContain("Copie numérisée versée");
    expect(electronique?.textContent).not.toContain("Ouvrir le scan versé");
  });

  it("signature par trace : reste sous « Signature électronique »", async () => {
    etat.signatures = [{ partie: "client", methode: "trace" }];
    const c = await afficher();
    const electronique = Array.from(c.querySelectorAll("section")).find(
      (sec) => sec.querySelector("h2")?.textContent === "Signature électronique",
    );
    expect(electronique?.textContent).toContain("Accord du client");
  });
});
