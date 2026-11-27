/**
 * L6d — le doublon d'une réclamation déposée : numéro, date, lien de la fiche ; jamais le texte de
 * la réclamation ni les coordonnées du déposant ; un rejeu ne renvoie pas une seconde alerte.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const redisSetMock = vi.fn();
const redisDelMock = vi.fn();
vi.mock("@/lib/redis", () => ({
  redis: {
    set: (...a: unknown[]) => redisSetMock(...a),
    del: (...a: unknown[]) => redisDelMock(...a),
    incr: vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
  },
}));

import {
  __reinitialiserPourTests as reinitialiserEnfileur,
  poserChargeurEnfileurEmail,
} from "../enfileur-email";
import {
  doublerAlerteReclamation,
  formatDoublonReclamation,
  objetAlerteClient,
} from "../doublon-client";
import { renderEmailTemplate } from "@/lib/email/templates";

const enqueueEmailMock = vi.fn();
const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;
const saved = { ...process.env };

const ALERTE = {
  id: "rec_1",
  numero: "AXI-REC-2026-007",
  recueLe: new Date("2026-11-18T09:00:00Z"),
};
const TEXTE_SECRET = "TEXTE-SECRET-DE-LA-RECLAMATION";

beforeEach(() => {
  reinitialiserEnfileur();
  poserChargeurEnfileurEmail(async () => enqueueEmailMock as never);
  fetchMock
    .mockReset()
    .mockImplementation(async () => new Response('{"ok":true}', { status: 200 }));
  enqueueEmailMock.mockReset().mockResolvedValue({ enqueued: true });
  redisSetMock.mockReset().mockResolvedValue("OK");
  redisDelMock.mockReset().mockResolvedValue(1);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  for (const k of Object.keys(process.env)) if (k.startsWith("TELEGRAM_")) delete process.env[k];
  process.env.TELEGRAM_BOT_TOKEN = "bot-principal";
  process.env.TELEGRAM_CHAT_ID_PRIVE = "4242";
  process.env.REDIS_URL = "redis://localhost:6381";
});

afterEach(() => {
  reinitialiserEnfileur();
  globalThis.fetch = originalFetch;
  process.env = { ...saved };
});

describe("L6d : l'alerte d'une réclamation", () => {
  it("un dépôt donne un e-mail et un message Telegram, sans texte de réclamation", async () => {
    const r = await doublerAlerteReclamation(ALERTE);
    expect(r).toEqual({ prive: "sent", email: "queued" });
    expect(enqueueEmailMock).toHaveBeenCalledTimes(1);
    const [gabarit, , , payload, opts] = enqueueEmailMock.mock.calls[0]!;
    expect(gabarit).toBe("alerte-demande-client");
    expect(JSON.stringify(payload)).toContain("AXI-REC-2026-007");
    expect(JSON.stringify(payload)).not.toContain(TEXTE_SECRET);
    expect(String((opts as { jobId: string }).jobId)).toMatch(/^alerte-client-/);
    const corps = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body) as {
      text: string;
      chat_id: string;
    };
    expect(corps.chat_id).toBe("4242");
    expect(corps.text).toContain("RÉCLAMATION");
    expect(corps.text).toContain("AXI-REC-2026-007");
    expect(corps.text).not.toContain(TEXTE_SECRET);
  });

  it("l'e-mail rendu (HTML et texte) a l'objet exact et ne porte que numéro, date et lien", async () => {
    await doublerAlerteReclamation(ALERTE);
    const payload = enqueueEmailMock.mock.calls[0]![3] as Record<string, unknown>;
    const rendu = await renderEmailTemplate("alerte-demande-client", "fr", payload);
    expect(rendu.subject).toBe("🔴 IMPORTANT DEMANDE CLIENT RÉCLAMATION");
    expect(objetAlerteClient("reclamation", "nouveau")).toBe(rendu.subject);
    for (const corps of [rendu.html, rendu.text]) {
      expect(corps).toContain("AXI-REC-2026-007");
      expect(corps).not.toContain(TEXTE_SECRET);
    }
    expect(formatDoublonReclamation(ALERTE)).not.toContain(TEXTE_SECRET);
  });

  it("un rejeu du dépôt ne renvoie pas une seconde alerte (clé = identifiant)", async () => {
    redisSetMock.mockImplementation(async () => null); // clés déjà posées
    const r = await doublerAlerteReclamation(ALERTE);
    expect(r).toEqual({ prive: "deduped", email: "deduped" });
    expect(enqueueEmailMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(redisSetMock.mock.calls.every((c) => String(c[0]).includes("rec_1"))).toBe(true);
  });

  it("ne lève jamais, même si tout échoue", async () => {
    enqueueEmailMock.mockRejectedValue(new Error("boom"));
    fetchMock.mockRejectedValue(new Error("réseau"));
    await expect(doublerAlerteReclamation(ALERTE)).resolves.toEqual({
      prive: "failed",
      email: "failed",
    });
  });
});
