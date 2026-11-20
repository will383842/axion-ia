/**
 * Lot I1 — la fiche d'un devis dit COMMENT il a été émis (e-mail / main propre) et ne propose
 * pas au rôle lecteur des liens PDF qui répondraient 403.
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

const ALERTE_LIEN = "Le lien de signature lui a été envoyé";

describe("fiche devis : canal d'émission", () => {
  it("main propre, envoyé, non signé : libellé, information, et ni lien, ni renvoi, ni relance", async () => {
    etat.canal = "main_propre";
    const c = await afficher();
    expect(c.textContent).toContain("Remis en main propre le");
    const info = c.querySelector('[data-testid="info-remis-main-propre"]');
    expect(info).not.toBeNull();
    expect(info?.getAttribute("role")).toBe("status");
    expect(info?.textContent).toContain("aucun e-mail n'est parti");
    expect(c.textContent).not.toContain(ALERTE_LIEN);
    expect(screen.queryByText("Renvoyer par email")).toBeNull();
    expect(screen.queryByText("Préparer une relance")).toBeNull();
  });

  it("canal e-mail : « Envoyé par e-mail le », renvoi et relance présents", async () => {
    etat.canal = "email";
    const c = await afficher();
    expect(c.textContent).toContain("Envoyé par e-mail le");
    expect(screen.queryByText("Renvoyer par email")).not.toBeNull();
    expect(screen.queryByText("Préparer une relance")).not.toBeNull();
  });

  it("canal inconnu : « Envoyé le » et alerte d'origine", async () => {
    const c = await afficher();
    expect(c.textContent).toContain("Envoyé le");
    expect(c.textContent).toContain(ALERTE_LIEN);
  });

  it("lecture du canal en échec : la page s'affiche comme avant", async () => {
    etat.canal = "rejet";
    const c = await afficher();
    expect(c.textContent).toContain("Envoyé le");
    expect(c.textContent).not.toContain("Remis en main propre le");
    expect(c.textContent).toContain(ALERTE_LIEN);
  });
});

describe("fiche devis : liens PDF et rôle", () => {
  it("lecteur : ni PDF, ni aperçu, ni exemplaire signé, ni relance", async () => {
    etat.role = "reader";
    etat.peutEcrire = false;
    etat.signatures = [{ partie: "client" }];
    etat.canal = "email";
    const c = await afficher();
    expect(c.textContent).not.toContain("Ouvrir le devis (PDF)");
    expect(c.textContent).not.toContain("Voir l'aperçu PDF");
    expect(c.textContent).not.toContain("exemplaire signé");
    expect(c.textContent).not.toContain("Préparer une relance");
  });

  it("lecteur, devis envoyé non signé, canal email : pas de « Préparer une relance »", async () => {
    etat.role = "reader";
    etat.peutEcrire = false;
    etat.signatures = [];
    etat.canal = "email";
    const c = await afficher();
    expect(c.textContent).not.toContain("Préparer une relance");
  });

  it("rôle qui peut écrire, même état : le bouton est là", async () => {
    etat.role = "admin";
    etat.peutEcrire = true;
    etat.signatures = [];
    etat.canal = "email";
    const c = await afficher();
    expect(c.textContent).toContain("Préparer une relance");
  });

  it("lecteur, brouillon : pas d'aperçu PDF", async () => {
    etat.role = "reader";
    etat.devis = { ...base, statut: "brouillon", sentAt: null };
    expect((await afficher()).textContent).not.toContain("Voir l'aperçu PDF");
  });

  it("admin : PDF, exemplaire signé et relance présents", async () => {
    etat.signatures = [{ partie: "client" }];
    etat.canal = "email";
    let c = await afficher();
    expect(c.textContent).toContain("Ouvrir le devis (PDF)");
    expect(c.textContent).toContain("exemplaire signé");
    cleanup();
    vi.resetModules();
    etat.signatures = [];
    c = await afficher();
    expect(c.textContent).toContain("Préparer une relance");
    cleanup();
    vi.resetModules();
    etat.devis = { ...base, statut: "brouillon", sentAt: null };
    expect((await afficher()).textContent).toContain("Voir l'aperçu PDF");
  });

  it("rôle qui peut écrire mais sans droit conclure_devis : pas de « Marquer accepté » sur un devis envoyé", async () => {
    etat.role = "secretaire";
    etat.peutEcrire = true;
    etat.canal = "email";
    const c = await afficher();
    expect(c.textContent).toContain("Préparer une relance");
    expect(screen.queryByText("Marquer accepté")).toBeNull();
  });
});
