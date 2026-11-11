// Fiche J5 (plan « jeton op2 ») — sans connexion BullMQ, `enqueueEmail` avertit dans la console.
// L'avertissement ne doit pas porter l'adresse du destinataire en clair (règle : rien de
// personnel dans les journaux).

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../connection", () => ({
  getBullConnection: () => null,
  isBullmqDisabled: () => false,
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("enqueueEmail sans file", () => {
  it("🔴 n'écrit pas l'adresse en clair dans la console", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { enqueueEmail } = await import("../queues");
    const r = await enqueueEmail(
      "contact-confirmation" as never,
      "marie.durand@client.fr",
      "fr",
      {},
    );
    expect(r.enqueued).toBe(false);
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("marie.durand");
  });
});
