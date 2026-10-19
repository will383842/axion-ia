import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/server/qualiopi/portail/portail-service", () => ({ verifierToken: vi.fn() }));
vi.mock("@/server/qualiopi/portail/cookie", () => ({ setPortailCookie: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));
vi.mock("@/server/qualiopi/portail/ouvertures-espace", () => ({ tracerOuvertureEspace: vi.fn() }));

import { verifierToken } from "@/server/qualiopi/portail/portail-service";
import { setPortailCookie } from "@/server/qualiopi/portail/cookie";
import { tracerOuvertureEspace } from "@/server/qualiopi/portail/ouvertures-espace";
import { GET } from "./route";

const verif = verifierToken as ReturnType<typeof vi.fn>;
const trace = tracerOuvertureEspace as ReturnType<typeof vi.fn>;
const appel = (headers: Record<string, string> = {}) =>
  GET(new NextRequest("https://axion-ia.com/fr/portail/acces/tok", { headers }), {
    params: Promise.resolve({ locale: "fr", token: "tok" }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  verif.mockResolvedValue({ traineeId: "t1" });
});

describe("portail/acces/[token] — trace d'ouverture", () => {
  it("jeton valide : cookie, trace (origine par les en-têtes), 302 vers mon-espace", async () => {
    const r = await appel({
      "user-agent": "Mozilla/5.0 Chrome/130",
      "sec-fetch-user": "?1",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
    });
    expect(setPortailCookie).toHaveBeenCalledWith("tok");
    expect(trace).toHaveBeenCalledWith("t1", "navigateur");
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toMatch(/\/fr\/portail\/mon-espace$/);
  });

  it("aperçu automatique : origine apercu_automatique", async () => {
    await appel({ "user-agent": "Slackbot" });
    expect(trace).toHaveBeenCalledWith("t1", "apercu_automatique");
  });

  it("jeton invalide : aucune trace, redirection vers acces-invalide", async () => {
    verif.mockResolvedValue(null);
    const r = await appel();
    expect(trace).not.toHaveBeenCalled();
    expect(r.headers.get("location")).toMatch(/acces-invalide$/);
  });

  it("la trace est fail-soft : sa promesse ne casse pas l'accès (contrat du service)", async () => {
    trace.mockResolvedValue(undefined);
    expect((await appel()).status).toBe(302);
  });
});
