/**
 * B2, PR 5 — la fiche d'un devis porte le badge « E-mail à valider » quand un e-mail d'envoi
 * attend (brouillon), et « E-mail du devis à valider » pour un ancien devis « envoyé »
 * dont la ligne est encore à valider. Lecture seule.
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
      findUnique: () => Promise.resolve({ documentGenere: { annuleeAt: null } }),
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

async function badge(): Promise<{ texte: string | null; href: string | null }> {
  const { default: Page } = await import("../[id]/page");
  const ui = await Page({
    params: Promise.resolve({ locale: "fr", adminPrefix: "adm", id: "d1" }),
  });
  const n = render(ui).container.querySelector('[data-testid="badge-email-devis"]');
  return { texte: n?.textContent ?? null, href: n?.getAttribute("href") ?? null };
}

describe("fiche devis : badge « E-mail à valider »", () => {
  beforeEach(() => {
    cleanup();
    vi.resetModules();
    etat.devis = { ...base };
    etat.signatures = [];
    etat.annulee = null;
    etat.confirmation = "autre";
    etat.enAttente = false;
    etat.lectures = 0;
  });

  it("brouillon avec e-mail en attente : badge, lien vers les e-mails à valider", async () => {
    etat.enAttente = true;
    expect(await badge()).toEqual({
      texte: "E-mail à valider",
      href: "/fr/adm/qualiopi/emails",
    });
  });

  it("brouillon sans e-mail en attente : pas de badge", async () => {
    expect((await badge()).texte).toBeNull();
  });

  it("envoyé avec ligne encore à valider : badge « ancien »", async () => {
    etat.devis = { ...base, statut: "envoye" };
    etat.enAttente = true;
    expect((await badge()).texte).toBe("E-mail du devis à valider");
  });

  it("envoyé sans ligne en attente : pas de badge", async () => {
    etat.devis = { ...base, statut: "envoye" };
    expect((await badge()).texte).toBeNull();
  });

  it("accepté : pas de badge et aucune lecture de la file d'e-mails", async () => {
    etat.devis = { ...base, statut: "accepte" };
    etat.enAttente = true;
    expect((await badge()).texte).toBeNull();
    expect(etat.lectures).toBe(0);
  });
});
