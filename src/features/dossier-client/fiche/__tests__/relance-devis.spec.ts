/**
 * Lot B9 — la relance de devis est un BROUILLON garé « à valider », jamais un envoi.
 * Tout est simulé : aucun transport d'e-mail n'est jamais appelé (un espion le prouve).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const AUTRE_CLIENT = "22222222-2222-4222-8222-222222222222";
const DEVIS = "33333333-3333-4333-8333-333333333333";

const m = vi.hoisted(() => ({
  devis: vi.fn(),
  outbox: vi.fn(),
  garer: vi.fn(),
  garde: vi.fn(),
  echanges: vi.fn(),
  log: vi.fn(),
  transport: vi.fn(),
  liste: vi.fn(),
  refuser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` });
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: { findFirst: m.devis },
    emailOutbox: { findFirst: m.outbox, findMany: m.liste, updateMany: m.refuser },
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: m.garde,
  logQualiopiActivity: m.log,
}));
vi.mock("@/server/email/outbox-service", () => ({ garerPourValidation: m.garer }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: m.transport }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: m.transport }) },
  createTransport: () => ({ sendMail: m.transport }),
}));
vi.mock("../../acces", () => ({
  AccesRefuse: class AccesRefuse extends Error {},
  exigerAccesEchanges: m.echanges,
}));

import { preparerRelanceDevisAction } from "../actions-relance-devis";
import {
  construireRelanceDevis,
  ERREUR_CONTACT_ABSENT,
  ERREUR_DEVIS_INTROUVABLE,
  ERREUR_DEVIS_PERIME,
  ERREUR_GARAGE,
  MESSAGE_RELANCE_PRETE,
} from "../relance-devis";

function formulaire(clientId = CLIENT, devisId = DEVIS): FormData {
  const fd = new FormData();
  fd.set("clientId", clientId);
  fd.set("devisId", devisId);
  return fd;
}

async function lancer(fd = formulaire()): Promise<string> {
  try {
    await preparerRelanceDevisAction(fd);
  } catch (e) {
    const digest = (e as { digest?: string }).digest;
    if (digest?.startsWith("NEXT_REDIRECT")) return decodeURIComponent(digest);
    throw e;
  }
  return "";
}

const DEVIS_ENVOYE = {
  id: DEVIS,
  numero: "AXI-DEV-2026-014",
  sentAt: new Date("2026-10-01T10:00:00Z"),
  dateValidite: new Date(Date.now() + 86_400_000),
  client: {
    raisonSociale: "Atelier Martin",
    contactNom: null,
    contactEmail: "compta@martin.example",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  m.garde.mockResolvedValue({ userId: "u1", role: "admin" });
  m.echanges.mockResolvedValue({ userId: "u1", role: "admin" });
  m.devis.mockImplementation(async (a: { where: { clientId: string; statut: string } }) =>
    a.where.clientId === CLIENT && a.where.statut === "envoye" ? DEVIS_ENVOYE : null,
  );
  m.outbox.mockResolvedValue(null);
  m.garer.mockResolvedValue("outbox-1");
  m.liste.mockResolvedValue([{ id: "outbox-1", createdAt: new Date() }]);
  m.refuser.mockResolvedValue({ count: 0 });
});

describe("relance de devis (lot B9)", () => {
  it("gare le brouillon avec les bons clientId, entityType, entityId — sans rien envoyer", async () => {
    const url = await lancer();
    expect(m.garer).toHaveBeenCalledTimes(1);
    const arg = m.garer.mock.calls[0]![0];
    expect(arg).toMatchObject({
      template: "relance-devis-client",
      recipient: "compta@martin.example",
      clientId: CLIENT,
      entityType: "Devis",
      entityId: DEVIS,
    });
    expect(arg.jobId).toBe(`relance-devis:${DEVIS}`);
    expect(url).toContain("onglet=devis-factures");
    expect(url).toContain("message=");
    expect(m.transport).not.toHaveBeenCalled();
    expect(m.log).toHaveBeenCalledTimes(1);
  });

  it("refuse le devis d'un autre client", async () => {
    const url = await lancer(formulaire(AUTRE_CLIENT));
    expect(url).toContain(ERREUR_DEVIS_INTROUVABLE);
    expect(m.garer).not.toHaveBeenCalled();
  });

  it("n'accepte que les devis au statut envoyé (le filtre est dans la requête)", async () => {
    await lancer();
    expect(m.devis.mock.calls[0]![0].where).toMatchObject({
      id: DEVIS,
      clientId: CLIENT,
      statut: "envoye",
    });
    m.devis.mockResolvedValue(null);
    const url = await lancer();
    expect(url).toContain(ERREUR_DEVIS_INTROUVABLE);
    expect(m.garer).toHaveBeenCalledTimes(1);
  });

  it("refuse le doublon : un brouillon déjà à valider", async () => {
    m.outbox.mockResolvedValue({ id: "deja" });
    const url = await lancer();
    expect(url).toContain(MESSAGE_RELANCE_PRETE);
    expect(m.garer).not.toHaveBeenCalled();
  });

  it("garerPourValidation rend null : erreur, rien n'est envoyé", async () => {
    m.garer.mockResolvedValue(null);
    const url = await lancer();
    expect(url).toContain("erreur=");
    expect(url).toContain(ERREUR_GARAGE);
    expect(m.transport).not.toHaveBeenCalled();
    expect(m.log).not.toHaveBeenCalled();
  });

  it("refuse un rôle sans accès, avant toute lecture", async () => {
    m.echanges.mockRejectedValue(new Error("forbidden"));
    const url = await lancer();
    expect(url).toContain("erreur=");
    expect(m.devis).not.toHaveBeenCalled();
    expect(m.garer).not.toHaveBeenCalled();
  });

  it("refuse le rôle en lecture seule : base non lue, rien garé", async () => {
    m.garde.mockRejectedValue(new Error("lecture seule"));
    const url = await lancer();
    expect(url).toContain("erreur=");
    expect(m.devis).not.toHaveBeenCalled();
    expect(m.outbox).not.toHaveBeenCalled();
    expect(m.garer).not.toHaveBeenCalled();
    expect(m.transport).not.toHaveBeenCalled();
  });

  it("devis envoyé mais périmé : erreur claire, rien garé", async () => {
    m.devis.mockResolvedValue({ ...DEVIS_ENVOYE, dateValidite: new Date(Date.now() - 1000) });
    const url = await lancer();
    expect(url).toContain(ERREUR_DEVIS_PERIME);
    expect(m.garer).not.toHaveBeenCalled();
  });

  it("double clic : deux appels simultanés, le surplus est refusé (jamais supprimé)", async () => {
    // Le contrôle préalable laisse passer les deux appels (pas atomique).
    m.outbox.mockResolvedValue(null);
    m.garer.mockResolvedValueOnce("outbox-1").mockResolvedValueOnce("outbox-2");
    m.liste.mockResolvedValue([
      { id: "outbox-1", createdAt: new Date(1000) },
      { id: "outbox-2", createdAt: new Date(2000) },
    ]);
    const [a, b] = await Promise.all([lancer(), lancer()]);
    expect(m.garer).toHaveBeenCalledTimes(2);
    expect(a).toContain(MESSAGE_RELANCE_PRETE);
    expect(b).toContain(MESSAGE_RELANCE_PRETE);
    expect(m.refuser).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["outbox-2"] } }),
        data: expect.objectContaining({ statut: "refuse" }),
      }),
    );
    expect(m.transport).not.toHaveBeenCalled();
  });

  it("contact absent : erreur, rien garé", async () => {
    m.devis.mockResolvedValue({
      ...DEVIS_ENVOYE,
      client: { raisonSociale: "Atelier Martin", contactEmail: "" },
    });
    const url = await lancer();
    expect(url).toContain(ERREUR_CONTACT_ABSENT);
    expect(m.garer).not.toHaveBeenCalled();
  });
});

describe("texte de la relance", () => {
  const r = construireRelanceDevis({
    numero: "AXI-DEV-2026-014",
    envoyeLe: new Date("2026-10-01T10:00:00Z"),
    raisonSociale: "Atelier Martin",
    contactEmail: "compta@martin.example",
  });

  it("ne porte ni montant ni mot interdit", () => {
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const texte = `${r.sujet} ${JSON.stringify(r.payload)}`;
    expect(texte).not.toMatch(/€|\d\s?(?:HT|TTC)|euros?/i);
    expect(texte).not.toMatch(/certifi|qualiopi|grenoble|gain garanti/i);
    expect(r.payload.dateEnvoi).toBe("01/10/2026");
  });
});
