// Opposition à la prospection en un geste — lot 1b (2026-09-02).
//
// Gardé ici : le jeton est stable, signé, et ne se laisse ni forger ni
// altérer ; l'enregistrement est idempotent et pousse la liste d'opposition du
// CRM ; le préfixe distingue le jeton d'un jeton newsletter.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const create = vi.fn();
const syncOptOut = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOpposition: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      create: (...a: unknown[]) => create(...a),
    },
  },
}));
vi.mock("@/server/crm-sync", () => ({
  syncNewsletterOptOutToCrm: (...a: unknown[]) => syncOptOut(...a),
}));

import {
  jetonOpposition,
  lireJetonOpposition,
  estJetonOpposition,
  urlOpposition,
  enregistrerOpposition,
  estOpposee,
} from "./opposition";

beforeEach(() => {
  findUnique.mockReset().mockResolvedValue(null);
  create.mockReset().mockResolvedValue({ id: "opp-1" });
  syncOptOut.mockReset().mockResolvedValue(undefined);
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
  process.env["NEXT_PUBLIC_SITE_URL"] = "https://axion-ia.com";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("jeton d'opposition", () => {
  it("est stable, normalisé, et se relit vers la même adresse", () => {
    const a = jetonOpposition("Jean.Dupont@Client.FR");
    const b = jetonOpposition("  jean.dupont@client.fr ");
    expect(a).toBe(b);
    expect(a.startsWith("op1.")).toBe(true);
    expect(lireJetonOpposition(a)).toBe("jean.dupont@client.fr");
  });

  it("🔴 refuse un jeton altéré, forgé, ou d'un autre secret", () => {
    const bon = jetonOpposition("jean@client.fr");
    const [p, corps, sig] = bon.split(".") as [string, string, string];
    // adresse changée, signature conservée
    const autreCorps = Buffer.from("autre@client.fr").toString("base64url");
    expect(lireJetonOpposition(`${p}.${autreCorps}.${sig}`)).toBeNull();
    // signature altérée
    expect(lireJetonOpposition(`${p}.${corps}.${sig.slice(0, -1)}x`)).toBeNull();
    // signature d'un autre secret
    process.env["AUTH_SECRET"] = "un-autre-secret-tout-aussi-long-9876543210";
    expect(lireJetonOpposition(bon)).toBeNull();
  });

  it("refuse une adresse non normalisée dans le corps (majuscules, espaces)", () => {
    const corps = Buffer.from("Jean@Client.fr").toString("base64url");
    expect(lireJetonOpposition(`op1.${corps}.abc`)).toBeNull();
  });

  it("le préfixe distingue un jeton d'opposition d'un jeton newsletter", () => {
    expect(estJetonOpposition(jetonOpposition("x@y.fr"))).toBe(true);
    expect(estJetonOpposition("jeton-newsletter-opaque-0123456789")).toBe(false);
    expect(estJetonOpposition(null)).toBe(false);
  });

  it("l'URL pointe sur la porte commune, jeton encodé", () => {
    const url = urlOpposition("jean@client.fr");
    expect(url.startsWith("https://axion-ia.com/api/unsubscribe?token=op1.")).toBe(true);
    expect(lireJetonOpposition(decodeURIComponent(url.split("token=")[1]!))).toBe("jean@client.fr");
  });
});

describe("enregistrerOpposition", () => {
  it("🔴 écrit la ligne ET pousse la liste d'opposition du CRM", async () => {
    const r = await enregistrerOpposition(jetonOpposition("jean@client.fr"), {
      template: "roi-report",
    });
    expect(r).toEqual({ ok: true, email: "jean@client.fr", dejaOpposee: false });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "jean@client.fr", template: "roi-report" }),
      }),
    );
    expect(syncOptOut).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectRef: "site:email_opposition:opp-1",
        person: { email: "jean@client.fr" },
      }),
    );
  });

  it("est idempotent : une seconde opposition ne réécrit rien et le dit", async () => {
    findUnique.mockResolvedValue({ id: "opp-1" });
    const r = await enregistrerOpposition(jetonOpposition("jean@client.fr"));
    expect(r).toEqual({ ok: true, email: "jean@client.fr", dejaOpposee: true });
    expect(create).not.toHaveBeenCalled();
    expect(syncOptOut).not.toHaveBeenCalled();
  });

  it("refuse un jeton invalide sans toucher à la base", async () => {
    const r = await enregistrerOpposition("op1.nimporte.quoi");
    expect(r).toEqual({ ok: false, error: "invalid_token" });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rend « internal » quand la base refuse, sans lever", async () => {
    create.mockRejectedValue(new Error("base morte"));
    const r = await enregistrerOpposition(jetonOpposition("jean@client.fr"));
    expect(r).toEqual({ ok: false, error: "internal" });
  });
});

describe("estOpposee", () => {
  it("lit l'adresse normalisée", async () => {
    findUnique.mockResolvedValue({ id: "opp-1" });
    expect(await estOpposee("Jean@Client.FR")).toBe(true);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "jean@client.fr" } }),
    );
  });
});
