/**
 * Page de signature : un DEVIS signé par le CLIENT affiche les mentions `devis-v1` ; toute autre
 * pièce garde les mentions `MENTION_VERSION_DOCUMENT`, inchangées.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  verif: vi.fn(),
  lire: vi.fn(),
  piece: vi.fn(),
  devisLie: vi.fn(),
  count: vi.fn(),
  formulaire: vi.fn(),
  mentions: vi.fn(),
  identite: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  verifierTokenDocument: (...a: unknown[]) => m.verif(...a),
  statutDevisDuLien: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: (...a: unknown[]) => m.piece(...a) },
    documentSignature: { count: (...a: unknown[]) => m.count(...a) },
    devis: { findFirst: (...a: unknown[]) => m.devisLie(...a) },
  },
}));
vi.mock("@/lib/r2-storage", () => ({}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: async () => m.identite(),
}));
vi.mock("@/server/qualiopi/documents/signature/devis-signature-queries", () => ({
  lireDevisASigner: (...a: unknown[]) => m.lire(...a),
}));
// `mentions-document` est MOQUÉ : la page ne doit pas l'appeler pour un devis client.
vi.mock("@/server/qualiopi/documents/signature/mentions-document", () => ({
  MENTION_VERSION_DOCUMENT: "doc-v2",
  mentionCompleteDocument: (...a: unknown[]) => {
    m.mentions(...a);
    return ["TEXTE-DOCUMENT"];
  },
}));
vi.mock("@/server/qualiopi/devis/choix-signature", () => ({
  devisSignableParFormules: () => true,
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: async () => true,
}));
vi.mock("@/components/portail/PieceSignatureForm", () => ({
  PieceSignatureForm: (p: unknown) => {
    m.formulaire(p);
    return "FORMULAIRE_SIGNATURE";
  },
}));
vi.mock("@/server/actions/qualiopi/piece-signature", () => ({
  apercuChoixAction: vi.fn(),
  demanderCodeDevisAction: vi.fn(),
  demanderCodeSignatureAction: vi.fn(),
  signerPieceParJetonAction: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/signature/contrat-cadre-signature", () => ({
  codeRequis: () => false,
}));
vi.mock("@/lib/content-disposition", () => ({ lienTelechargement: (x: string) => x }));

import SignerDevisPage from "./page";
import { sha256Offre } from "@/server/qualiopi/devis/offre-calculs";
import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";
import { mentionCompleteDevisV1 } from "@/server/qualiopi/documents/signature/mentions-devis";

async function rendu(): Promise<string> {
  const el = await SignerDevisPage({ params: Promise.resolve({ locale: "fr", token: "t" }) });
  return renderToStaticMarkup(el as never);
}

const MOTS_INTERDITS =
  /qualiopi|\bopco\b|financ|prise en charge|certifi|\bcpf\b|\bformation|organisme|grenoble|code du travail|horodatage qualifi|portabilit|17\.3\.b\b/i;

const DEVIS = {
  devisId: "d1",
  numero: "AXI-DEV-2026-014",
  dateValiditeLisible: "31/12/2026",
  clientRaisonSociale: "C",
  lignes: [],
  totalHtLisible: "",
  totalTtcLisible: "",
  mentionTva: null,
  conditionsParticulieres: null,
  chiffrageIndisponible: false,
  statutBloquant: null,
};

const piece = (over: Record<string, unknown> = {}) => ({
  numero: "AXI-DOC-2026-077",
  type: "devis",
  pdfUrl: null,
  createdAt: new Date(),
  annuleeAt: null,
  metadata: null,
  client: null,
  trainee: null,
  sousTraitant: null,
  session: null,
  ...over,
});

function props(): { mentions: string[]; mentionVersion: string } {
  return m.formulaire.mock.calls[0]?.[0] as { mentions: string[]; mentionVersion: string };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["DATABASE_URL"] = "postgresql://u:p@db:5432/x";
  m.identite.mockReturnValue({ raisonSociale: "Axion-IA SAS", email: "contact@axion-ia.com" });
  m.verif.mockResolvedValue({
    ok: true,
    documentGenereId: "doc1",
    partie: "client",
    signataireNom: "S",
    signataireQualite: "Q",
  });
  m.piece.mockResolvedValue(piece());
  m.count.mockResolvedValue(0);
  m.lire.mockResolvedValue(DEVIS);
  m.devisLie.mockResolvedValue({
    numero: DEVIS.numero,
    clientId: "client-1",
    offre: null,
    offreSha256: null,
    dateValidite: new Date(),
  });
});

describe("page de signature — devis, partie client : mentions devis-v1", () => {
  it("transmet `devis-v1` et les mentions du module devis, sans appeler celui des autres pièces", async () => {
    await rendu();
    const p = props();
    expect(p.mentionVersion).toBe("devis-v1");
    expect(p.mentions).toStrictEqual(
      mentionCompleteDevisV1(
        {
          numeroDevis: "AXI-DEV-2026-014",
          prestataire: "Axion-IA SAS",
          contact: "contact@axion-ia.com",
        },
        false,
      ),
    );
    expect(m.mentions).not.toHaveBeenCalled();
  });

  it("le texte affiché dit « signature électronique simple » et ne contient aucun mot interdit", async () => {
    await rendu();
    const texte = props().mentions.join("\n");
    expect(texte).toContain("signature électronique simple");
    expect(texte).not.toMatch(MOTS_INTERDITS);
  });

  it("contact : adresse non simple ou absente → contact par défaut", async () => {
    m.identite.mockReturnValue({ raisonSociale: "Axion-IA SAS", email: "pas une adresse" });
    await rendu();
    expect(props().mentions.join("\n")).toContain("joignable à contact@axion-ia.com.");
  });

  it("contact : adresse simple de l'identité (après trim)", async () => {
    m.identite.mockReturnValue({ raisonSociale: "Axion-IA SAS", email: "  hello@axion.test " });
    await rendu();
    expect(props().mentions.join("\n")).toContain("joignable à hello@axion.test.");
  });

  it("devis à formules : l'élément d'index 3 est la variante « code à usage unique »", async () => {
    const offre = offreFictive();
    m.devisLie.mockResolvedValue({
      numero: DEVIS.numero,
      clientId: "client-1",
      offre,
      offreSha256: sha256Offre(offre),
      dateValidite: new Date(),
    });
    await rendu();
    const p = props();
    expect(p.mentionVersion).toBe("devis-v1");
    expect(p.mentions[3]).toContain("code à usage unique");
  });

  it("devis classique : l'élément d'index 3 est la variante sans code", async () => {
    await rendu();
    expect(props().mentions[3]).toBe("J'accepte de signer ce devis par voie électronique.");
  });
});

describe("page de signature — autre pièce : inchangée", () => {
  it("convention : `MENTION_VERSION_DOCUMENT` et textes du module des autres pièces", async () => {
    m.piece.mockResolvedValue(piece({ type: "convention", numero: "AXI-DOC-2026-039" }));
    await rendu();
    const p = props();
    expect(p.mentionVersion).toBe("doc-v2");
    expect(p.mentions).toStrictEqual(["TEXTE-DOCUMENT"]);
    expect(m.mentions).toHaveBeenCalledTimes(1);
  });
});
