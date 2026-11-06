// Opposition à la prospection en un geste — lot 1b (2026-09-02).
//
// Gardé ici : le jeton est stable, signé, et ne se laisse ni forger ni
// altérer ; l'enregistrement est idempotent et pousse la liste d'opposition du
// CRM ; le préfixe distingue le jeton d'un jeton newsletter.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const create = vi.fn();
const syncOptOut = vi.fn();
const findFirstOutbox = vi.fn();
const sentryCapture = vi.fn();
const suppressions = vi.fn();
const updateMany = vi.fn();
const lireMarques = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureException: (...a: unknown[]) => sentryCapture(...a),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmSyncOutbox: {
      findFirst: (...a: unknown[]) => findFirstOutbox(...a),
      delete: (...a: unknown[]) => suppressions(...a),
      deleteMany: (...a: unknown[]) => suppressions(...a),
    },
    emailOpposition: {
      // Lecture des deux marques (par id) ou recherche par empreinte.
      findUnique: (...a: unknown[]) =>
        (a[0] as { where: { id?: string } }).where.id !== undefined
          ? lireMarques(...a)
          : findUnique(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
      create: (...a: unknown[]) => create(...a),
      delete: (...a: unknown[]) => suppressions(...a),
      deleteMany: (...a: unknown[]) => suppressions(...a),
    },
  },
}));
vi.mock("@/server/crm-sync", () => ({
  syncNewsletterOptOutToCrm: (...a: unknown[]) => syncOptOut(...a),
}));
const annulerRelances = vi.fn();
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: (...a: unknown[]) => annulerRelances(...a),
}));

import { hashEmailForLookup } from "@/lib/security/email-hash";

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
  // La file « voit » la ligne dès que le CRM a été appelé (cas nominal).
  findFirstOutbox
    .mockReset()
    .mockImplementation(async () => (syncOptOut.mock.calls.length > 0 ? { id: "ob-1" } : null));
  sentryCapture.mockReset();
  suppressions.mockReset();
  updateMany.mockReset().mockResolvedValue({ count: 1 });
  lireMarques.mockReset().mockResolvedValue({ crmEnAttenteDepuis: null, crmInterditLe: null });
  process.env["CRM_SYNC_ENABLED"] = "true";
  annulerRelances.mockReset().mockResolvedValue(0);
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
    expect(r).toEqual({ ok: true, email: "jean@client.fr", dejaOpposee: false, crmAverti: true });
    // 🔴 La table ne porte QUE l'empreinte : une liste d'opposition survit à
    // l'effacement, donc elle ne contient aucune adresse lisible.
    const ecrit = create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(ecrit.data["emailHash"]).toBe(hashEmailForLookup("jean@client.fr"));
    expect(ecrit.data["template"]).toBe("roi-report");
    expect(ecrit.data).not.toHaveProperty("email");
    expect(syncOptOut).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectRef: "site:email_opposition:opp-1",
        person: { email: "jean@client.fr" },
      }),
    );
  });

  it("ligne de file déjà présente → CRM non rappelé, crmAverti:true", async () => {
    findUnique.mockResolvedValue({ id: "opp-1" });
    findFirstOutbox.mockResolvedValue({ id: "ob-0" });
    const r = await enregistrerOpposition(jetonOpposition("jean@client.fr"));
    expect(r).toEqual({ ok: true, email: "jean@client.fr", dejaOpposee: true, crmAverti: true });
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
      expect.objectContaining({ where: { emailHash: hashEmailForLookup("jean@client.fr") } }),
    );
  });
});

describe("2026-09-19 — l'opposition annule les envois déjà programmés", () => {
  it("🔴 une opposition neuve retire relances, kit et invitation en attente", async () => {
    await enregistrerOpposition(jetonOpposition("jean@client.fr"));
    expect(annulerRelances).toHaveBeenCalledWith(
      "jean@client.fr",
      "Envoi annulé : la personne s'est opposée aux sollicitations.",
    );
  });

  it("🔴 AUSSI quand l'opposition existait déjà : un second clic rattrape un job resté en file", async () => {
    findUnique.mockResolvedValue({ id: "opp-1" });
    const r = await enregistrerOpposition(jetonOpposition("jean@client.fr"));
    expect(r).toMatchObject({ ok: true, dejaOpposee: true });
    expect(annulerRelances).toHaveBeenCalledWith("jean@client.fr", expect.any(String));
  });

  it("une file indisponible ne fait pas échouer l'opposition", async () => {
    annulerRelances.mockRejectedValue(new Error("redis mort"));
    const r = await enregistrerOpposition(jetonOpposition("jean@client.fr"));
    expect(r).toEqual({ ok: true, email: "jean@client.fr", dejaOpposee: false, crmAverti: true });
  });
});

