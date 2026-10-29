/**
 * Lecture de la chronologie (lot B2) avec une base simulée : pannes dites, notes déchiffrées
 * sans jamais être journalisées, argent en bonne base, et AUCUNE écriture.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const ecriture = () => ({
  create: vi.fn(),
  createMany: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
});
const prismaMock = vi.hoisted(
  () => ({}) as Record<string, Record<string, ReturnType<typeof vi.fn>>>,
);
const filMock = vi.hoisted(() => vi.fn());
const clientMock = vi.hoisted(() => vi.fn());
const dechiffrerMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/chiffrer-parole", () => ({ dechiffrerParoleOuNull: dechiffrerMock }));
vi.mock("@/features/dossier-client/fil-des-echanges", () => ({
  LIBELLE_STATUT_RENDEZ_VOUS: {
    planifie: "à venir",
    tenu: "a eu lieu",
    annule: "annulé",
    absent: "client absent",
    reporte: "reporté",
  },
  lireFilDesEchanges: filMock,
}));
vi.mock("@/components/admin/dossier-client/fiche/contexte", () => ({
  lireClient360Cache: clientMock,
}));

import { lireChronologie, nuanceRendezVous } from "../lire-chronologie";

const MAINTENANT = new Date("2026-10-29T12:00:00Z");
const MODELES = [
  "clientTache",
  "clientNote",
  "devis",
  "payment",
  "emailLog",
  "emailOutbox",
] as const;

function reinitialiser(): void {
  for (const m of MODELES) {
    prismaMock[m] = { findMany: vi.fn(async () => []), ...ecriture() };
  }
  prismaMock["clientContactAdresse"] = { findMany: vi.fn(async () => []), ...ecriture() };
  filMock.mockResolvedValue({ fil: [], sourcesEnPanne: 0 });
  clientMock.mockResolvedValue({ devis: [], facturesFormation: [] });
  dechiffrerMock.mockImplementation((v: string) => `clair:${v}`);
}

const lire = () => lireChronologie("cl-1", "adm", MAINTENANT);

let espions: ReturnType<typeof vi.spyOn>[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  reinitialiser();
  espions = (["log", "warn", "error", "info", "debug"] as const).map((n) =>
    vi.spyOn(console, n).mockImplementation(() => undefined),
  );
});
afterEach(() => vi.restoreAllMocks());

const sortieConsole = (): string => JSON.stringify(espions.flatMap((e) => e.mock.calls));

describe("lireChronologie — pannes", () => {
  it("une source qui rejette : sourcesEnPanne = 1, le reste demeure", async () => {
    prismaMock["clientTache"]!["findMany"]!.mockRejectedValue(new Error("base coupée"));
    prismaMock["clientNote"]!["findMany"]!.mockResolvedValue([
      {
        id: "n1",
        auteurLabel: "Will",
        contenuChiffre: "x",
        epinglee: false,
        createdAt: MAINTENANT,
      },
    ]);
    const r = await lire();
    expect(r.sourcesEnPanne).toBe(1);
    expect(r.evenements.map((e) => e.cle)).toEqual(["note:n1"]);
  });
  it("toutes les sources vides et saines : 0 panne, liste vide", async () => {
    const r = await lire();
    expect(r).toEqual({ evenements: [], sourcesEnPanne: 0 });
  });
});

describe("lireChronologie — notes", () => {
  it("une note illisible porte « Lecture impossible » et son texte n'est jamais journalisé", async () => {
    prismaMock["clientNote"]!["findMany"]!.mockResolvedValue([
      {
        id: "n1",
        auteurLabel: "Will",
        contenuChiffre: "SECRET-CHIFFRE",
        epinglee: false,
        createdAt: MAINTENANT,
      },
    ]);
    dechiffrerMock.mockImplementation(() => {
      throw new Error("déchiffrement impossible SECRET-CHIFFRE texte-de-la-note");
    });
    const r = await lire();
    const note = r.evenements.find((e) => e.cle === "note:n1");
    expect(note?.etat).toBe("Lecture impossible");
    expect(note?.texte).toBeNull();
    expect(r.sourcesEnPanne).toBe(0);
    expect(sortieConsole()).not.toContain("texte-de-la-note");
    expect(sortieConsole()).not.toContain("SECRET-CHIFFRE");
  });
  it("une note lisible est déchiffrée, épinglée ou non", async () => {
    prismaMock["clientNote"]!["findMany"]!.mockResolvedValue([
      {
        id: "n1",
        auteurLabel: "Will",
        contenuChiffre: "abc",
        epinglee: true,
        createdAt: MAINTENANT,
      },
    ]);
    const r = await lire();
    const note = r.evenements[0];
    expect(note?.texte).toBe("clair:abc");
    expect(note?.epinglee).toBe(true);
    expect(note?.etat).toBe("Note épinglée");
    expect(sortieConsole()).not.toContain("clair:abc");
  });
});

describe("lireChronologie — argent", () => {
  it("les paiements sont en TTC, hors remboursements, et lus avec le bon filtre", async () => {
    prismaMock["payment"]!["findMany"]!.mockResolvedValue([
      { id: "p1", amountCents: 72000, paidAt: MAINTENANT, mode: "sepa_credit_transfer" },
    ]);
    const r = await lire();
    expect(r.evenements[0]?.montant).toEqual({ cents: 72000, base: "ttc" });
    expect(r.evenements[0]?.titre).toBe("Paiement reçu");
    expect(r.evenements[0]?.etat).toBe("Virement");
    const where = prismaMock["payment"]!["findMany"]!.mock.calls[0]![0].where;
    expect(where).toMatchObject({ status: "succeeded", type: { not: "refund" } });
  });
  it("les devis sont lus par date d'envoi, tous statuts envoyés, 100 au plus", async () => {
    const d = (id: string, statut: string) => ({
      id,
      numero: `D-${id}`,
      statut,
      montantTotalHtCents: 100000,
      sentAt: new Date("2026-10-10T08:00:00Z"),
      acceptedAt: null,
    });
    prismaMock["devis"]!["findMany"]!.mockResolvedValue([
      d("1", "envoye"),
      d("2", "accepte"),
      d("3", "refuse"),
      d("4", "expire"),
      d("5", "transforme_convention"),
    ]);
    const r = await lire();
    const arg = prismaMock["devis"]!["findMany"]!.mock.calls[0]![0];
    expect(arg.where).toEqual({ clientId: "cl-1", sentAt: { not: null } });
    expect(arg.take).toBe(100);
    const etats = Object.fromEntries(r.evenements.map((e) => [e.cle, e.etat]));
    expect(etats).toEqual({
      "devis:1": "Devis envoyé",
      "devis:2": "Devis accepté",
      "devis:3": "Devis refusé",
      "devis:4": "Devis expiré",
      "devis:5": "Devis signé · convention créée",
    });
    expect(r.evenements[0]?.montant).toEqual({ cents: 100000, base: "ht" });
    expect(r.evenements[0]?.date).toEqual(new Date("2026-10-10T08:00:00Z"));
  });
  it("factures : brouillons et avoirs écartés, annulée mentionnée", async () => {
    const f = (id: string, statut: string, plus: object = {}) => ({
      id,
      numero: `F-${id}`,
      statut,
      montantHtCents: 50000,
      avoirDeId: null,
      emiseAt: new Date("2026-10-11T08:00:00Z"),
      ...plus,
    });
    clientMock.mockResolvedValue({
      devis: [],
      facturesFormation: [
        f("ok", "emise"),
        f("brouillon", "brouillon"),
        f("avoir", "emise", { avoirDeId: "x" }),
        f("annulee", "annulee"),
        f("sansdate", "emise", { emiseAt: null }),
      ],
    });
    const r = await lire();
    const etats = Object.fromEntries(r.evenements.map((e) => [e.cle, e.etat]));
    expect(etats).toEqual({
      "facture:ok": "Facture envoyée",
      "facture:annulee": "Facture annulée",
    });
  });
});

describe("lireChronologie — rendez-vous, e-mails et messages", () => {
  const rdv = (id: string, etat: string) => ({
    cle: `rdv:${id}`,
    genre: "rendez_vous",
    date: MAINTENANT,
    titre: id,
    etat,
    lien: null,
  });
  it("couleur d'un rendez-vous par libellé exact", () => {
    expect(nuanceRendezVous("rendez-vous à venir")).toBe("prevu");
    expect(nuanceRendezVous("rendez-vous a eu lieu")).toBe("fait");
    expect(nuanceRendezVous("rendez-vous annulé")).toBe("neutre");
    expect(nuanceRendezVous("rendez-vous reporté")).toBe("neutre");
    expect(nuanceRendezVous("rendez-vous client absent")).toBe("probleme");
    expect(nuanceRendezVous("rendez-vous")).toBe("neutre");
  });
  it("e-mails en échec ou rebondis en terracotta, courriers en erreur aussi, Telegram n'est pas un e-mail", async () => {
    filMock.mockResolvedValue({
      sourcesEnPanne: 0,
      fil: [
        rdv("a", "rendez-vous annulé"),
        {
          cle: "mail:1",
          genre: "email",
          date: MAINTENANT,
          titre: "Objet",
          etat: "Échec",
          statutEmail: "failed",
          lien: "/m/1",
        },
        {
          cle: "mail:2",
          genre: "email",
          date: MAINTENANT,
          titre: "Objet",
          etat: "Rebond",
          statutEmail: "bounced",
          lien: "/m/2",
        },
        {
          cle: "courrier:1",
          genre: "questionnaire",
          date: MAINTENANT,
          titre: "Questionnaire avant audit : invitation",
          etat: "en erreur",
          canal: "email",
          statutCourrier: "echec",
          lien: null,
        },
        {
          cle: "courrier:2",
          genre: "questionnaire",
          date: MAINTENANT,
          titre: "Questionnaire avant audit : invitation",
          etat: "envoyé",
          canal: "telegram",
          statutCourrier: "envoye",
          lien: null,
        },
      ],
    });
    const r = await lire();
    const par = Object.fromEntries(r.evenements.map((e) => [e.cle, e]));
    expect(par["rdv:a"]?.nuance).toBe("neutre");
    expect(par["mail:1"]?.nuance).toBe("probleme");
    expect(par["mail:2"]?.nuance).toBe("probleme");
    expect(par["courrier:1"]?.nuance).toBe("probleme");
    expect(par["courrier:1"]?.type).toBe("email");
    expect(par["courrier:1"]?.titre).toContain("Questionnaire avant audit");
    expect(par["courrier:2"]?.type).toBe("message");
    expect(par["courrier:2"]?.mot).toBe("Message Telegram");
  });
  it("le destinataire est un NOM, jamais l'adresse", async () => {
    filMock.mockResolvedValue({
      sourcesEnPanne: 0,
      fil: [
        {
          cle: "mail:1",
          genre: "email",
          date: MAINTENANT,
          titre: "Objet",
          etat: "Envoyé",
          statutEmail: "sent",
          lien: "/m/1",
        },
      ],
    });
    prismaMock["emailLog"]!["findMany"]!.mockResolvedValue([
      { id: "1", recipient: "Camille@Exemple.fr" },
    ]);
    prismaMock["clientContactAdresse"]!["findMany"]!.mockResolvedValue([
      { email: "camille@exemple.fr", contact: { nom: "Camille Roux" } },
    ]);
    const r = await lire();
    expect(r.evenements[0]?.destinataire).toBe("Camille Roux");
    expect(JSON.stringify(r.evenements)).not.toContain("@");
  });
});

describe("lireChronologie — lecture seule", () => {
  it("n'appelle jamais create / update / upsert / delete", async () => {
    prismaMock["clientNote"]!["findMany"]!.mockResolvedValue([
      {
        id: "n1",
        auteurLabel: "Will",
        contenuChiffre: "x",
        epinglee: false,
        createdAt: MAINTENANT,
      },
    ]);
    filMock.mockResolvedValue({
      sourcesEnPanne: 0,
      fil: [
        {
          cle: "mail:1",
          genre: "email",
          date: MAINTENANT,
          titre: "O",
          etat: "Envoyé",
          statutEmail: "sent",
          lien: null,
        },
      ],
    });
    await lire();
    for (const modele of Object.values(prismaMock)) {
      for (const [nom, fn] of Object.entries(modele)) {
        if (nom !== "findMany") expect(fn, nom).not.toHaveBeenCalled();
      }
    }
  });
});
