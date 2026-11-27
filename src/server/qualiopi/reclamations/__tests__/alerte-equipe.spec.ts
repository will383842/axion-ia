/** L6d — le dépôt appelle l'alerte ; si elle lève, le dépôt est accepté et l'accusé part. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  alerte: vi.fn(async (_a: unknown) => ({ prive: "sent", email: "queued" })),
  enqueueEmail: vi.fn(async () => ({ enqueued: true })),
  signaler: vi.fn(async (_m: string) => undefined),
}));

vi.mock("@/server/notifications/doublon-client", () => ({ doublerAlerteReclamation: h.alerte }));
vi.mock("@/server/notifications/channels/sentry", () => ({ signalerIncident: h.signaler }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: h.enqueueEmail }));
vi.mock("@/lib/prisma", () => ({
  prisma: { reclamationEtape: { create: vi.fn(async () => ({})) } },
}));
vi.mock("@/server/qualiopi/registres/reclamations-service", () => ({
  creerReclamation: vi.fn(async () => ({
    id: "rec-1",
    numero: "AXI-REC-2026-001",
    reclamantEmail: "a@exemple.fr",
    dateReception: new Date("2026-11-18T09:00:00Z"),
  })),
}));

import { deposerReclamation } from "../cycle-service";

const DEPOT = {
  qualite: "stagiaire",
  reclamantNom: "Personne Exemple",
  reclamantEmail: "a@exemple.fr",
  objet: "objet",
  description: "TEXTE-SECRET-DE-LA-RECLAMATION",
  dateReception: new Date("2026-11-18T09:00:00Z"),
  canal: "formulaire_public",
  auteur: { id: null, nom: "Dépôt public" },
} as unknown as Parameters<typeof deposerReclamation>[0];

beforeEach(() => vi.clearAllMocks());

describe("L6d : alerte à l'équipe au dépôt", () => {
  it("un dépôt déclenche une alerte sans le texte de la réclamation", async () => {
    const r = await deposerReclamation(DEPOT);
    expect(r.numero).toBe("AXI-REC-2026-001");
    expect(h.alerte).toHaveBeenCalledTimes(1);
    const a = h.alerte.mock.calls[0]![0] as Record<string, unknown>;
    expect(a).toEqual({ id: "rec-1", numero: "AXI-REC-2026-001", recueLe: DEPOT.dateReception });
    expect(JSON.stringify(a)).not.toContain("TEXTE-SECRET");
  });

  it("si l'alerte lève : dépôt accepté, accusé parti, erreur capturée", async () => {
    h.alerte.mockRejectedValueOnce(new Error("TEXTE-SECRET-DE-LA-RECLAMATION"));
    const r = await deposerReclamation(DEPOT);
    expect(r.accuse).toBe("envoye");
    expect(h.enqueueEmail).toHaveBeenCalledTimes(1);
    expect(h.signaler).toHaveBeenCalledTimes(1);
    expect(h.signaler.mock.calls[0]![0]).not.toContain("TEXTE-SECRET");
  });
});
