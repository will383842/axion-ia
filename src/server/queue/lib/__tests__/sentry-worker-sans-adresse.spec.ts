// STOP-T1b (suite) — le message d'une erreur de relais cite l'adresse du destinataire :
// il ne doit atteindre Sentry (message, fingerprint) qu'avec l'adresse masquée.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { captureExceptionMock } = vi.hoisted(() => ({ captureExceptionMock: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));

import { captureWorkerError } from "../sentry-worker";

beforeEach(() => captureExceptionMock.mockReset());

describe("captureWorkerError ne transmet aucune adresse", () => {
  it("🔴 message, fingerprint et extra sont sans adresse en clair", () => {
    const err = new Error("550 5.1.1 <nadia@exemple.fr> user unknown");
    captureWorkerError("email", "emails", { id: "1", name: "x", data: {} } as never, err);
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    const [envoye, hint] = captureExceptionMock.mock.calls[0] as [Error, unknown];
    expect(envoye.message).not.toContain("nadia@");
    expect(envoye.message).toContain("@exemple.fr");
    expect(JSON.stringify(hint)).not.toContain("nadia@");
  });
});
