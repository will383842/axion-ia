/**
 * `facture_auto_non_emise` — ce que l'alerte dit, et qu'elle se TAIT une fois
 * le cas résolu (c'est ce silence qui la ferme : code `resolutionAuto: true`).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  sessions: vi.fn(),
  logs: vi.fn(),
  factures: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findMany: (...a: unknown[]) => d.sessions(...a) },
    activityLog: { findMany: (...a: unknown[]) => d.logs(...a) },
    factureFormation: { findMany: (...a: unknown[]) => d.factures(...a) },
  },
}));

import { casFactureAutoASignaler } from "./facture-auto-regles";
import { ALERTE_CATALOGUE } from "@/server/qualiopi/alertes/catalogue";

const FIN = new Date("2026-10-05T14:00:00.000Z");

function session(over: Record<string, unknown> = {}) {
  return {
    id: "s-1",
    numero: "AXI-SESS-2026-900",
    titreSession: "Formation test",
    statut: "realisee",
    dateFin: FIN,
    montantHtCents: 150000,
    interEntreprises: false,
    financementType: "direct",
    opcoSubrogation: false,
    client: {
      type: "entreprise",
      raisonSociale: "Acme",
      siret: "12345678900011",
      adresse: "1 rue de l'Exemple, 00000 Ville",
      contactEmail: "compta@acme.test",
    },
    facturesFormation: [],
    dossiersFinancement: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  d.sessions.mockResolvedValue([]);
  d.logs.mockResolvedValue([]);
  d.factures.mockResolvedValue([]);
});

describe("famille 1 — session non automatisable", () => {
  it("l'alerte cible la session et NOMME le motif", async () => {
    d.sessions.mockResolvedValue([session({ interEntreprises: true })]);
    const cas = await casFactureAutoASignaler(new Date("2026-10-06T08:00:00.000Z"));
    expect(cas).toHaveLength(1);
    expect(cas[0]).toMatchObject({ cibleType: "TrainingSession", cibleId: "s-1" });
    expect(cas[0]!.message).toContain("PAR PARTICIPANT");
    expect(cas[0]!.message).toContain("E-mails à valider");
  });

  it("🔑 se tait dès qu'une facture existe (émise à la main) — l'alerte se ferme", async () => {
    d.sessions.mockResolvedValue([
      session({
        interEntreprises: true,
        facturesFormation: [{ statut: "emise", montantHtCents: 150000, avoirs: [] }],
      }),
    ]);
    expect(await casFactureAutoASignaler(new Date("2026-10-06T08:00:00.000Z"))).toEqual([]);
  });

  it("pas avant le lendemain : le soir même, rien à signaler", async () => {
    d.sessions.mockResolvedValue([session({ client: null })]);
    expect(await casFactureAutoASignaler(new Date("2026-10-05T20:00:00.000Z"))).toEqual([]);
  });
});

describe("famille 2 — éligible, et toujours rien trois jours après", () => {
  it("le lendemain, le passage n'a pas encore eu lieu : silence", async () => {
    d.sessions.mockResolvedValue([session()]);
    expect(await casFactureAutoASignaler(new Date("2026-10-06T06:00:00.000Z"))).toEqual([]);
  });

  it("🔑 le surlendemain à 07:00 UTC (balayage) : silence — une session clôturée à 08:00 ce jour-là n'est facturée qu'à 09:30", async () => {
    d.sessions.mockResolvedValue([session()]);
    expect(await casFactureAutoASignaler(new Date("2026-10-07T07:00:00.000Z"))).toEqual([]);
  });

  it("trois jours après, sans facture : l'échec silencieux est dit", async () => {
    d.sessions.mockResolvedValue([session()]);
    const cas = await casFactureAutoASignaler(new Date("2026-10-08T05:00:00.000Z"));
    expect(cas).toHaveLength(1);
    expect(cas[0]!.message).toContain("n'a pas abouti");
  });
});

describe("famille 3 — facture automatique sans e-mail préparé", () => {
  const now = new Date("2026-10-08T05:00:00.000Z");

  it("signalée sur la FACTURE tant qu'aucun journal d'e-mail n'existe", async () => {
    d.logs.mockImplementation(async ({ where }: { where: { action: string } }) =>
      where.action === "qualiopi.facture.generer.auto" ? [{ targetId: "f-1" }] : [],
    );
    d.factures.mockResolvedValue([{ id: "f-1", numero: "AXI-FACT-2026-050" }]);

    const cas = await casFactureAutoASignaler(now);
    expect(cas).toEqual([
      expect.objectContaining({ cibleType: "FactureFormation", cibleId: "f-1" }),
    ]);
    expect(cas[0]!.message).toContain("AXI-FACT-2026-050");
    expect(cas[0]!.message).toContain("Envoyer par email");
  });

  it("🔑 se tait dès que l'e-mail a été préparé (bouton ou automate)", async () => {
    d.logs.mockImplementation(async ({ where }: { where: { action: string } }) =>
      where.action === "qualiopi.facture.generer.auto"
        ? [{ targetId: "f-1" }]
        : [{ targetId: "f-1" }],
    );
    d.factures.mockResolvedValue([{ id: "f-1", numero: "AXI-FACT-2026-050" }]);
    expect(await casFactureAutoASignaler(now)).toEqual([]);
  });

  it("une facture annulée depuis ne réclame plus d'e-mail", async () => {
    d.logs.mockImplementation(async ({ where }: { where: { action: string } }) =>
      where.action === "qualiopi.facture.generer.auto" ? [{ targetId: "f-1" }] : [],
    );
    d.factures.mockResolvedValue([]);
    expect(await casFactureAutoASignaler(now)).toEqual([]);
    expect(d.factures.mock.calls[0]![0]).toMatchObject({
      where: { statut: { notIn: ["annulee", "brouillon"] } },
    });
  });
});

describe("câblage dans le moteur d'alertes", () => {
  it("le code est catalogué, auto-résolu, adressé à la direction", () => {
    expect(ALERTE_CATALOGUE["facture_auto_non_emise"]).toMatchObject({
      resolutionAuto: true,
      guichet: "direction",
    });
  });

  it("l'évaluateur enregistre la règle et lit CES cas — pas une requête jumelle", () => {
    const src = readFileSync(
      join(process.cwd(), "src/server/qualiopi/alertes/evaluateur.ts"),
      "utf8",
    );
    expect(src).toMatch(
      /\{\s*nom:\s*"facture_auto_non_emise",\s*fn:\s*regleFactureAutoNonEmise\s*\}/,
    );
    const depart = src.indexOf("async function regleFactureAutoNonEmise");
    expect(depart).toBeGreaterThan(-1);
    const corps = src.slice(depart, src.indexOf("\nasync function ", depart + 10));
    expect(corps).toContain("casFactureAutoASignaler(");
    expect(corps).toContain('code: "facture_auto_non_emise"');
  });
});
