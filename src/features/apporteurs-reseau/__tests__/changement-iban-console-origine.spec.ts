/**
 * Lot 9 du plan `docs/plans/apporteurs-changement-iban-2026-11-25.md` : demande ouverte depuis la console pour une fiche retirée ou résiliée avec de l'argent dû.
 * Tout l'extérieur est simulé (base, file d'e-mails, limite de débit, antivirus) ; le chiffrement,
 * l'empreinte, les règles de délai et les liens signés sont les VRAIS.
 * IBAN de test : IBAN fictifs de documentation, jamais réels.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const IBAN_ANCIEN = "FR1420041010050500013M02606";
const IBAN_NEUF = "FR7630006000011234567890189";
const ID = "11111111-1111-4111-8111-111111111111";
const APPORTEUR = "33333333-3333-4333-8333-333333333333";
const ADMIN = "55555555-5555-4555-8555-555555555555";

vi.hoisted(() => {
  process.env["PII_ENCRYPTION_KEY"] = "a".repeat(64);
  process.env["IBAN_EMPREINTE_SECRET"] = "secret-de-test-empreinte";
  process.env["APPORTEUR_CHANGEMENT_IBAN_ENABLED"] = "true";
  process.env["AUTH_SECRET"] = "secret-de-test-auth";
});

const m = vi.hoisted(() => {
  const f = () => vi.fn();
  const prisma = {
    apporteurReseau: { findUnique: f(), update: f() },
    apporteurChangementIban: {
      findUnique: f(),
      findMany: f(),
      create: f(),
      updateMany: f(),
    },
    apporteurChangementIbanRib: { create: f(), findUnique: f() },
    apporteurIbanHistorique: { findMany: f(), findFirst: f(), create: f(), updateMany: f() },
    pieceApporteur: { findFirst: f(), updateMany: f(), create: f() },
    $transaction: f(),
  };
  return {
    prisma,
    envoyer: f(),
    journaliser: f(),
    checkRateLimit: f(),
    controlerPiece: f(),
    retraitDe: f(),
    argentEnJeu: f(),
    enqueueEmail: f(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.checkRateLimit }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: m.journaliser }));
vi.mock("@/server/pieces/depot-controle", async (orig) => ({
  ...(await orig<typeof import("@/server/pieces/depot-controle")>()),
  controlerPiece: m.controlerPiece,
}));
vi.mock("../envois", () => ({ envoyer: m.envoyer }));
vi.mock("../retrait", async (orig) => ({
  ...(await orig<typeof import("../retrait")>()),
  retraitDe: m.retraitDe,
  argentEnJeu: m.argentEnJeu,
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: m.enqueueEmail }));

import { encryptPii } from "@/lib/pii-crypto";
import { chiffrerContenuPiece } from "../pieces-chiffrement";
import { empreinteIban } from "@/lib/iban-empreinte";
import { demanderChangementIban, validerDemande } from "../changement-iban";

const MAINTENANT = new Date();
const RIB = { nom: "rib.pdf", octets: new Uint8Array([37, 80, 68, 70]) };
const ADMIN_FACTURER = { id: ADMIN, role: "admin" };
const SUPER = { id: ADMIN, role: "super_admin" };

const fiche = (over: Record<string, unknown> = {}) => ({
  id: APPORTEUR,
  statut: "resilie",
  prenom: encryptPii("Jeanne"),
  email: encryptPii("jeanne@exemple.fr"),
  telephone: encryptPii("0612345678"),
  iban: encryptPii(IBAN_ANCIEN),
  versionLien: 1,
  resilieAt: new Date(),
  refuseAt: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(m.prisma));
  m.checkRateLimit.mockResolvedValue({
    allowed: true,
    count: 1,
    remaining: 4,
    resetAt: 0,
    panne: false,
  });
  m.controlerPiece.mockResolvedValue({
    ok: true,
    typeMime: "application/pdf",
    taille: 4,
    sha256: "b".repeat(64),
  });
  m.retraitDe.mockResolvedValue(new Date());
  m.argentEnJeu.mockResolvedValue(true);
  m.envoyer.mockResolvedValue("envoye");
  m.journaliser.mockResolvedValue(true);
  m.prisma.apporteurReseau.findUnique.mockResolvedValue(fiche());
  m.prisma.apporteurChangementIban.findMany.mockResolvedValue([]);
  m.prisma.apporteurChangementIban.updateMany.mockResolvedValue({ count: 1 });
  m.prisma.apporteurChangementIban.create.mockResolvedValue({});
  m.prisma.apporteurChangementIbanRib.create.mockResolvedValue({});
});

const entree = (over: Record<string, unknown> = {}) => ({
  apporteurId: APPORTEUR,
  iban: IBAN_NEUF,
  rib: RIB,
  ip: null,
  userAgent: null,
  origine: "console" as const,
  acteur: ADMIN_FACTURER,
  ...over,
});

describe("demande ouverte par la console (lot 9)", () => {
  it("une fiche retirée ou résiliée AVEC de l'argent dû : la demande est créée, origine « console »", async () => {
    const r = await demanderChangementIban(entree());
    expect(r.ok).toBe(true);
    expect(m.prisma.apporteurChangementIban.create.mock.calls[0]?.[0].data.origine).toBe("console");
  });
  it("le même e-mail de confirmation part, à l'adresse de la FICHE", async () => {
    await demanderChangementIban(entree());
    const a = m.envoyer.mock.calls.find(
      (c) => c[0].gabarit === "apporteur-compte-a-confirmer",
    )?.[0];
    expect(a?.destinataire).toBe("jeanne@exemple.fr");
  });
  it("sans argent dû : refus, rien n'est écrit", async () => {
    m.argentEnJeu.mockResolvedValue(false);
    expect((await demanderChangementIban(entree())).ok).toBe(false);
    expect(m.prisma.apporteurChangementIban.create).not.toHaveBeenCalled();
  });
  it("sans acteur habilité à facturer (rôle lecture) : refus", async () => {
    const r = await demanderChangementIban(entree({ acteur: { id: ADMIN, role: "reader" } }));
    expect(r.ok).toBe(false);
    expect(m.prisma.apporteurChangementIban.create).not.toHaveBeenCalled();
  });
  it("l'origine « espace » reste refusée pour une fiche retirée (inchangé)", async () => {
    const { origine: _o, acteur: _a, ...sansConsole } = entree();
    void _o;
    void _a;
    expect((await demanderChangementIban(sansConsole)).ok).toBe(false);
    expect(m.prisma.apporteurChangementIban.create).not.toHaveBeenCalled();
  });
  it("une fiche sans téléphone ne peut pas non plus demander depuis la console", async () => {
    m.prisma.apporteurReseau.findUnique.mockResolvedValue(fiche({ telephone: null }));
    expect((await demanderChangementIban(entree())).ok).toBe(false);
  });
});

describe("validation d'une demande « console » : mêmes barrières", () => {
  const demande = (over: Record<string, unknown> = {}) => ({
    id: ID,
    apporteurId: APPORTEUR,
    statut: "confirmee",
    origine: "console",
    iban: encryptPii(IBAN_NEUF, { aad: `changement-iban:${ID}`, cleExigee: true }),
    ibanEmpreinte: empreinteIban(IBAN_NEUF),
    ibanFin4: "0189",
    ancienIbanEmpreinte: empreinteIban(IBAN_ANCIEN),
    ancienIbanFin4: "2606",
    demandeeAt: new Date(MAINTENANT.getTime() - 100 * 3600_000),
    confirmeeAt: new Date(MAINTENANT.getTime() - 73 * 3600_000),
    avisEnvoyeAt: new Date(MAINTENANT.getTime() - 73 * 3600_000),
    ...over,
  });
  const CASES = { titulaire: true, iban: true, rappel: true };
  beforeEach(() => {
    m.prisma.apporteurChangementIban.findUnique.mockResolvedValue(demande());
  });
  it("l'administrateur ordinaire ne valide pas", async () => {
    const r = await validerDemande({
      demandeId: ID,
      acteur: ADMIN_FACTURER,
      cases: CASES,
      ibanRecopie: IBAN_NEUF,
    });
    expect(r.ok).toBe(false);
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });
  it("sans confirmation de l'apporteur : refus, même par le super_admin", async () => {
    m.prisma.apporteurChangementIban.findUnique.mockResolvedValue(
      demande({ statut: "a_confirmer", confirmeeAt: null }),
    );
    const r = await validerDemande({
      demandeId: ID,
      acteur: SUPER,
      cases: CASES,
      ibanRecopie: IBAN_NEUF,
    });
    expect(r.ok).toBe(false);
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });
  it("avant 72 h : refus", async () => {
    m.prisma.apporteurChangementIban.findUnique.mockResolvedValue(
      demande({ confirmeeAt: new Date(MAINTENANT.getTime() - 71 * 3600_000) }),
    );
    expect(
      (await validerDemande({ demandeId: ID, acteur: SUPER, cases: CASES, ibanRecopie: IBAN_NEUF }))
        .ok,
    ).toBe(false);
  });
  it("super_admin, trois cases, bon IBAN, 72 h écoulées, argent dû : la fiche retirée est acceptée", async () => {
    m.prisma.apporteurChangementIbanRib.findUnique.mockResolvedValue({
      demandeId: ID,
      octets: chiffrerContenuPiece(Buffer.from("%PDF-1.4")),
      sha256: "b".repeat(64),
      typeMime: "application/pdf",
      taille: 4,
      nomFichier: "rib.pdf",
    });
    m.prisma.apporteurIbanHistorique.findMany.mockResolvedValue([]);
    m.prisma.apporteurIbanHistorique.updateMany.mockResolvedValue({ count: 0 });
    m.prisma.pieceApporteur.findFirst.mockResolvedValue({
      id: "66666666-6666-4666-8666-666666666666",
    });
    m.prisma.pieceApporteur.updateMany.mockResolvedValue({ count: 1 });
    m.prisma.pieceApporteur.create.mockResolvedValue({
      id: "77777777-7777-4777-8777-777777777777",
    });
    m.prisma.apporteurReseau.update.mockResolvedValue({ versionLien: 2 });
    m.prisma.apporteurIbanHistorique.create.mockResolvedValue({});
    const r = await validerDemande({
      demandeId: ID,
      acteur: SUPER,
      cases: CASES,
      ibanRecopie: IBAN_NEUF,
    });
    expect(r.ok).toBe(true);
  });
  it("la même demande d'origine « espace » reste refusée pour une fiche retirée", async () => {
    m.prisma.apporteurChangementIban.findUnique.mockResolvedValue(demande({ origine: "espace" }));
    const r = await validerDemande({
      demandeId: ID,
      acteur: SUPER,
      cases: CASES,
      ibanRecopie: IBAN_NEUF,
    });
    expect(r.ok).toBe(false);
  });
});
