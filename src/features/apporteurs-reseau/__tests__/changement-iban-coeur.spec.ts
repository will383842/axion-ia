/**
 * Lot 4 du plan `docs/plans/apporteurs-changement-iban-2026-11-25.md` : le cœur serveur.
 * Tout l'extérieur est simulé (base, file d'e-mails, limite de débit, antivirus) ; le chiffrement,
 * l'empreinte, les règles de délai et les liens signés sont les VRAIS.
 * IBAN de test : IBAN fictifs de documentation, jamais réels.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const IBAN_ANCIEN = "FR1420041010050500013M02606";
const IBAN_NEUF = "FR7630006000011234567890189";
const FIN_NEUF = "0189";
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
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: m.enqueueEmail }));

import { decryptPii, encryptPii } from "@/lib/pii-crypto";
import { chiffrerContenuPiece } from "../pieces-chiffrement";
import { empreinteIban } from "@/lib/iban-empreinte";
import {
  annulerDemande,
  confirmerDemande,
  demanderChangementIban,
  expirerEtAvertir,
  refuserDemande,
  sOpposerALaDemande,
  validerDemande,
} from "../changement-iban";
import { lienBloquerDemande, lienConfirmerDemande } from "../jeton-changement-iban";

const MAINTENANT = new Date();
const sig = (lien: string | null) => (lien ?? "").split("/").pop() ?? "";

function ficheSignee(over: Record<string, unknown> = {}) {
  return {
    id: APPORTEUR,
    statut: "signe",
    prenom: encryptPii("Jeanne"),
    email: encryptPii("jeanne@exemple.fr"),
    telephone: encryptPii("0612345678"),
    iban: encryptPii(IBAN_ANCIEN),
    versionLien: 1,
    resilieAt: null,
    refuseAt: null,
    ...over,
  };
}

function demandeConfirmee(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    apporteurId: APPORTEUR,
    statut: "confirmee",
    iban: encryptPii(IBAN_NEUF, { aad: `changement-iban:${ID}`, cleExigee: true }),
    ibanEmpreinte: empreinteIban(IBAN_NEUF),
    ibanFin4: FIN_NEUF,
    ancienIbanEmpreinte: empreinteIban(IBAN_ANCIEN),
    ancienIbanFin4: "2606",
    demandeeAt: new Date(MAINTENANT.getTime() - 100 * 3600_000),
    confirmeeAt: new Date(MAINTENANT.getTime() - 73 * 3600_000),
    avisEnvoyeAt: new Date(MAINTENANT.getTime() - 73 * 3600_000),
    ...over,
  };
}

const RIB = {
  nom: "RIB_FR7630006000011234567890189.pdf",
  octets: new Uint8Array([37, 80, 68, 70]),
};
const CASES = { titulaire: true, iban: true, rappel: true };
const SUPER = { id: ADMIN, role: "super_admin" };

beforeEach(() => {
  vi.clearAllMocks();
  process.env["APPORTEUR_CHANGEMENT_IBAN_ENABLED"] = "true";
  process.env["IBAN_EMPREINTE_SECRET"] = "secret-de-test-empreinte";
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
  m.retraitDe.mockResolvedValue(null);
  m.envoyer.mockResolvedValue("envoye");
  m.journaliser.mockResolvedValue(true);
  m.enqueueEmail.mockResolvedValue({ enqueued: true });
  m.prisma.apporteurReseau.findUnique.mockResolvedValue(ficheSignee());
  m.prisma.apporteurChangementIban.findMany.mockResolvedValue([]);
  m.prisma.apporteurChangementIban.updateMany.mockResolvedValue({ count: 1 });
  m.prisma.apporteurChangementIban.create.mockResolvedValue({});
  m.prisma.apporteurChangementIban.findUnique.mockResolvedValue(demandeConfirmee());
  m.prisma.apporteurChangementIbanRib.findUnique.mockResolvedValue({
    demandeId: ID,
    octets: chiffrerContenuPiece(Buffer.from("%PDF-1.4")),
    sha256: "b".repeat(64),
    typeMime: "application/pdf",
    taille: 4,
    nomFichier: "rib.pdf",
  });
  m.prisma.apporteurReseau.update.mockResolvedValue({ versionLien: 2 });
  m.prisma.apporteurIbanHistorique.findMany.mockResolvedValue([]);
  m.prisma.apporteurIbanHistorique.updateMany.mockResolvedValue({ count: 0 });
  m.prisma.pieceApporteur.findFirst.mockResolvedValue({
    id: "66666666-6666-4666-8666-666666666666",
  });
  m.prisma.pieceApporteur.updateMany.mockResolvedValue({ count: 1 });
  m.prisma.pieceApporteur.create.mockResolvedValue({ id: "77777777-7777-4777-8777-777777777777" });
});

const demander = (over: Record<string, unknown> = {}) =>
  demanderChangementIban({
    apporteurId: APPORTEUR,
    iban: IBAN_NEUF,
    rib: RIB,
    ip: "203.0.113.9",
    userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36",
    ...over,
  } as Parameters<typeof demanderChangementIban>[0]);

describe("demande", () => {
  it("la demande ne touche jamais la fiche : ni IBAN, ni pièce RIB, ni version du lien", async () => {
    const r = await demander();
    expect(r.ok).toBe(true);
    expect(m.prisma.apporteurReseau.update).not.toHaveBeenCalled();
    expect(m.prisma.pieceApporteur.updateMany).not.toHaveBeenCalled();
    expect(m.prisma.pieceApporteur.create).not.toHaveBeenCalled();
    expect(m.prisma.apporteurChangementIbanRib.create).toHaveBeenCalledTimes(1);
  });

  it("le nouvel IBAN est écrit chiffré (enc:v2, donnée liée à la demande), jamais en clair", async () => {
    await demander();
    const data = m.prisma.apporteurChangementIban.create.mock.calls[0]![0].data;
    expect(data.iban).toMatch(/^enc:v2:/);
    expect(JSON.stringify(data)).not.toContain(IBAN_NEUF);
    expect(decryptPii(data.iban, { aad: `changement-iban:${data.id}`, cleExigee: true })).toBe(
      IBAN_NEUF,
    );
    expect(data.ibanFin4).toBe(FIN_NEUF);
    expect(data.ancienIbanFin4).toBe("2606");
    expect(data.demandeIpHash).not.toContain("203.0.113.9");
    expect(data.demandeNavigateur).toBe("Chrome sur Windows");
  });

  it("le RIB est rangé sous un nom neutre (le nom d'origine peut contenir l'IBAN)", async () => {
    await demander();
    const data = m.prisma.apporteurChangementIbanRib.create.mock.calls[0]![0].data;
    expect(data.nomFichier).toBe("rib.pdf");
  });

  it("la demande commence, dans la même transaction, par expirer les demandes non confirmées de plus de 24 h", async () => {
    await demander();
    const w = m.prisma.apporteurChangementIban.updateMany.mock.calls[0]![0];
    expect(w.where.apporteurId).toBe(APPORTEUR);
    expect(w.where.statut).toBe("a_confirmer");
    expect(w.where.demandeeAt.lt).toBeInstanceOf(Date);
    expect(w.data.statut).toBe("expiree");
    const ordreExpiration =
      m.prisma.apporteurChangementIban.updateMany.mock.invocationCallOrder[0]!;
    const ordreCreation = m.prisma.apporteurChangementIban.create.mock.invocationCallOrder[0]!;
    expect(ordreExpiration).toBeLessThan(ordreCreation);
  });

  it("l'e-mail part à l'adresse de la FICHE, avec des liens hors jeton et aucun IBAN", async () => {
    await demander({ email: "pirate@exemple.fr" });
    const e = m.envoyer.mock.calls[0]![0];
    expect(e.gabarit).toBe("apporteur-compte-a-confirmer");
    expect(e.destinataire).toBe("jeanne@exemple.fr");
    expect(e.payload.lienConfirmer).toContain("/apporteur/dossier/compte/");
    expect(e.payload.lienBloquer).toContain("/apporteur/dossier/compte/");
    expect(e.payload.nouveauFin).toBe(FIN_NEUF);
    expect(e.jobId).toMatch(/^apporteur-compte-a-confirmer-/);
    expect(e.payload).not.toHaveProperty("gabaritRepli");
    expect(JSON.stringify(e)).not.toContain(IBAN_NEUF);
  });

  it("une fiche sans téléphone ne peut pas demander : aucune ligne, aucun e-mail", async () => {
    m.prisma.apporteurReseau.findUnique.mockResolvedValue(ficheSignee({ telephone: null }));
    const r = await demander();
    expect(r.ok).toBe(false);
    expect(m.prisma.apporteurChangementIban.create).not.toHaveBeenCalled();
    expect(m.envoyer).not.toHaveBeenCalled();
  });

  it("refus : dossier non signé, fiche retirée, IBAN invalide, même compte, antivirus", async () => {
    m.prisma.apporteurReseau.findUnique.mockResolvedValue(ficheSignee({ statut: "a_verifier" }));
    expect((await demander()).ok).toBe(false);
    m.prisma.apporteurReseau.findUnique.mockResolvedValue(ficheSignee());
    m.retraitDe.mockResolvedValue(new Date());
    expect((await demander()).ok).toBe(false);
    m.retraitDe.mockResolvedValue(null);
    expect((await demander({ iban: "FR00 0000" })).ok).toBe(false);
    expect((await demander({ iban: IBAN_ANCIEN })).ok).toBe(false);
    m.controlerPiece.mockResolvedValue({ ok: false, message: "refusé" });
    expect((await demander()).ok).toBe(false);
    expect(m.prisma.apporteurChangementIban.create).not.toHaveBeenCalled();
  });

  it("trois demandes sur 30 jours au plus", async () => {
    const d = (j: number) => ({ demandeeAt: new Date(MAINTENANT.getTime() - j * 86_400_000) });
    m.prisma.apporteurChangementIban.findMany.mockResolvedValue([d(1), d(5), d(29)]);
    expect((await demander()).ok).toBe(false);
    m.prisma.apporteurChangementIban.findMany.mockResolvedValue([d(1), d(5), d(31)]);
    expect((await demander()).ok).toBe(true);
  });

  it("limites de débit : fermées en cas de panne, aux chiffres du plan", async () => {
    await demander();
    const appels = m.checkRateLimit.mock.calls as Array<[string, Record<string, unknown>]>;
    const parIp = appels.find(([k]) => k.startsWith("apporteur:iban:demande:ip:"))!;
    const parApporteur = appels.find(
      ([k]) => k === `apporteur:iban:demande:apporteur:${APPORTEUR}`,
    )!;
    expect(parIp[1]).toMatchObject({ limit: 5, windowSec: 3600, surPanne: "refuser" });
    expect(parIp[0]).not.toContain("203.0.113.9");
    expect(parApporteur[1]).toMatchObject({ limit: 3, windowSec: 86_400, surPanne: "refuser" });
    m.prisma.apporteurChangementIban.create.mockClear();
    m.checkRateLimit.mockResolvedValue({
      allowed: false,
      count: 9,
      remaining: 0,
      resetAt: 0,
      panne: true,
    });
    const r = await demander();
    expect(r.ok).toBe(false);
    expect(m.prisma.apporteurChangementIban.create).not.toHaveBeenCalled();
  });

  it("sans secret d'empreinte, rien ne s'enregistre", async () => {
    delete process.env["IBAN_EMPREINTE_SECRET"];
    const r = await demander();
    expect(r.ok).toBe(false);
    expect(m.prisma.apporteurChangementIban.create).not.toHaveBeenCalled();
  });

  it("interrupteur éteint : rien n'est lu, écrit ni émis", async () => {
    delete process.env["APPORTEUR_CHANGEMENT_IBAN_ENABLED"];
    const sigOk = sig(lienConfirmerDemande(ID, APPORTEUR, MAINTENANT));
    const reponses = [
      await demander(),
      await confirmerDemande({ demandeId: ID, signature: sigOk, ip: "1.1.1.1", userAgent: "x" }),
      await sOpposerALaDemande({
        demandeId: ID,
        signature: sig(lienBloquerDemande(ID, APPORTEUR)),
        ip: "1.1.1.1",
      }),
      await annulerDemande({ apporteurId: APPORTEUR, demandeId: ID, ip: "1.1.1.1" }),
      await validerDemande({ demandeId: ID, acteur: SUPER, cases: CASES, ibanRecopie: IBAN_NEUF }),
      await refuserDemande({ demandeId: ID, acteur: SUPER, motif: "non" }),
    ];
    for (const r of reponses) expect(r.ok).toBe(false);
    for (const t of [
      m.prisma.apporteurReseau,
      m.prisma.apporteurChangementIban,
      m.prisma.pieceApporteur,
    ]) {
      for (const fn of Object.values(t)) expect(fn).not.toHaveBeenCalled();
    }
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
    expect(m.envoyer).not.toHaveBeenCalled();
    expect(m.checkRateLimit).not.toHaveBeenCalled();
  });

  it("table absente (P2021) : pas de demande, pas d'erreur", async () => {
    m.prisma.apporteurChangementIban.findUnique.mockRejectedValue({ code: "P2021" });
    const r = await confirmerDemande({
      demandeId: ID,
      signature: sig(lienConfirmerDemande(ID, APPORTEUR, MAINTENANT)),
      ip: "1.1.1.1",
      userAgent: "x",
    });
    expect(r.ok).toBe(false);
  });

  it("deux demandes simultanées : l'index unique refuse la seconde, sans e-mail", async () => {
    m.prisma.apporteurChangementIban.create.mockRejectedValue({ code: "P2002" });
    const r = await demander();
    expect(r.ok).toBe(false);
    expect(m.envoyer).not.toHaveBeenCalled();
  });
});

describe("confirmation", () => {
  const confirmer = (signature: string) =>
    confirmerDemande({
      demandeId: ID,
      signature,
      ip: "203.0.113.9",
      userAgent: "Mozilla/5.0 Firefox/120.0 (Windows NT 10.0)",
    });

  beforeEach(() => {
    m.prisma.apporteurChangementIban.findUnique.mockResolvedValue(
      demandeConfirmee({
        statut: "a_confirmer",
        confirmeeAt: null,
        avisEnvoyeAt: null,
        demandeeAt: new Date(),
      }),
    );
  });

  it("la bonne signature confirme, avec la preuve (IP hachée, navigateur résumé)", async () => {
    const r = await confirmer(sig(lienConfirmerDemande(ID, APPORTEUR, new Date())));
    expect(r.ok).toBe(true);
    const w = m.prisma.apporteurChangementIban.updateMany.mock.calls[0]![0];
    expect(w.where).toMatchObject({ id: ID, statut: "a_confirmer" });
    expect(w.data.statut).toBe("confirmee");
    expect(w.data.confirmationIpHash).not.toContain("203.0.113.9");
    expect(w.data.confirmationNavigateur).toBe("Firefox sur Windows");
    expect(m.prisma.apporteurReseau.update).not.toHaveBeenCalled();
  });

  it("le lien ne sert qu'une fois : la seconde fois, même réponse neutre", async () => {
    const s = sig(lienConfirmerDemande(ID, APPORTEUR, new Date()));
    m.prisma.apporteurChangementIban.updateMany.mockResolvedValue({ count: 0 });
    const r = await confirmer(s);
    expect(r.ok).toBe(false);
  });

  it("signature d'une autre action, d'une autre demande, ou lien expiré : même réponse neutre", async () => {
    const neutre = await confirmer("zzz");
    for (const s of [
      sig(lienBloquerDemande(ID, APPORTEUR)),
      sig(lienConfirmerDemande("22222222-2222-4222-8222-222222222222", APPORTEUR, new Date())),
      sig(lienConfirmerDemande(ID, APPORTEUR, new Date(Date.now() - 25 * 3600_000))),
    ]) {
      expect(await confirmer(s)).toEqual(neutre);
    }
    expect(m.prisma.apporteurChangementIban.updateMany).not.toHaveBeenCalled();
  });

  it("limite de débit de la confirmation : 10 par quart d'heure, fermée en cas de panne", async () => {
    await confirmer(sig(lienConfirmerDemande(ID, APPORTEUR, new Date())));
    const [cle, cfg] = m.checkRateLimit.mock.calls[0]!;
    expect(cle).toMatch(/^apporteur:iban:confirmer:ip:/);
    expect(cfg).toMatchObject({ limit: 10, windowSec: 900, surPanne: "refuser" });
  });
});

describe("opposition", () => {
  const bloquer = () =>
    sOpposerALaDemande({
      demandeId: ID,
      signature: sig(lienBloquerDemande(ID, APPORTEUR)),
      ip: "203.0.113.9",
    });

  it("annule la demande, coupe le lien personnel, envoie un lien neuf à l'adresse de la fiche et alerte", async () => {
    const r = await bloquer();
    expect(r.ok).toBe(true);
    expect(m.prisma.apporteurChangementIban.updateMany.mock.calls[0]![0].data.statut).toBe(
      "opposee",
    );
    expect(m.prisma.apporteurReseau.update.mock.calls[0]![0].data.versionLien).toEqual({
      increment: 1,
    });
    const gabarits = m.envoyer.mock.calls.map((c) => c[0].gabarit);
    expect(gabarits).toEqual(["apporteur-compte-demande-bloquee", "apporteur-lien-espace"]);
    for (const c of m.envoyer.mock.calls) expect(c[0].destinataire).toBe("jeanne@exemple.fr");
    expect(m.envoyer.mock.calls[1]![0].payload.lien).toMatch(
      /\/apporteur\/dossier\/[0-9a-f-]{36}\/[A-Za-z0-9_-]{43}$/,
    );
    expect(m.envoyer.mock.calls[0]![0].payload).not.toHaveProperty("lien");
    const alerte = m.enqueueEmail.mock.calls[0]!;
    expect(alerte[0]).toBe("qualiopi-alerte-interne");
    expect(JSON.stringify(alerte)).not.toContain("jeanne@exemple.fr");
  });

  it("une seconde opposition sur la même demande ne recoupe pas le lien", async () => {
    m.prisma.apporteurChangementIban.updateMany.mockResolvedValue({ count: 0 });
    const r = await bloquer();
    expect(r.ok).toBe(true);
    expect(m.prisma.apporteurReseau.update).not.toHaveBeenCalled();
    expect(m.envoyer).not.toHaveBeenCalled();
  });

  it("limites : 10 par quart d'heure par IP, 5 par jour par demande, fermées en cas de panne", async () => {
    await bloquer();
    const appels = m.checkRateLimit.mock.calls as Array<[string, Record<string, unknown>]>;
    expect(appels.find(([k]) => k.startsWith("apporteur:iban:bloquer:ip:"))![1]).toMatchObject({
      limit: 10,
      windowSec: 900,
      surPanne: "refuser",
    });
    expect(appels.find(([k]) => k === `apporteur:iban:bloquer:demande:${ID}`)![1]).toMatchObject({
      limit: 5,
      windowSec: 86_400,
      surPanne: "refuser",
    });
    m.prisma.apporteurChangementIban.updateMany.mockClear();
    m.checkRateLimit.mockResolvedValue({
      allowed: false,
      count: 11,
      remaining: 0,
      resetAt: 0,
      panne: true,
    });
    expect((await bloquer()).ok).toBe(false);
    expect(m.prisma.apporteurChangementIban.updateMany).not.toHaveBeenCalled();
  });

  it("une signature de confirmation ne sert pas à s'opposer", async () => {
    const r = await sOpposerALaDemande({
      demandeId: ID,
      signature: sig(lienConfirmerDemande(ID, APPORTEUR, new Date())),
      ip: "1.1.1.1",
    });
    expect(r.ok).toBe(false);
    expect(m.prisma.apporteurChangementIban.updateMany).not.toHaveBeenCalled();
  });
});

describe("annulation par l'apporteur", () => {
  it("annule sa propre demande ouverte, limite de débit fermée en cas de panne", async () => {
    const r = await annulerDemande({ apporteurId: APPORTEUR, demandeId: ID, ip: "1.1.1.1" });
    expect(r.ok).toBe(true);
    const w = m.prisma.apporteurChangementIban.updateMany.mock.calls[0]![0];
    expect(w.where).toMatchObject({ id: ID, apporteurId: APPORTEUR });
    expect(w.data.statut).toBe("annulee");
    expect(m.checkRateLimit.mock.calls[0]![1]).toMatchObject({
      limit: 10,
      windowSec: 900,
      surPanne: "refuser",
    });
  });
});

describe("validation", () => {
  const valider = (over: Record<string, unknown> = {}) =>
    validerDemande({
      demandeId: ID,
      acteur: SUPER,
      cases: CASES,
      ibanRecopie: IBAN_NEUF,
      ...over,
    } as Parameters<typeof validerDemande>[0]);

  it("seul le super_admin valide : un admin est refusé côté serveur, même avec les trois cases", async () => {
    for (const role of ["admin", "editor", "support", null]) {
      expect((await valider({ acteur: { id: ADMIN, role } })).ok).toBe(false);
    }
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
    expect(m.prisma.apporteurReseau.update).not.toHaveBeenCalled();
  });

  it("les trois cases sont exigées", async () => {
    for (const k of ["titulaire", "iban", "rappel"] as const) {
      expect((await valider({ cases: { ...CASES, [k]: false } })).ok).toBe(false);
    }
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("sans confirmation par e-mail (demande a_confirmer), même un super_admin est refusé", async () => {
    m.prisma.apporteurChangementIban.findUnique.mockResolvedValue(
      demandeConfirmee({ statut: "a_confirmer", confirmeeAt: null }),
    );
    expect((await valider()).ok).toBe(false);
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("attend 72 heures : à 71 h 59 refusé, à 72 h permis", async () => {
    m.prisma.apporteurChangementIban.findUnique.mockResolvedValue(
      demandeConfirmee({ confirmeeAt: new Date(Date.now() - (72 * 3600_000 - 60_000)) }),
    );
    expect((await valider()).ok).toBe(false);
    m.prisma.apporteurChangementIban.findUnique.mockResolvedValue(
      demandeConfirmee({ confirmeeAt: new Date(Date.now() - 72 * 3600_000 - 1000) }),
    );
    expect((await valider()).ok).toBe(true);
  });

  it("exige l'avis envoyé", async () => {
    m.prisma.apporteurChangementIban.findUnique.mockResolvedValue(
      demandeConfirmee({ avisEnvoyeAt: null }),
    );
    expect((await valider()).ok).toBe(false);
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("le contrôle de l'IBAN recopié compare l'empreinte : mauvais refusé, rien de rendu ni journalisé", async () => {
    const r = await valider({ ibanRecopie: "FR1420041010050500013M02606" });
    expect(r.ok).toBe(false);
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
    const sortie = JSON.stringify([r, m.journaliser.mock.calls, m.envoyer.mock.calls]);
    expect(sortie).not.toContain("FR1420041010050500013M02606");
    expect(sortie).not.toContain(IBAN_NEUF);
    // bon IBAN, avec espaces et minuscules : accepté
    expect((await valider({ ibanRecopie: "fr76 3000 6000 0112 3456 7890 189" })).ok).toBe(true);
  });

  it("fiche résiliée ou retirée entre-temps : refus", async () => {
    m.prisma.apporteurReseau.findUnique.mockResolvedValue(ficheSignee({ statut: "resilie" }));
    expect((await valider()).ok).toBe(false);
    m.prisma.apporteurReseau.findUnique.mockResolvedValue(ficheSignee());
    m.retraitDe.mockResolvedValue(new Date());
    expect((await valider()).ok).toBe(false);
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("double validation : la seconde écriture conditionnelle ne touche rien, donc refus et rien d'autre n'est écrit", async () => {
    m.prisma.apporteurChangementIban.updateMany.mockResolvedValue({ count: 0 });
    const r = await valider();
    expect(r.ok).toBe(false);
    expect(m.prisma.apporteurReseau.update).not.toHaveBeenCalled();
    expect(m.prisma.pieceApporteur.create).not.toHaveBeenCalled();
    expect(m.envoyer).not.toHaveBeenCalled();
  });

  it("l'ancien IBAN entre dans l'historique (rechiffré enc:v2), la fiche porte le nouveau", async () => {
    await valider();
    const w = m.prisma.apporteurChangementIban.updateMany.mock.calls[0]![0];
    expect(w.where).toMatchObject({ id: ID, statut: "confirmee" });
    expect(w.data).toMatchObject({ statut: "validee", traiteePar: ADMIN });
    expect(w.data.controles).toMatchObject({ titulaire: true, iban: true, rappel: true });
    const lignes = m.prisma.apporteurIbanHistorique.create.mock.calls.map((c) => c[0].data);
    const ancien = lignes.find((l) => l.ibanFin4 === "2606")!;
    expect(ancien.origine).toBe("dossier_initial");
    expect(ancien.iban).toMatch(/^enc:v2:/);
    expect(decryptPii(ancien.iban, { aad: `iban-historique:${ancien.id}`, cleExigee: true })).toBe(
      IBAN_ANCIEN,
    );
    expect(ancien.enVigueurJusqua).toBeInstanceOf(Date);
    const neuf = lignes.find((l) => l.ibanFin4 === FIN_NEUF)!;
    expect(neuf.origine).toBe("changement");
    expect(neuf.demandeId).toBe(ID);
    expect(neuf.enVigueurJusqua ?? null).toBeNull();
    const fiche = m.prisma.apporteurReseau.update.mock.calls[0]![0].data;
    expect(decryptPii(fiche.iban)).toBe(IBAN_NEUF);
    expect(fiche.versionLien).toEqual({ increment: 1 });
  });

  it("si le journal échoue, rien n'est écrit : la transaction entière est rejetée", async () => {
    m.journaliser.mockRejectedValue(new Error("journal HS"));
    const ecrits: string[] = [];
    m.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const instantane = ecrits.length;
      try {
        return await fn(m.prisma);
      } catch (e) {
        ecrits.length = instantane;
        throw e;
      }
    });
    const r = await valider();
    expect(r.ok).toBe(false);
    expect(m.journaliser.mock.calls[0]![2]).toMatchObject({ exiger: true });
    expect(m.envoyer).not.toHaveBeenCalled();
  });

  it("le RIB de la demande devient la pièce rib courante ; l'ancienne est marquée remplacée, ses octets gardés", async () => {
    await valider();
    const neuve = m.prisma.pieceApporteur.create.mock.calls[0]![0].data;
    expect(neuve).toMatchObject({ apporteurId: APPORTEUR, type: "rib", statut: "conforme" });
    expect(neuve.verifieeAt).toBeInstanceOf(Date);
    expect(neuve.contenu.create.octets).toBeInstanceOf(Buffer);
    const remplace = m.prisma.pieceApporteur.updateMany.mock.calls[0]![0];
    expect(remplace.where).toMatchObject({
      apporteurId: APPORTEUR,
      type: "rib",
      remplaceeAt: null,
    });
    expect(remplace.data.remplaceeAt).toBeInstanceOf(Date);
    expect(JSON.stringify(remplace)).not.toMatch(/purgee|octets|contenu/);
  });

  it("renouvelle le lien et l'envoie à part : l'e-mail 3 n'en porte aucun, un apporteur-lien-espace part séparément", async () => {
    await valider();
    const envois = m.envoyer.mock.calls.map((c) => c[0]);
    expect(envois.map((e) => e.gabarit)).toEqual([
      "apporteur-compte-change",
      "apporteur-lien-espace",
    ]);
    expect(JSON.stringify(envois[0].payload)).not.toMatch(/apporteur\/dossier/);
    expect(envois[0].payload).toMatchObject({ nouveauFin: FIN_NEUF, ancienFin: "2606" });
    expect(envois[1].payload.lien).toMatch(/\/apporteur\/dossier\//);
    expect(envois[0].destinataire).toBe("jeanne@exemple.fr");
  });

  it("aucun IBAN entier ne sort du serveur : ni journal, ni e-mail, ni alerte, ni valeur de retour", async () => {
    const r = await valider();
    const sortie = JSON.stringify([
      r,
      m.journaliser.mock.calls,
      m.envoyer.mock.calls,
      m.enqueueEmail.mock.calls,
    ]);
    for (const iban of [IBAN_NEUF, IBAN_ANCIEN]) expect(sortie).not.toContain(iban);
  });
});

describe("refus", () => {
  it("seul le super_admin refuse ; le motif est obligatoire ; l'e-mail 4 part sans IBAN", async () => {
    expect(
      (await refuserDemande({ demandeId: ID, acteur: { id: ADMIN, role: "admin" }, motif: "non" }))
        .ok,
    ).toBe(false);
    expect((await refuserDemande({ demandeId: ID, acteur: SUPER, motif: "   " })).ok).toBe(false);
    const r = await refuserDemande({
      demandeId: ID,
      acteur: SUPER,
      motif: `Le titulaire ne correspond pas (${IBAN_NEUF}).`,
    });
    expect(r.ok).toBe(true);
    const w = m.prisma.apporteurChangementIban.updateMany.mock.calls[0]![0];
    expect(w.where).toMatchObject({ id: ID, statut: "confirmee" });
    expect(w.data.statut).toBe("refusee");
    expect(w.data.motifRefus).not.toContain(IBAN_NEUF);
    const e = m.envoyer.mock.calls[0]![0];
    expect(e.gabarit).toBe("apporteur-compte-refuse");
    expect(e.payload.ancienFin).toBe("2606");
    expect(JSON.stringify([e, m.journaliser.mock.calls])).not.toContain(IBAN_NEUF);
    expect(m.prisma.apporteurReseau.update).not.toHaveBeenCalled();
  });
});

describe("expiration à l'ouverture de l'espace", () => {
  it("écrit l'expiration puis envoie l'e-mail 5, une fois par demande", async () => {
    m.prisma.apporteurChangementIban.findMany.mockResolvedValue([
      { id: ID, ancienIbanFin4: "2606" },
    ]);
    const n = await expirerEtAvertir(APPORTEUR);
    expect(n).toBe(1);
    const e = m.envoyer.mock.calls[0]![0];
    expect(e.gabarit).toBe("apporteur-compte-expire");
    expect(e.jobId).toBe(`apporteur-compte-expire-${ID}`);
  });
});
