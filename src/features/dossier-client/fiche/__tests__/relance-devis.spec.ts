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
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` });
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { devis: { findFirst: m.devis }, emailOutbox: { findFirst: m.outbox } },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: m.garde,
  logQualiopiActivity: m.log,
}));
vi.mock("@/server/email/outbox-service", () => ({ garerPourValidation: m.garer }));
vi.mock("@/server/email/send", () => ({ sendEmail: m.transport, enqueueEmail: m.transport }));
vi.mock("../../acces", () => ({
  AccesRefuse: class AccesRefuse extends Error {},
  exigerAccesEchanges: m.echanges,
}));

import {
  ERREUR_GARAGE,
  ERREUR_DEVIS_INTROUVABLE,
  MESSAGE_RELANCE_PRETE,
  preparerRelanceDevisAction,
} from "../actions-relance-devis";
import { construireRelanceDevis, ERREUR_CONTACT_ABSENT } from "../relance-devis";

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
  client: { raisonSociale: "Atelier Martin", contactEmail: "compta@martin.example" },
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
