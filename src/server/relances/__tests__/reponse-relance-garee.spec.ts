// Relecture du lot 8A — la corbeille signale une réponse du formateur arrivée après la
// mise en attente d'une relance ; rien pour les autres e-mails.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/email/outbox-service", () => ({ jobIdDejaGare: vi.fn() }));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({ envoyer: vi.fn() }));

import { reponsesApresMiseEnAttente, type LigneGaree } from "../reponse-relance-garee";

const GAREE = new Date("2026-10-10T08:00:00Z");
const ligne = (over: Partial<LigneGaree> = {}): LigneGaree => ({
  id: "o1",
  entityType: "Trainer",
  entityId: "t1",
  jobId: "fi-lettre-j3-t1-d1-j-3",
  createdAt: GAREE,
  ...over,
});
const jour = (j: number) => new Date(GAREE.getTime() + j * 86_400_000);

describe("réponse du formateur sur une relance garée", () => {
  it("réponse après la mise en attente : la dernière est signalée", () => {
    const m = reponsesApresMiseEnAttente([ligne()], new Map([["t1", [jour(1), jour(2)]]]));
    expect(m.get("o1")).toEqual(jour(2));
  });
  it("réponse avant la mise en attente : rien", () => {
    expect(reponsesApresMiseEnAttente([ligne()], new Map([["t1", [jour(-1)]]])).size).toBe(0);
  });
  it("e-mail qui n'est pas une relance formateur (client, apporteur, envoi direct) : rien", () => {
    const r = new Map([["t1", [jour(1)]]]);
    expect(reponsesApresMiseEnAttente([ligne({ entityType: "Client" })], r).size).toBe(0);
    expect(reponsesApresMiseEnAttente([ligne({ jobId: null })], r).size).toBe(0);
    expect(reponsesApresMiseEnAttente([ligne({ jobId: "devis-1" })], r).size).toBe(0);
  });
  it("réponses illisibles : rien (l'écran reste utilisable)", () => {
    expect(reponsesApresMiseEnAttente([ligne()], null).size).toBe(0);
  });
});
