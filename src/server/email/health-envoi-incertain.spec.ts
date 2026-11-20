// OUT-1 — le balayage horaire des « approuvé » anciens tranche d'après l'état RÉEL de la tâche
// `outbox-<id>` dans la file, puis la dernière ligne du journal (règle `trancherApprouveAncien`).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileInjoignable } from "./outbox-en-cours";

type Ancien = {
  id: string;
  template: string;
  payload: unknown;
  approuveAt: Date;
  entityType: string | null;
  entityId: string | null;
};

const MAINT = new Date("2026-11-20T10:00:00Z");
const ilYA = (min: number) => new Date(MAINT.getTime() - min * 60_000);
const MOTIF_1 = "Balayage : tâche introuvable dans la file (premier constat).";

const h = vi.hoisted(() => ({
  anciens: [] as unknown[],
  journaux: [] as Array<{ id: string; jobId: string; status: string; error: string | null }>,
  tache: { v: "absente" as "absente" | "echouee" | "presente" | "injoignable" },
  outboxUpdateMany: vi.fn(),
  logUpdateMany: vi.fn(),
  devisFindUnique: vi.fn(),
  marquerAnnule: vi.fn(),
  alerte: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      count: vi.fn(async () => 0),
      findFirst: vi.fn(async () => null),
      // La sonde lit aussi le journal pour d'autres mesures : seule la lecture par `jobId` est simulée.
      findMany: vi.fn(async (a: { where?: { jobId?: unknown } }) =>
        a?.where?.jobId !== undefined ? h.journaux : [],
      ),
      updateMany: (...a: unknown[]) => h.logUpdateMany(...a),
    },
    emailOutbox: {
      findMany: vi.fn(async () => h.anciens),
      updateMany: (...a: unknown[]) => h.outboxUpdateMany(...a),
    },
    devis: { findUnique: (...a: unknown[]) => h.devisFindUnique(...a) },
    alerteSysteme: { updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/redis", () => ({ redis: { get: vi.fn(async () => null), set: vi.fn() } }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: (...a: unknown[]) => h.alerte(...a),
  creerOuActualiser: (...a: unknown[]) => h.alerte(...a),
  resoudreAlertesParCode: vi.fn(async () => 0),
}));
vi.mock("@/server/notifications", () => ({ notify: vi.fn(async () => ({ ok: true })) }));
vi.mock("./email-log", () => ({ marquerAnnule: (...a: unknown[]) => h.marquerAnnule(...a) }));
vi.mock("@/server/queue/queues", () => ({
  lireEtatTacheOutbox: async () => {
    if (h.tache.v === "injoignable") throw new FileInjoignable();
    return h.tache.v;
  },
}));

import { verifierSanteEmails } from "./health";

const ancien = (over: Partial<Ancien> = {}): Ancien => ({
  id: "L1",
  template: "facture-envoi",
  payload: {},
  approuveAt: ilYA(120),
  entityType: null,
  entityId: null,
  ...over,
});
const journal = (status: string, error: string | null = null, id = "J1") => ({
  id,
  jobId: "outbox-L1",
  status,
  error,
});
const codes = () => h.alerte.mock.calls.map((c) => (c[0] as { code: string }).code);
const donnees = () => h.outboxUpdateMany.mock.calls.map((c) => c[0].data);

beforeEach(() => {
  vi.clearAllMocks();
  h.anciens = [ancien()];
  h.journaux = [];
  h.tache.v = "absente";
  h.outboxUpdateMany.mockResolvedValue({ count: 1 });
  h.logUpdateMany.mockResolvedValue({ count: 1 });
  h.alerte.mockResolvedValue(null);
  process.env["ZEPTOMAIL_WEBHOOK_KEY"] = "cle";
});

