/**
 * Révision : un devis accepté ne se révise plus (D1) ; le statut est lu AVANT la garde de
 * signature, pour qu'un devis accepté puis contresigné reçoive le bon message (D2).
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
const MSG_ACCEPTE =
  "Ce devis a été accepté : il ne peut plus être corrigé. Une modification après acceptation passe par un nouveau devis.";

function semer(statut: string) {
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

describe("reviseDevisAction — devis accepté", () => {
  it("devis accepté (signé puis contresigné) : message « accepté », pas « contresignez-le ou refusez-le »", async () => {
    const etat = semer("accepte");
    etat.signesParLeClient.push(ORIGINE);
    expect(await reviseDevisAction(ORIGINE)).toEqual({ error: MSG_ACCEPTE });
    expect(etat.devis).toHaveLength(1);
  });

  it("accepté entre la lecture et le verrou ET signé : le statut passe avant la garde de signature", async () => {
    const etat = semer("envoye");
    etat.signesParLeClient.push(ORIGINE);
    const base = h.db as { devis: { findUnique: (a: unknown) => Promise<unknown> } };
    const lire = base.devis.findUnique.bind(base.devis);
    base.devis.findUnique = async (a: unknown) => {
      const lu = (await lire(a)) as Record<string, unknown> | null;
      const copie = lu === null ? null : { ...lu };
      etat.devis[0]!["statut"] = "accepte";
      return copie;
    };
    expect(await reviseDevisAction(ORIGINE)).toEqual({ error: MSG_ACCEPTE });
  });

  it("devis envoyé et signé : toujours « contresignez-le ou refusez-le »", async () => {
    const etat = semer("envoye");
    etat.signesParLeClient.push(ORIGINE);
    expect(await reviseDevisAction(ORIGINE)).toEqual({
      error:
        "Le client a déjà signé ce devis : contresignez-le ou refusez-le, il ne peut pas être corrigé.",
    });
  });

  it("message d'avant transaction : « envoyé, refusé ou expiré » (plus « accepté »)", async () => {
    semer("brouillon");
    const r = await reviseDevisAction(ORIGINE);
    expect(r).toEqual({ error: "Seul un devis envoyé, refusé ou expiré peut être révisé." });
  });

  it.each(["envoye", "refuse", "expire"])("contre-témoin : « %s » se révise", async (statut) => {
    semer(statut);
    expect("data" in (await reviseDevisAction(ORIGINE))).toBe(true);
  });
});
