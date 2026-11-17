/**
 * Révision d'un devis : refus si le client a signé, opération répétable (double appel =
 * même identifiant, un seul numéro), pièce dont la signature est annulée ou révoquée =
 * révision autorisée.
 */

import { describe, expect, it, vi } from "vitest";

import { CLIENT, fausseBaseDevis } from "./_devis-transactionnel";

const h = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return h.db;
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: async () => ({
    userId: "55555555-5555-4555-8555-555555555555",
    role: "admin",
  }),
  requireHabilitation: async () => ({ userId: "u", role: "admin" }),
  logQualiopiActivity: async () => undefined,
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: async () => "assujetti",
}));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({ generateDocument: vi.fn() }));
vi.mock("@/server/actions/qualiopi/documents", () => ({ genererConventionAction: vi.fn() }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));

import { reviseDevisAction } from "../devis";

const ORIGINE = "66666666-6666-4666-8666-666666666666";

function semer(statut = "envoye") {
  const f = fausseBaseDevis({ collisionsAuCreate: 0 });
  f.etat.devis.push({
    id: ORIGINE,
    numero: "AXI-DEV-2026-001",
    statut,
    clientId: CLIENT,
    lignes: [],
    activite: null,
    refClient: null,
    financementSuggere: null,
    mentionTva: "x",
    montantTotalHtCents: 100000,
    montantOpcoEstimeCents: null,
    resteAChargeCents: null,
  });
  h.db = f.db;
  return f.etat;
}

describe("reviseDevisAction — garde de signature et répétabilité", () => {
  it("le client a signé : refus, aucune révision créée", async () => {
    const etat = semer();
    etat.signesParLeClient.push(ORIGINE);
    const r = await reviseDevisAction(ORIGINE);
    expect(r).toEqual({
      error:
        "Le client a déjà signé ce devis : contresignez-le ou refusez-le, il ne peut pas être corrigé.",
    });
    expect(etat.devis).toHaveLength(1);
  });

  it("signature annulée ou révoquée (le filtre « pas signé » la compte non signée) : autorisé", async () => {
    const etat = semer();
    // signesParLeClient vide = aucune signature client active (annulée / révoquée / absente)
    const r = await reviseDevisAction(ORIGINE);
    expect("data" in r).toBe(true);
    expect(etat.devis).toHaveLength(2);
  });

  it("double appel : même identifiant, un seul numéro attribué", async () => {
    const etat = semer();
    const a = await reviseDevisAction(ORIGINE);
    const b = await reviseDevisAction(ORIGINE);
    expect("data" in a && "data" in b).toBe(true);
    if ("data" in a && "data" in b) expect(b.data).toEqual(a.data);
    expect(etat.devis).toHaveLength(2);
  });
});