describe("réessai idempotent de l'avertissement CRM", () => {
  const jeton = () => jetonOpposition("jean@client.fr");

  it("création sans ligne de file après l'appel → crmAverti:false, relances annulées, aucune suppression", async () => {
    findFirstOutbox.mockResolvedValue(null);
    const r = await enregistrerOpposition(jeton());
    expect(r).toEqual({ ok: true, email: "jean@client.fr", dejaOpposee: false, crmAverti: false });
    expect(create).toHaveBeenCalledTimes(1);
    expect(annulerRelances).toHaveBeenCalledTimes(1);
    expect(suppressions).not.toHaveBeenCalled();
  });

  it("syncOptOut lève → ligne gardée, relances annulées, crmAverti:false", async () => {
    syncOptOut.mockRejectedValue(new Error("crm mort jean@client.fr"));
    findFirstOutbox.mockResolvedValue(null);
    const r = await enregistrerOpposition(jeton());
    expect(r).toMatchObject({ ok: true, dejaOpposee: false, crmAverti: false });
    expect(create).toHaveBeenCalledTimes(1);
    expect(annulerRelances).toHaveBeenCalledTimes(1);
    expect(suppressions).not.toHaveBeenCalled();
  });

  it("adresse déjà en base sans ligne de file → CRM rappelé avec même subjectRef et même eventId", async () => {
    // Premier passage : le CRM échoue.
    findFirstOutbox.mockResolvedValue(null);
    await enregistrerOpposition(jeton());
    const premier = syncOptOut.mock.calls[0]![0] as { subjectRef: string; eventId: string };
    // Renvoi : la ligne existe, la file est toujours vide, puis se remplit.
    syncOptOut.mockClear();
    lireMarques.mockResolvedValue({ crmEnAttenteDepuis: new Date(), crmInterditLe: null });
    findUnique.mockResolvedValue({ id: "opp-1" });
    findFirstOutbox.mockReset().mockResolvedValueOnce(null).mockResolvedValue({ id: "ob-2" });
    const r = await enregistrerOpposition(jeton());
    expect(r).toEqual({ ok: true, email: "jean@client.fr", dejaOpposee: true, crmAverti: true });
    const second = syncOptOut.mock.calls[0]![0] as { subjectRef: string; eventId: string };
    expect(second.subjectRef).toBe("site:email_opposition:opp-1");
    expect(second.subjectRef).toBe(premier.subjectRef);
    expect(second.eventId).toBe(premier.eventId);
    expect(second.eventId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("erreur d'unicité P2002 à la création → relit et rend dejaOpposee:true", async () => {
    create.mockRejectedValue(Object.assign(new Error("Unique"), { code: "P2002" }));
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "opp-9" });
    lireMarques.mockResolvedValue({ crmEnAttenteDepuis: new Date(), crmInterditLe: null });
    const r = await enregistrerOpposition(jeton());
    expect(r).toMatchObject({ ok: true, dejaOpposee: true });
    expect(syncOptOut).toHaveBeenCalledWith(
      expect.objectContaining({ subjectRef: "site:email_opposition:opp-9" }),
    );
  });

  it("drapeau CRM coupé → crmAverti:true sans lire la file", async () => {
    process.env["CRM_SYNC_ENABLED"] = "false";
    const r = await enregistrerOpposition(jeton());
    expect(r).toMatchObject({ ok: true, crmAverti: true });
    expect(findFirstOutbox).not.toHaveBeenCalled();
  });

  it("(8) lecture de la file en erreur → crmAverti:false + Sentry {name} sans adresse", async () => {
    findFirstOutbox.mockRejectedValue(new Error("base jean@client.fr"));
    const r = await enregistrerOpposition(jeton());
    expect(r).toMatchObject({ ok: true, crmAverti: false });
    const appel = sentryCapture.mock.calls.find(
      (c) => (c[1] as { tags: { step: string } }).tags.step === "lire-file-crm",
    );
    expect(appel![0]).toEqual({ name: "Error" });
    expect(JSON.stringify(sentryCapture.mock.calls)).not.toContain("jean");
  });

  it("🔴 annulerRelances lève une erreur contenant l'adresse → Sentry ne reçoit pas l'adresse", async () => {
    annulerRelances.mockRejectedValue(new Error("échec jean@client.fr"));
    await enregistrerOpposition(jeton());
    expect(sentryCapture).toHaveBeenCalled();
    expect(sentryCapture.mock.calls[0]![0]).toEqual({ name: "Error" });
    const tout = JSON.stringify(sentryCapture.mock.calls);
    expect(tout).not.toContain("jean@client.fr");
    expect(tout).not.toContain("jean");
  });
});

describe("🔴 RGPD — le CRM ne reçoit jamais une adresse déjà en base sans attente posée", () => {
  const jeton = () => jetonOpposition("jean@client.fr");

  it("(1) adresse déjà en base, attente vide, file vide → CRM non appelé, crmAverti:true", async () => {
    findUnique.mockResolvedValue({ id: "opp-1" });
    findFirstOutbox.mockResolvedValue(null);
    const r = await enregistrerOpposition(jeton());
    expect(r).toEqual({ ok: true, email: "jean@client.fr", dejaOpposee: true, crmAverti: true });
    expect(syncOptOut).not.toHaveBeenCalled();
  });

  it("(2) attente ET interdit renseignées, file vide → CRM non appelé", async () => {
    findUnique.mockResolvedValue({ id: "opp-1" });
    findFirstOutbox.mockResolvedValue(null);
    lireMarques.mockResolvedValue({ crmEnAttenteDepuis: new Date(), crmInterditLe: new Date() });
    const r = await enregistrerOpposition(jeton());
    expect(r).toMatchObject({ ok: true, dejaOpposee: true });
    expect(syncOptOut).not.toHaveBeenCalled();
  });

  it("(9) lecture des deux colonnes en erreur → CRM non appelé (fermé par défaut)", async () => {
    findUnique.mockResolvedValue({ id: "opp-1" });
    findFirstOutbox.mockResolvedValue(null);
    lireMarques.mockRejectedValue(new Error("base"));
    const r = await enregistrerOpposition(jeton());
    expect(r).toMatchObject({ ok: true, crmAverti: false });
    expect(syncOptOut).not.toHaveBeenCalled();
  });

  it("(6) création : l'attente est posée APRÈS le create, par une requête séparée", async () => {
    findFirstOutbox.mockResolvedValue(null);
    await enregistrerOpposition(jeton());
    const data = (create.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data).not.toHaveProperty("crmEnAttenteDepuis");
    const pose = updateMany.mock.calls.find(
      (c) => (c[0] as { data: Record<string, unknown> }).data["crmEnAttenteDepuis"] instanceof Date,
    );
    expect(pose).toBeDefined();
    expect(create.mock.invocationCallOrder[0]!).toBeLessThan(
      updateMany.mock.invocationCallOrder[0]!,
    );
  });

  it("échec de la pose de l'attente → l'opposition n'est pas bloquée, Sentry {name}", async () => {
    updateMany.mockRejectedValueOnce(new Error("base jean@client.fr"));
    const r = await enregistrerOpposition(jeton());
    expect(r).toMatchObject({ ok: true, dejaOpposee: false });
    expect(JSON.stringify(sentryCapture.mock.calls)).not.toContain("jean");
  });

  it("(6) ligne de file constatée → attente remise à NULL, seulement si non interdite", async () => {
    findUnique.mockResolvedValue({ id: "opp-1" });
    findFirstOutbox.mockResolvedValue({ id: "ob-0" });
    await enregistrerOpposition(jeton());
    const remise = updateMany.mock.calls.find(
      (c) => (c[0] as { data: Record<string, unknown> }).data["crmEnAttenteDepuis"] === null,
    );
    expect(remise).toBeDefined();
    expect((remise![0] as { where: Record<string, unknown> }).where).toMatchObject({
      id: "opp-1",
      crmInterditLe: null,
    });
  });
});