describe("balayage des « approuvé » anciens — OUT-1", () => {
  it("journal `failed` + tâche présente : « envoyé », jamais « à valider »", async () => {
    h.tache.v = "presente";
    h.journaux = [journal("failed")];
    const s = await verifierSanteEmails(MAINT);
    expect(donnees().map((d) => d.statut)).toEqual(["envoye"]);
    expect(s.approuvesRemisEnAttente).toBe(0);
    expect(codes()).toContain("emails_envoi_incertain");
    expect(codes()).not.toContain("emails_approuves_abandonnes");
  });

  it("tâche absente + journal `sent` (tâche purgée) : « envoyé »", async () => {
    h.journaux = [journal("sent")];
    await verifierSanteEmails(MAINT);
    expect(donnees().map((d) => d.statut)).toEqual(["envoye"]);
  });

  it("tâche échouée : « à valider », conditionnel à la valeur lue de `approuveAt`", async () => {
    h.tache.v = "echouee";
    h.journaux = [journal("failed")];
    const s = await verifierSanteEmails(MAINT);
    expect(h.outboxUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "L1",
        statut: "approuve",
        approuveAt: h.anciens[0] && (h.anciens[0] as Ancien).approuveAt,
      },
      data: { statut: "a_valider", approuveAt: null, approuveById: null },
    });
    expect(s.approuvesRemisEnAttente).toBe(1);
    expect(codes()).toContain("emails_approuves_abandonnes");
  });

  it.each([
    ["aucun journal", []],
    ["journal `failed`", [journal("failed")]],
    ["journal `cancelled`", [journal("cancelled")]],
  ])("tâche absente, %s : « à valider »", async (_n, j) => {
    h.journaux = j;
    const s = await verifierSanteEmails(MAINT);
    expect(donnees().map((d) => d.statut)).toEqual(["a_valider"]);
    expect(s.approuvesRemisEnAttente).toBe(1);
    expect(codes()).not.toContain("emails_envoi_incertain");
  });

  it("`pending` de 2 h, tâche absente, sans repère : repère posé, ligne « approuvé » laissée", async () => {
    h.journaux = [journal("pending")];
    const s = await verifierSanteEmails(MAINT);
    expect(h.logUpdateMany).toHaveBeenCalledWith({
      where: { id: "J1", status: "pending" },
      data: { error: MOTIF_1 },
    });
    expect(h.outboxUpdateMany).not.toHaveBeenCalled();
    expect(s.approuvesEnvoiIncertain).toBe(1);
    expect(codes()).toContain("emails_envoi_incertain");
  });

  it("`pending` avec repère (2e constat) : journal clos puis « à valider »", async () => {
    h.journaux = [journal("pending", MOTIF_1)];
    const s = await verifierSanteEmails(MAINT);
    expect(h.marquerAnnule).toHaveBeenCalledWith(
      "outbox-L1",
      expect.stringContaining("deux passages"),
    );
    expect(donnees().map((d) => d.statut)).toEqual(["a_valider"]);
    expect(s.approuvesRemisEnAttente).toBe(1);
  });

  it("`pending` de moins d'une heure, tâche absente : on attend, aucune écriture", async () => {
    h.anciens = [ancien({ approuveAt: ilYA(30) })];
    h.journaux = [journal("pending")];
    const s = await verifierSanteEmails(MAINT);
    expect(h.outboxUpdateMany).not.toHaveBeenCalled();
    expect(h.logUpdateMany).not.toHaveBeenCalled();
    expect(s.approuvesEnvoiIncertain).toBe(1);
  });

  it("tâche présente et repère laissé au journal : le repère est effacé", async () => {
    h.tache.v = "presente";
    h.journaux = [journal("pending", MOTIF_1)];
    await verifierSanteEmails(MAINT);
    expect(h.logUpdateMany).toHaveBeenCalledWith({
      where: { id: "J1", error: MOTIF_1 },
      data: { error: null },
    });
  });

  it("parti sur `convention-envoi` : le lien de signature est masqué dans la MÊME écriture", async () => {
    h.tache.v = "presente";
    h.anciens = [
      ancien({
        template: "convention-envoi",
        payload: { signatureUrl: "https://x.test/fr/portail/signer/JETON-SECRET-123" },
      }),
    ];
    await verifierSanteEmails(MAINT);
    expect(h.outboxUpdateMany).toHaveBeenCalledTimes(1);
    const d = donnees()[0];
    expect(d.statut).toBe("envoye");
    expect(JSON.stringify(d.payload)).not.toContain("JETON-SECRET-123");
  });

  it("file non « ready » : aucune écriture, alerte levée", async () => {
    h.tache.v = "injoignable";
    h.journaux = [journal("failed")];
    const s = await verifierSanteEmails(MAINT);
    expect(h.outboxUpdateMany).not.toHaveBeenCalled();
    expect(h.logUpdateMany).not.toHaveBeenCalled();
    expect(h.marquerAnnule).not.toHaveBeenCalled();
    expect(s.approuvesEnvoiIncertain).toBe(1);
    expect(codes()).toContain("emails_envoi_incertain");
  });

  it("parti sur `devis-envoi` avec devis brouillon : le numéro est dans l'alerte, aucune adresse", async () => {
    h.tache.v = "presente";
    h.anciens = [ancien({ template: "devis-envoi", entityType: "Devis", entityId: "D1" })];
    h.devisFindUnique.mockResolvedValue({ numero: "DEV-2026-0042", statut: "brouillon" });
    await verifierSanteEmails(MAINT);
    const texte = JSON.stringify(h.alerte.mock.calls);
    expect(texte).toContain("DEV-2026-0042");
    expect(texte).not.toContain("@");
    expect(texte).not.toContain("L1");
  });
});
