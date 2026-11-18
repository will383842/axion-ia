/**
 * X3 — la fiche d'un devis CLASSIQUE signé des deux parties propose de préparer la confirmation
 * de commande quand elle n'existe pas encore. Les devis à formules gardent leur propre bloc.
 */
import { cleanup, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NOW = new Date("2030-01-01T00:00:00Z");
const etat = vi.hoisted(() => ({
  devis: {} as Record<string, unknown>,
  signatures: [] as Array<{ partie: string }>,
  annulee: null as Date | null,
  confirmation: "aucune" as "aucune" | "a_valider" | "autre",
}));

const base = {
  id: "d1",
  numero: "AXI-DEV-2030-001",
  clientId: "c1",
  statut: "accepte",
  montantTotalHtCents: 100000,
  montantOpcoEstimeCents: null,
  resteAChargeCents: null,
  financementSuggere: null,
  opcoEstimationOrigine: null,
  opcoEstimationAvertissement: null,
  dateValidite: NOW,
  updatedAt: NOW,
  sentAt: null,
  acceptedAt: NOW,
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

vi.mock("@/server/auth/garde-page", () => ({
  gardePage: () => Promise.resolve({ autorise: true, role: "admin", peutEcrire: true }),
}));
vi.mock("@/server/qualiopi/crm/devis", () => ({
  getDevis: () => Promise.resolve(etat.devis),
}));
vi.mock("@/server/qualiopi/crm/clients", () => ({
  getClient: () => Promise.resolve({ id: "c1", raisonSociale: "Client fictif" }),
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
            documentGenere: { annuleeAt: etat.annulee },
          })),
        ),
    },
    planRecurrent: { count: () => Promise.resolve(0) },
    emailOutbox: { findFirst: () => Promise.resolve(null) },
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
  etatConfirmationCommande: () => Promise.resolve(etat.confirmation),
}));
vi.mock("@/server/actions/qualiopi/piece-signature", () => ({
  contresignerPieceAction: vi.fn(),
  relancerAcceptationDevisAction: vi.fn(),
}));
vi.doMock("@/components/admin/qualiopi/RelancerAcceptationDevis", () => ({
  RelancerAcceptationDevis: ({ cas }: { cas: string }) => <p data-testid="relance">{cas}</p>,
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
]) {
  vi.doMock(`@/components/admin/qualiopi/${c}`, () => ({ [c]: () => null }));
}

const TEXTE_PREPAREE =
  "La confirmation de commande est préparée : elle attend votre validation dans les e-mails à valider.";

async function afficherPage(): Promise<HTMLElement> {
  const { default: Page } = await import("../[id]/page");
  const ui = await Page({
    params: Promise.resolve({ locale: "fr", adminPrefix: "adm", id: "d1" }),
  });
  return render(ui).container;
}

async function afficher(): Promise<string[]> {
  const container = await afficherPage();
  return [...container.querySelectorAll('[data-testid="relance"]')].map((n) => n.textContent ?? "");
}

describe("fiche devis : relance de la confirmation de commande (devis classique)", () => {
  beforeEach(() => {
    vi.resetModules();
    etat.devis = { ...base };
    etat.signatures = [{ partie: "client" }, { partie: "axionia" }];
    etat.annulee = null;
    etat.confirmation = "aucune";
  });

  it("classique signé des deux parties, accepté, sans confirmation : bloc affiché", async () => {
    expect(await afficher()).toEqual(["confirmation-classique"]);
  });

  it("statut transforme_convention : bloc affiché", async () => {
    etat.devis = { ...base, statut: "transforme_convention" };
    expect(await afficher()).toEqual(["confirmation-classique"]);
  });

  it("confirmation à valider : ligne d'information persistante avec lien, sans bloc", async () => {
    etat.confirmation = "a_valider";
    const c = await afficherPage();
    expect(c.querySelector('[data-testid="relance"]')).toBeNull();
    expect(c.textContent).toContain(TEXTE_PREPAREE);
    const lien = [...c.querySelectorAll("a")].find((a) =>
      a.getAttribute("href")?.endsWith("/qualiopi/emails"),
    );
    expect(lien?.getAttribute("href")).toBe("/fr/adm/qualiopi/emails");
  });

  it("confirmation approuvée, envoyée, refusée ou au journal : rien de nouveau", async () => {
    etat.confirmation = "autre";
    const c = await afficherPage();
    expect(c.querySelector('[data-testid="relance"]')).toBeNull();
    expect(c.textContent).not.toContain(TEXTE_PREPAREE);
  });

  it("aucune confirmation : bloc affiché, pas de ligne d'information", async () => {
    const c = await afficherPage();
    expect(c.querySelector('[data-testid="relance"]')).not.toBeNull();
    expect(c.textContent).not.toContain(TEXTE_PREPAREE);
  });

  it("après une préparation réussie, la page relue porte l'information de l'état « à valider »", async () => {
    expect(await afficher()).toEqual(["confirmation-classique"]);
    cleanup();
    vi.resetModules();
    etat.confirmation = "a_valider"; // ce que la base rend après la préparation
    const c = await afficherPage();
    expect(c.querySelector('[data-testid="relance"]')).toBeNull();
    expect(c.textContent).toContain(TEXTE_PREPAREE);
  });

  it("état « à valider » mais devis non contresigné ou annulé : aucune ligne", async () => {
    etat.confirmation = "a_valider";
    etat.signatures = [{ partie: "client" }];
    expect((await afficherPage()).textContent).not.toContain(TEXTE_PREPAREE);
  });

  it("devis portant une offre sans empreinte : pas classique, aucun bloc ni ligne", async () => {
    etat.devis = { ...base, offre: {}, offreSha256: null };
    expect(await afficher()).toEqual([]);
    cleanup();
    etat.confirmation = "a_valider";
    expect((await afficherPage()).textContent).not.toContain(TEXTE_PREPAREE);
  });

  it("devis non contresigné : bloc non affiché", async () => {
    etat.signatures = [{ partie: "client" }];
    expect(await afficher()).toEqual([]);
  });

  it("pièce annulée : bloc non affiché", async () => {
    etat.annulee = NOW;
    expect(await afficher()).toEqual([]);
  });

  it("statut envoyé (pas encore accepté) : bloc non affiché", async () => {
    etat.devis = { ...base, statut: "envoye" };
    expect(await afficher()).toEqual([]);
  });

  it("devis à formules : le bloc classique n'apparaît pas", async () => {
    etat.devis = { ...base, offre: {}, offreSha256: "a".repeat(64), formuleRetenue: "achat" };
    expect(await afficher()).not.toContain("confirmation-classique");
  });
});
