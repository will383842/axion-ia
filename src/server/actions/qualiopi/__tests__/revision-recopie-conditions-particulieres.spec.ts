/**
 * Révision d'un devis : les conditions particulières sont recopiées dans le brouillon de
 * révision (lecture dans le `select` ET écriture dans le `create`).
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

function semer(conditionsParticulieres: string | null) {
  const f = fausseBaseDevis({ collisionsAuCreate: 0 });
  f.etat.devis.push({
    id: ORIGINE,
    numero: "AXI-DEV-2026-001",
    statut: "envoye",
    clientId: CLIENT,
    lignes: [],
    activite: null,
    refClient: null,
    financementSuggere: null,
    mentionTva: "x",
    montantTotalHtCents: 100000,
    montantOpcoEstimeCents: null,
    resteAChargeCents: null,
    conditionsParticulieres,
  });
  const db = f.db as unknown as {
    devis: {
      findUnique: (a: { where: { id: string }; select?: Record<string, unknown> }) => unknown;
    };
  };
  const original = db.devis.findUnique;
  const selects: Array<Record<string, unknown> | undefined> = [];
  db.devis.findUnique = (a) => {
    selects.push(a.select);
    return original(a);
  };
  h.db = f.db;
  return { etat: f.etat, selects };
}

describe("reviseDevisAction — conditions particulières", () => {
  it("le `select` de l'origine lit la colonne", async () => {
    const { selects } = semer("Acompte de 30 %.");
    await reviseDevisAction(ORIGINE);
    expect(selects.some((s) => s?.["conditionsParticulieres"] === true)).toBe(true);
  });

  it("le brouillon de révision porte le texte de l'origine", async () => {
    const { etat } = semer("Acompte de 30 %.");
    const r = await reviseDevisAction(ORIGINE);
    expect("data" in r).toBe(true);
    const revision = etat.devis.find((d) => d["replacesDevisId"] === ORIGINE);
    expect(revision?.["conditionsParticulieres"]).toBe("Acompte de 30 %.");
  });

  it("origine sans texte : rien n'est écrit sur la révision", async () => {
    const { etat } = semer(null);
    await reviseDevisAction(ORIGINE);
    const revision = etat.devis.find((d) => d["replacesDevisId"] === ORIGINE);
    expect(revision && "conditionsParticulieres" in revision).toBe(false);
  });
});
