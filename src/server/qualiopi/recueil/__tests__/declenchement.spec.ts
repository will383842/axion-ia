/** Chantier QNC, L03 — « dès la demande » : éteint, une lecture et rien d'autre ; jamais d'exception. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  lire: vi.fn(),
  lancer: vi.fn(),
  envoi: vi.fn(),
  sentry: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: h.sentry }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/qualiopi/socle/interrupteurs", () => ({ lireInterrupteurQualiopi: h.lire }));
vi.mock("../lancement", () => ({ lancerRecueil: h.lancer }));
vi.mock("../envoi-email", () => {
  h.envoi();
  return { envoyerEmailRecueil: vi.fn() };
});

import { declencherRecueilALaCreation } from "../declenchement";

const S = "22222222-2222-4222-8222-222222222222";

beforeEach(() => vi.clearAllMocks());

describe("declencherRecueilALaCreation", () => {
  it("ÉTEINT : ne lance rien et n'importe pas la file d'e-mails", async () => {
    h.lire.mockResolvedValue("eteint");
    await declencherRecueilALaCreation(S, null);
    expect(h.lancer).not.toHaveBeenCalled();
    expect(h.envoi).not.toHaveBeenCalled();
  });

  it("ALLUMÉ : lance le recueil de la session", async () => {
    h.lire.mockResolvedValue("actif");
    h.lancer.mockResolvedValue({ etat: "lance", questionnaireId: "q", envoye: true });
    await declencherRecueilALaCreation(S, "admin");
    expect(h.lancer).toHaveBeenCalledWith(
      {},
      { sessionId: S, auteurId: "admin" },
      expect.anything(),
    );
  });

  it("une panne n'empêche JAMAIS la création de session : elle est signalée, pas levée", async () => {
    h.lire.mockResolvedValue("actif");
    h.lancer.mockRejectedValue(new Error("base muette"));
    await expect(declencherRecueilALaCreation(S, null)).resolves.toBeUndefined();
    expect(h.sentry).toHaveBeenCalledTimes(1);
  });
});
