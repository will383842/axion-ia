/**
 * La révision ne change pas l'état d'un devis ACCEPTÉ, et reste dans son
 * projet (PR 7).
 *
 * `reviseDevisAction` crée une NOUVELLE version brouillon qui pointe
 * l'ancienne (`replacesDevisId`) ; l'ancienne n'est jamais modifiée ici (elle
 * passe `expire` à l'ENVOI de la nouvelle). Le lien `projet_devis` est recopié
 * dans la même transaction que la nouvelle version.
 *
 * Mutation qui rougit : un `devis.update` de l'origine dans la révision, ou
 * oublier `recopierLienProjet`.
 * Contre-témoin : une révision d'un devis sans projet ne crée aucun lien.
 */

import { describe, expect, it, vi } from "vitest";

import { CLIENT, fausseBaseDevis, PROJET } from "./_devis-transactionnel";

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

function semer(avecProjet: boolean) {
  const f = fausseBaseDevis({ collisionsAuCreate: 1 });
  f.etat.devis.push({
    id: ORIGINE,
    numero: "AXI-DEV-2026-001",
    statut: "accepte",
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
  if (avecProjet) f.etat.projetDevis.push({ devisId: ORIGINE, projetId: PROJET, clientId: CLIENT });
  h.db = f.db;
  return f.etat;
}

describe("la révision ne change pas l'état accepté", () => {
  it("nouvelle version liée au même projet ; l'origine n'est pas touchée", async () => {
    const etat = semer(true);
    const r = await reviseDevisAction(ORIGINE);
    expect("data" in r).toBe(true);
    expect(etat.devisMisAJour).toBe(0);
    expect(etat.devis.find((d) => d["id"] === ORIGINE)?.["statut"]).toBe("accepte");
    const nouvelle = etat.devis.find((d) => d["replacesDevisId"] === ORIGINE);
    expect(nouvelle?.["statut"]).toBe("brouillon");
    expect(etat.projetDevis.filter((l) => l["projetId"] === PROJET)).toHaveLength(2);
  });

  it("contre-témoin : sans projet d'origine, aucun lien", async () => {
    const etat = semer(false);
    await reviseDevisAction(ORIGINE);
    expect(etat.projetDevis).toHaveLength(0);
  });
});
