// @vitest-environment node
//
// `POST /api/interne/confirmations-page-guide` — interrupteur, secret, signature, corps.
// Base simulée : on compte les appels Prisma (0 attendu partout où la route refuse).
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";

const { bd } = vi.hoisted(() => ({
  bd: { appelsPrisma: 0, cles: [] as string[], limiteRefusee: false },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (fn: (t: unknown) => Promise<unknown>) => {
      bd.appelsPrisma++;
      return fn({ $executeRaw: async () => 0, $queryRaw: async () => [] });
    },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async (cle: string) => {
    bd.cles.push(cle);
    return { allowed: !bd.limiteRefusee };
  },
}));

import * as module from "./route";
import { POST } from "./route";
import { signerRequete } from "@/server/videos/signature";

const SECRET = "c".repeat(40);
const CHEMIN = "/api/interne/confirmations-page-guide";

function appel(
  corps: unknown = { schemaVersion: 1 },
  opt: { secret?: string; decalage?: number; brut?: string; recherche?: string } = {},
): Promise<Response> {
  const texte = opt.brut ?? JSON.stringify(corps);
  const nonce = crypto.randomBytes(16).toString("hex");
  const horodatage = String(Math.floor(Date.now() / 1000) + (opt.decalage ?? 0));
  const signature = signerRequete({
    secret: opt.secret ?? SECRET,
    horodatage,
    nonce,
    methode: "POST",
    chemin: CHEMIN,
    corps: texte,
  });
  return POST(
    new NextRequest(`http://localhost${CHEMIN}${opt.recherche ?? ""}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-axion-horodatage": horodatage,
        "x-axion-nonce": nonce,
        "x-axion-signature": signature,
      },
      body: texte,
    }),
  );
}

beforeEach(() => {
  bd.appelsPrisma = 0;
  bd.cles.length = 0;
  bd.limiteRefusee = false;
  process.env.CONFIRMATIONS_PAGE_GUIDE_ENABLED = "true";
  process.env.GUIDES_RESEAU_HMAC_SECRET = SECRET;
  delete process.env.GUIDES_RESEAU_HMAC_SECRET_PRECEDENT;
  delete process.env.VIDEOS_STUDIO_HMAC_SECRET;
  process.env.DATABASE_URL = "postgresql://u:p@db.example.test:5432/x";
  for (const m of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, m).mockImplementation(() => undefined);
  }
});

describe("1 · interrupteur", () => {
  it.each([undefined, "1", "false", "TRUE", ""])(
    "« %s » → 503, aucune lecture Prisma",
    async (v) => {
      if (v === undefined) delete process.env.CONFIRMATIONS_PAGE_GUIDE_ENABLED;
      else process.env.CONFIRMATIONS_PAGE_GUIDE_ENABLED = v;
      const r = await appel();
      expect(r.status).toBe(503);
      expect((await r.json()).erreur).toBe("reception_eteinte");
      expect(bd.appelsPrisma).toBe(0);
      expect(bd.cles).toHaveLength(0);
    },
  );
});

describe("2 · secret", () => {
  it("absent → 503 reception_non_configuree", async () => {
    delete process.env.GUIDES_RESEAU_HMAC_SECRET;
    const r = await appel();
    expect(r.status).toBe(503);
    expect((await r.json()).erreur).toBe("reception_non_configuree");
    expect(bd.appelsPrisma).toBe(0);
  });
  it("secret des vidéos seul (aucun repli) → 503", async () => {
    delete process.env.GUIDES_RESEAU_HMAC_SECRET;
    process.env.VIDEOS_STUDIO_HMAC_SECRET = SECRET;
    const r = await appel();
    expect(r.status).toBe(503);
    expect((await r.json()).erreur).toBe("reception_non_configuree");
    expect(bd.appelsPrisma).toBe(0);
  });
  it("moins de 32 caractères → 503", async () => {
    process.env.GUIDES_RESEAU_HMAC_SECRET = "x".repeat(31);
    const r = await appel(undefined, { secret: "x".repeat(31) });
    expect(r.status).toBe(503);
    expect((await r.json()).erreur).toBe("reception_non_configuree");
    expect(bd.appelsPrisma).toBe(0);
  });
});

describe("3 · signature, horodatage, méthode, chaîne de requête", () => {
  it("signature invalide → 401", async () => {
    expect((await appel(undefined, { secret: "z".repeat(40) })).status).toBe(401);
    expect(bd.appelsPrisma).toBe(0);
  });
  it("horodatage expiré → 401", async () => {
    expect((await appel(undefined, { decalage: -3600 })).status).toBe(401);
    expect(bd.appelsPrisma).toBe(0);
  });
  it("aucun GET exporté (Next répond 405)", () => {
    expect((module as Record<string, unknown>).GET).toBeUndefined();
  });
  it("chaîne de requête → refus, aucune lecture", async () => {
    const r = await appel(undefined, { recherche: "?limite=50" });
    expect(r.status).toBe(400);
    expect(bd.appelsPrisma).toBe(0);
  });
  it("débit : seau propre 'internal:confirmations-page-guide'", async () => {
    await appel();
    expect(bd.cles[0]).toMatch(/^internal:confirmations-page-guide:/);
    bd.limiteRefusee = true;
    expect((await appel()).status).toBe(429);
  });
});

describe("4 · corps", () => {
  it("champ inconnu → 400, aucune lecture", async () => {
    const r = await appel({ schemaVersion: 1, adresse: "a@exemple.test" });
    expect(r.status).toBe(400);
    const t = await r.text();
    expect(t).toContain("adresse");
    expect(t).not.toContain("a@exemple.test");
    expect(bd.appelsPrisma).toBe(0);
  });
  it.each([
    { schemaVersion: 2 },
    { schemaVersion: 1, limite: 0 },
    { schemaVersion: 1, limite: 51 },
    {},
  ])("corps invalide %j → 400", async (c) => {
    expect((await appel(c)).status).toBe(400);
    expect(bd.appelsPrisma).toBe(0);
  });
  it("JSON illisible → 400", async () => {
    expect((await appel(undefined, { brut: "pas du json" })).status).toBe(400);
  });
  it("corps de plus de 4 Ko → 413", async () => {
    const r = await appel({ schemaVersion: 1, x: "a".repeat(5000) });
    expect(r.status).toBe(413);
    expect(bd.appelsPrisma).toBe(0);
  });
  it("corps valide → 200, liste vide, une transaction", async () => {
    const r = await appel({ schemaVersion: 1, limite: 10 });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, schemaVersion: 1, confirmations: [] });
    expect(bd.appelsPrisma).toBe(1);
  });
});
