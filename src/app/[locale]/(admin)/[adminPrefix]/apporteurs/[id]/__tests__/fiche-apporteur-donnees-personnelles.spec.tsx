/**
 * La fiche d'un apporteur porte e-mail, téléphone, adresse, IBAN et pièces d'identité.
 * Un compte `reader` (consultation) n'en lit rien ; un administrateur voit tout.
 * Les pièces purgées n'ont ni lien ni bouton « Ouvrir ».
 *
 * VRAIE page, VRAIE `gardePage`, session et lecture doublées.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("@/auth", () => ({ auth: () => Promise.resolve(d.session) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/features/apporteurs-reseau/actions-apporteurs", () => ({
  jugerPieceAction: vi.fn(),
  decisionDossierAction: vi.fn(),
}));
vi.mock("@/components/admin/apporteurs/fiche/BlocsFiche", () => ({
  EnvoiLienDossier: () => null,
  ParrainEtNote: () => null,
}));
vi.mock("@/components/admin/apporteurs/fiche/DecisionDossier", () => ({
  DecisionDossier: () => null,
}));
vi.mock("@/components/admin/apporteurs/fiche/FinDeVieEtVigilance", () => ({
  CumulVigilance: () => null,
  FinDeVie: () => null,
  SoldeNegatifFiche: () => null,
}));
// Solde négatif (art. 12.4) : hors du sujet de ce test, simulé.
vi.mock("@/features/apporteurs-reseau/solde-negatif", () => ({
  lireSoldeNegatif: async () => null,
}));
vi.mock("@/features/apporteurs-reseau/siret-apporteur", () => ({ siretDe: async () => null }));
vi.mock("@/features/apporteurs-reseau/preavis", async (orig) => ({
  ...(await orig<typeof import("@/features/apporteurs-reseau/preavis")>()),
  lireResiliation: async () => null,
}));
// Retirer / supprimer (2026-10-07) : hors du sujet de ce test, simulés.
vi.mock("@/components/admin/apporteurs/fiche/RetraitDuReseau", () => ({
  RetraitDuReseau: () => null,
}));
vi.mock("@/features/apporteurs-reseau/retrait", () => ({
  retraitDe: async () => null,
  etatSuppression: async () => null,
  refusSuppression: () => null,
}));
vi.mock("@/features/apporteurs-reseau/requetes-console", async () => {
  const fiche = {
    dossier: {
      id: "8a1c2f3e-1111-4222-8333-444455556666",
      statut: "a_verifier",
      prenom: "Camille",
      nom: "Durand",
      email: "camille.durand@exemple.test",
      telephone: "0611223344",
      siren: "123456789",
      denomination: "Durand Conseil",
      adresse: "12 rue des Lilas, 69003 Lyon",
      codeNaf: "7022Z",
      statutJuridique: "ei",
      regimeTva: "franchise",
      numeroTva: null,
      ibanMasque: "FR76 •••• •••• 1234",
      declarations: {},
      dernierMessage: null,
      signeParApporteurAt: null,
      signeParSocieteAt: null,
      pieces: [
        {
          id: "aaaaaaaa-1111-4222-8333-444455556666",
          type: "identite",
          statut: "conforme",
          motif: null,
          nomFichier: "cni.pdf",
          deposeeAt: new Date("2026-10-01T10:00:00Z"),
        },
        {
          id: "bbbbbbbb-1111-4222-8333-444455556666",
          type: "rib",
          statut: "deposee",
          motif: null,
          nomFichier: "rib.pdf",
          deposeeAt: new Date("2026-10-01T10:00:00Z"),
        },
      ],
    },
    piecesPurgeesIds: ["aaaaaaaa-1111-4222-8333-444455556666"],
    aContratApporteur: true,
    aContratSigne: false,
    filleuls: [],
    parrainsPossibles: [],
    parrainId: null,
    noteInterne: null,
    entreprises: [],
    commissions: [],
    vigilance: { cumulCents: 0, seuilCents: 500000, piecesConformes: false, piecesEnAttente: 0 },
  };
  return {
    LIBELLE_STATUT_APPORTEUR: { a_verifier: "À vérifier" },
    lireFicheApporteur: () => Promise.resolve(fiche),
  };
});

import Page from "@/app/[locale]/(admin)/[adminPrefix]/apporteurs/[id]/page";

beforeEach(() => vi.clearAllMocks());

async function rendre(role: string): Promise<string> {
  d.session = { user: { id: "u1", role } };
  const element = await Page({
    params: Promise.resolve({
      adminPrefix: "console",
      id: "8a1c2f3e-1111-4222-8333-444455556666",
    }),
    searchParams: Promise.resolve({}),
  });
  return renderToStaticMarkup(element);
}

describe("fiche apporteur : données personnelles selon le rôle", () => {
  it("un administrateur voit e-mail, téléphone, adresse, IBAN masqué et pièces", async () => {
    const html = await rendre("admin");
    expect(html).toContain("camille.durand@exemple.test");
    expect(html).toContain("0611223344");
    expect(html).toContain("12 rue des Lilas");
    expect(html).toContain("FR76 •••• •••• 1234");
    expect(html).toContain("rib.pdf");
    expect(html).toContain("Contrat signé par l&#x27;apporteur");
  });

  it("un compte lecteur ne voit ni e-mail, ni téléphone, ni adresse, ni IBAN, ni pièces, ni contrat", async () => {
    const html = await rendre("reader");
    for (const interdit of [
      "camille.durand@exemple.test",
      "0611223344",
      "12 rue des Lilas",
      "FR76",
      "cni.pdf",
      "rib.pdf",
      "/pieces/",
      "/contrat?",
    ])
      expect(html).not.toContain(interdit);
    expect(html).toContain("Réservé aux rôles autorisés");
    expect(html).toContain("Camille Durand");
  });

  it("une pièce purgée affiche « Purgée après vérification », sans lien ni bouton Ouvrir", async () => {
    const html = await rendre("admin");
    expect(html).toContain("Purgée après vérification");
    expect(html).not.toContain('aaaaaaaa-1111-4222-8333-444455556666"');
    expect(html).toContain("/pieces/bbbbbbbb-1111-4222-8333-444455556666");
    expect(html.match(/>Ouvrir</g)).toHaveLength(1);
  });
});
