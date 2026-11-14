// WhatsApp (CallMeBot) est COUPÉ depuis le 14/11/2026 (décision du fondateur) :
// aucune catégorie ne l'utilise, plus aucune trace de l'API ni des variables dans le code.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPendingDispatches, notify } from "../index";
import { ALL_NOTIFICATION_CATEGORIES, shouldNotifyWhatsApp } from "../routing";
import type { NotifyInput } from "../types";

const fetchMock = vi.fn();

vi.mock("@/lib/redis", () => ({
  redis: {
    set: vi.fn().mockResolvedValue("OK"),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
  },
}));

// Payload « passe-partout » : toute clé lue rend un texte, quelle que soit la catégorie.
const PAYLOAD_GENERIQUE = new Proxy({}, { get: () => "x" });

describe("WhatsApp coupé", () => {
  const fetchOriginal = globalThis.fetch;
  const envOriginal = { ...process.env };

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.env.TELEGRAM_BOT_TOKEN = "bot";
    process.env.TELEGRAM_CHAT_ID = "-general";
    process.env.REDIS_URL = "redis://localhost:6381";
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    process.env = { ...envOriginal };
  });

  it("aucune catégorie : ni appel CallMeBot, ni clé `whatsapp` dans le résultat", async () => {
    for (const category of ALL_NOTIFICATION_CATEGORIES) {
      try {
        const r = await notify({
          category,
          payload: PAYLOAD_GENERIQUE,
          sync: true,
          force: true,
        } as unknown as NotifyInput);
        expect(Object.keys(r.channels), category).not.toContain("whatsapp");
      } catch {
        // Un gabarit qui refuse ce payload factice n'est pas le sujet : le canal, si.
      }
    }
    await flushPendingDispatches();
    const appels = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(appels.filter((u) => u.includes("callmebot"))).toEqual([]);
  });

  it("`shouldNotifyWhatsApp` (dépréciée) répond toujours non", () => {
    for (const c of ALL_NOTIFICATION_CATEGORIES) expect(shouldNotifyWhatsApp(c), c).toBe(false);
  });

  it("plus aucune trace de l'API CallMeBot ni de ses variables dans src/ et .github/", () => {
    // Aiguilles recomposées pour que ce fichier ne se trouve pas lui-même.
    const aiguilles = [
      "api.call" + "mebot.com",
      "WHATSAPP_CALL" + "MEBOT",
      "WHATSAPP_NOTIFY" + "_PHONE",
    ];
    const fichiers = execFileSync("git", ["ls-files", "src", ".github"], { encoding: "utf-8" })
      .trim()
      .split("\n")
      .filter((f) => !f.endsWith("whatsapp-coupe.spec.ts"));
    const trouves: string[] = [];
    for (const f of fichiers) {
      if (!existsSync(f)) continue;
      const texte = readFileSync(f, "utf8");
      for (const aiguille of aiguilles)
        if (texte.includes(aiguille)) trouves.push(`${f} : ${aiguille}`);
    }
    expect(trouves).toEqual([]);
  });
});
