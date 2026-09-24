// @vitest-environment node
//
// Vérification MX (lot L2) : une faute dans le DOMAINE se corrige au
// formulaire, pas en rebond dur sur le compte des factures. Et une panne de
// résolveur ne coupe JAMAIS le formulaire.

import { describe, it, expect, vi, beforeEach } from "vitest";

const resolveMx = vi.fn();
const resolve4 = vi.fn();
const resolve6 = vi.fn();

vi.mock("node:dns", () => ({
  promises: {
    resolveMx: (...a: unknown[]) => resolveMx(...a),
    resolve4: (...a: unknown[]) => resolve4(...a),
    resolve6: (...a: unknown[]) => resolve6(...a),
  },
}));

import { domaineRecoitDesEmails } from "../mx";

const erreur = (code: string) => Object.assign(new Error(code), { code });

beforeEach(() => {
  resolveMx.mockReset();
  resolve4.mockReset().mockRejectedValue(erreur("ENODATA"));
  resolve6.mockReset().mockRejectedValue(erreur("ENODATA"));
});

describe("domaineRecoitDesEmails", () => {
  it("témoin : un MX réel → oui", async () => {
    resolveMx.mockResolvedValue([{ exchange: "mx.example.invalid", priority: 10 }]);
    expect(await domaineRecoitDesEmails("jeanne@example.invalid")).toBe("oui");
    expect(resolveMx).toHaveBeenCalledWith("example.invalid");
  });

  it("🔴 domaine inexistant (faute de frappe) → non", async () => {
    resolveMx.mockRejectedValue(erreur("ENOTFOUND"));
    expect(await domaineRecoitDesEmails("jeanne@exmaple.invalid")).toBe("non");
  });

  it("🔴 MX nul (RFC 7505) → non : le domaine déclare ne rien recevoir", async () => {
    resolveMx.mockResolvedValue([{ exchange: ".", priority: 0 }]);
    expect(await domaineRecoitDesEmails("jeanne@example.invalid")).toBe("non");
  });

  it("pas de MX mais une adresse A → oui (RFC 5321 §5.1)", async () => {
    resolveMx.mockRejectedValue(erreur("ENODATA"));
    resolve4.mockResolvedValue(["192.0.2.10"]);
    expect(await domaineRecoitDesEmails("jeanne@example.invalid")).toBe("oui");
  });

  it("ni MX ni adresse → non", async () => {
    resolveMx.mockRejectedValue(erreur("ENODATA"));
    expect(await domaineRecoitDesEmails("jeanne@example.invalid")).toBe("non");
  });

  it("🔴 panne du résolveur → inconnu, et le formulaire laisse passer", async () => {
    resolveMx.mockRejectedValue(erreur("ESERVFAIL"));
    expect(await domaineRecoitDesEmails("jeanne@example.invalid")).toBe("inconnu");
  });

  it("adresse sans domaine → non, sans interroger le DNS", async () => {
    expect(await domaineRecoitDesEmails("jeanne@")).toBe("non");
    expect(resolveMx).not.toHaveBeenCalled();
  });
});
