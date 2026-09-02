// Liste de suppression — audit e-mails du 2026-09-02.
//
// Ce qui est gardé ici : les DEUX portées (rebond dur = tout ; désabonnement =
// marketing seul, opt-in exempté), le repli assumé (base muette = envoi
// maintenu, mais bruyant), et l'alerte dédoublonnée par adresse.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirst = vi.fn();
const findUnique = vi.fn();
const creerOuDedup = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: { findFirst: (...a: unknown[]) => findFirst(...a) },
    newsletterSubscriber: { findUnique: (...a: unknown[]) => findUnique(...a) },
    emailOpposition: { findUnique: (...a: unknown[]) => oppositionFindUnique(...a) },
  },
}));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: (...a: unknown[]) => creerOuDedup(...a),
}));
const oppositionFindUnique = vi.fn();

import { verdictAvantEnvoi, signalerRetenue } from "./suppression";

beforeEach(() => {
  findFirst.mockReset().mockResolvedValue(null);
  findUnique.mockReset().mockResolvedValue(null);
  creerOuDedup.mockReset().mockResolvedValue(null);
  oppositionFindUnique.mockReset().mockResolvedValue(null);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("verdictAvantEnvoi — rebond dur", () => {
  it("🔴 retient TOUT envoi vers une adresse qui a rebondi dur, réglementaire compris", async () => {
    findFirst.mockResolvedValue({ bouncedAt: new Date("2026-09-01T10:00:00Z") });
    const v = await verdictAvantEnvoi("mort@client.fr", {
      template: "qualiopi-convocation",
      marketing: false,
    });
    expect(v).toEqual({
      retenu: true,
      motif: "rebond_dur",
      depuis: new Date("2026-09-01T10:00:00Z"),
    });
    // La requête ne regarde QUE les rebonds durs : un mou ne retient rien.
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bounceType: "hard", recipient: "mort@client.fr" }),
      }),
    );
  });

  it("laisse passer quand aucun rebond dur n'est connu", async () => {
    const v = await verdictAvantEnvoi("ok@client.fr", {
      template: "qualiopi-convocation",
      marketing: false,
    });
    expect(v).toEqual({ retenu: false });
  });

  it("ne consulte pas la base pour une adresse vide", async () => {
    const v = await verdictAvantEnvoi("   ", { template: "x", marketing: true });
    expect(v).toEqual({ retenu: false });
    expect(findFirst).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("⚠️ base muette : l'envoi est MAINTENU, et le repli est bruyant", async () => {
    findFirst.mockRejectedValue(new Error("ECONNREFUSED"));
    const v = await verdictAvantEnvoi("x@client.fr", {
      template: "qualiopi-convocation",
      marketing: false,
    });
    expect(v).toEqual({ retenu: false });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("envoi maintenu"),
      expect.stringContaining("ECONNREFUSED"),
    );
  });
});

describe("verdictAvantEnvoi — désabonnement", () => {
  it("🔴 retient un envoi MARKETING vers une personne désabonnée", async () => {
    findUnique.mockResolvedValue({
      status: "unsubscribed",
      unsubscribedAt: new Date("2026-08-15T00:00:00Z"),
    });
    const v = await verdictAvantEnvoi("parti@client.fr", {
      template: "campagne-x",
      marketing: true,
    });
    expect(v).toEqual({
      retenu: true,
      motif: "desabonne",
      depuis: new Date("2026-08-15T00:00:00Z"),
    });
  });

  it("ne retient PAS un envoi transactionnel vers une personne désabonnée", async () => {
    findUnique.mockResolvedValue({ status: "unsubscribed", unsubscribedAt: new Date() });
    const v = await verdictAvantEnvoi("parti@client.fr", {
      template: "facture-envoi",
      marketing: false,
    });
    expect(v).toEqual({ retenu: false });
    // Sans marketing, on ne lit même pas la table des abonnés.
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("laisse passer la confirmation de double opt-in, sinon un désabonnement serait irréversible", async () => {
    findUnique.mockResolvedValue({ status: "unsubscribed", unsubscribedAt: new Date() });
    const v = await verdictAvantEnvoi("revient@client.fr", {
      template: "newsletter-confirm-optin",
      marketing: true,
    });
    expect(v).toEqual({ retenu: false });
  });

  it("🔴 lot 1b : une opposition à la prospection retient un envoi marketing", async () => {
    oppositionFindUnique.mockResolvedValue({ id: "opp-1" });
    const v = await verdictAvantEnvoi("oppose@client.fr", {
      template: "campagne-x",
      marketing: true,
    });
    expect(v).toEqual({ retenu: true, motif: "oppose", depuis: null });
  });

  it("l'opposition ne retient PAS un envoi transactionnel (facture, convocation)", async () => {
    oppositionFindUnique.mockResolvedValue({ id: "opp-1" });
    const v = await verdictAvantEnvoi("oppose@client.fr", {
      template: "qualiopi-convocation",
      marketing: false,
    });
    expect(v).toEqual({ retenu: false });
    expect(oppositionFindUnique).not.toHaveBeenCalled();
  });

  it("un abonné actif ou inconnu passe", async () => {
    findUnique.mockResolvedValue({ status: "confirmed", unsubscribedAt: null });
    expect(
      await verdictAvantEnvoi("actif@client.fr", { template: "campagne-x", marketing: true }),
    ).toEqual({ retenu: false });
    findUnique.mockResolvedValue(null);
    expect(
      await verdictAvantEnvoi("inconnu@client.fr", { template: "campagne-x", marketing: true }),
    ).toEqual({ retenu: false });
  });

  it("le rebond dur prime sur tout, marketing compris", async () => {
    findFirst.mockResolvedValue({ bouncedAt: null });
    findUnique.mockResolvedValue({ status: "unsubscribed", unsubscribedAt: new Date() });
    const v = await verdictAvantEnvoi("mort@client.fr", {
      template: "campagne-x",
      marketing: true,
    });
    expect(v).toEqual({ retenu: true, motif: "rebond_dur", depuis: null });
  });

  it("reste muette au build (base stub)", async () => {
    const avant = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const v = await verdictAvantEnvoi("x@client.fr", { template: "x", marketing: true });
      expect(v).toEqual({ retenu: false });
      expect(findFirst).not.toHaveBeenCalled();
    } finally {
      if (avant === undefined) delete process.env["DATABASE_URL"];
      else process.env["DATABASE_URL"] = avant;
    }
  });
});

describe("signalerRetenue", () => {
  it("lève une alerte console dédoublonnée PAR ADRESSE, avec le geste à faire", async () => {
    await signalerRetenue("mort@client.fr", "qualiopi-convocation", {
      retenu: true,
      motif: "rebond_dur",
      depuis: new Date("2026-09-01T10:00:00Z"),
    });
    expect(creerOuDedup).toHaveBeenCalledTimes(1);
    const alerte = creerOuDedup.mock.calls[0]![0] as Record<string, unknown>;
    expect(alerte["code"]).toBe("email_retenu_rebond_dur");
    expect(alerte["cibleId"]).toBe("mort@client.fr");
    expect(alerte["niveau"]).toBe("important");
    expect(String(alerte["message"])).toContain("qualiopi-convocation");
    expect(String(alerte["message"])).toContain("2026-09-01");
    expect(String(alerte["message"])).toContain("Corriger l'adresse");
  });

  it("n'échoue jamais l'appelant quand l'alerte est impossible", async () => {
    creerOuDedup.mockRejectedValue(new Error("base morte"));
    await expect(
      signalerRetenue("x@client.fr", "campagne-x", {
        retenu: true,
        motif: "desabonne",
        depuis: null,
      }),
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
