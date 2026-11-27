/**
 * Fiche d'un devis : la mention « Prolongée (le PDF indique le …) » compare la date imprimée sur
 * le PDF à la validité EN COURS formatée comme le PDF l'imprime (`toLocaleDateString("fr-FR")`),
 * pas en fuseau de Paris : sinon un devis créé à 0 h 30 heure de Paris, jamais prolongé, affichait
 * la mention à tort. Lecture seule.
 */
import { cleanup, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NOW = new Date("2030-01-01T00:00:00Z");
const etat = vi.hoisted(() => ({
  devis: {} as Record<string, unknown>,
  signatures: [] as Array<{ partie: string }>,
  annulee: null as Date | null,
  confirmation: "aucune" as "aucune" | "a_valider" | "autre",
  enAttente: false,
  lectures: 0,
  metadata: null as unknown,
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

// L'action de versement du scan papier tire next-auth : la fiche ne fait que la transmettre.
vi.mock("@/server/actions/qualiopi/devis-scan-papier", () => ({
  verserScanDevisSigneAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), notFound: vi.fn() }));
vi.mock("@/server/auth/garde-page", () => ({
  gardePage: () => Promise.resolve({ autorise: true, role: "admin", peutEcrire: true }),
}));
vi.mock("@/server/qualiopi/crm/devis", () => ({
  getDevis: () => Promise.resolve(etat.devis),
}));
vi.mock("@/server/qualiopi/crm/clients", () => ({
  getClient: () => Promise.resolve({ id: "c1", raisonSociale: "Client fictif" }),
}));
vi.mock("@/server/actions/qualiopi/devis-delai-client", () => ({
  demanderDelaiClientAction: vi.fn(),
  leverDelaiClientAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/devis-prolonger-validite", () => ({
  prolongerValiditeDevisAction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    factureFormation: { findMany: () => Promise.resolve([]) },
    devis: {
      findFirst: () => Promise.resolve(null),
      findUnique: () =>
        Promise.resolve({ documentGenere: { annuleeAt: null, metadata: etat.metadata } }),
    },
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
    emailOutbox: {
      findFirst: () => {
        etat.lectures += 1;
        return Promise.resolve(etat.enAttente ? { id: "ob1" } : null);
      },
    },
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

const meta = (dateValidite: string) => ({ renderData: { data: { dateValidite } } });
// 0 h 30 le 15/06/2030 à Paris (22 h 30 la veille en UTC) : les deux fuseaux ne donnent pas le
// même jour.
const VALIDITE = new Date("2030-06-14T22:30:00Z");

async function mention(): Promise<string | null> {
  const { default: Page } = await import("../[id]/page");
  const ui = await Page({
    params: Promise.resolve({ locale: "fr", adminPrefix: "adm", id: "d1" }),
  });
  const n = render(ui).container.querySelector('[data-testid="validite-prolongee"]');
  return n?.textContent ?? null;
}

describe("fiche devis : mention « Prolongée »", () => {
  beforeEach(() => {
    cleanup();
    vi.resetModules();
    etat.devis = { ...base, statut: "envoye", dateValidite: VALIDITE };
    etat.signatures = [];
    etat.annulee = null;
    etat.confirmation = "autre";
    etat.enAttente = false;
    etat.metadata = null;
  });

  it("créé à 0 h 30 heure de Paris, jamais prolongé : aucune mention", async () => {
    etat.metadata = meta(VALIDITE.toLocaleDateString("fr-FR"));
    expect(await mention()).toBeNull();
  });

  it("prolongé après l'envoi : la mention indique la date du PDF", async () => {
    etat.metadata = meta("01/06/2030");
    expect(await mention()).toBe("Prolongée (le PDF indique le 01/06/2030).");
  });

  it("aucune photo de pièce : aucune mention", async () => {
    etat.metadata = null;
    expect(await mention()).toBeNull();
  });
});
