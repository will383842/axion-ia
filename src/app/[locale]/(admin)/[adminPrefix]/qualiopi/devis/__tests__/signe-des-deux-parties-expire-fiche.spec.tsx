/**
 * Fiche (la page) d'un devis EXPIRÉ signé des deux parties : tant qu'aucune version suivante n'est
 * émise, la mention « Signé des deux parties, acceptation à finir » et « Marquer accepté » sont là ;
 * dès qu'une version suivante est émise, ils disparaissent.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = new Date("2030-01-01T00:00:00Z");
const etat = vi.hoisted(() => ({
  devis: {} as Record<string, unknown>,
  role: "admin",
  peutEcrire: true,
  signatures: [] as Array<{ partie: string }>,
  canal: "inconnu" as "email" | "main_propre" | "inconnu" | "rejet",
  successeur: false,
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
            methode: "trace",
            hashVersion: 1,
            choixOffre: null,
            choixOffreSha256: null,
            documentGenere: { annuleeAt: null },
          })),
        ),
    },
    planRecurrent: { count: () => Promise.resolve(0) },
    devis: {
      findFirst: () => Promise.resolve(etat.successeur ? { id: "d2" } : null),
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
vi.mock("@/server/actions/qualiopi/devis-delai-client", () => ({
  demanderDelaiClientAction: vi.fn(),
  leverDelaiClientAction: vi.fn(),
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
  etat.devis = { ...base, statut: "expire" };
  etat.role = "admin";
  etat.peutEcrire = true;
  etat.signatures = [{ partie: "client" }, { partie: "axionia" }];
  etat.canal = "email";
  etat.successeur = false;
});
afterEach(() => cleanup());

const MENTION = "Signé des deux parties, acceptation à finir";

describe("fiche devis expiré signé des deux parties", () => {
  it("aucune version suivante : mention et « Marquer accepté » présents", async () => {
    const c = await afficher();
    expect(c.querySelector('[data-testid="mention-signe-des-deux-parties"]')).not.toBeNull();
    expect(c.textContent).toContain(MENTION);
    expect(screen.queryAllByText("Marquer accepté").length).toBeGreaterThan(0);
  });

  it("version suivante émise : mention et « Marquer accepté » absents", async () => {
    etat.successeur = true;
    const c = await afficher();
    expect(c.querySelector('[data-testid="mention-signe-des-deux-parties"]')).toBeNull();
    expect(c.textContent).not.toContain(MENTION);
    expect(screen.queryByText("Marquer accepté")).toBeNull();
  });
});
