// @vitest-environment node
//
// `POST /api/interne/confirmations-page-guide/issue` — interrupteur, secret, signature, corps, aucun DELETE.
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";

const { bd } = vi.hoisted(() => ({
  bd: { appelsPrisma: 0, suppressions: 0, limiteRefusee: false },
}));

vi.mock("@/lib/prisma", () => {
  const interdit = async () => {
    bd.suppressions++;
    throw new Error("interdit");
  };
  return {
    prisma: {
      $transaction: async (fn: (t: unknown) => Promise<unknown>) => {
        bd.appelsPrisma++;
        return fn({ $executeRaw: async () => 0 });
      },
      contactGuideReseau: { delete: interdit, deleteMany: interdit },
    },
  };
});
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: !bd.limiteRefusee }),
}));

import * as module from "./route";
import { POST } from "./route";
import { signerRequete } from "@/server/videos/signature";

const SECRET = "c".repeat(40);
const CHEMIN = "/api/interne/confirmations-page-guide/issue";
const VALIDE = { schemaVersion: 1, issues: [{ ref: "a".repeat(64), issue: "envoye" }] };

function appel(
  corps: unknown = VALIDE,
  opt: { secret?: string; recherche?: string } = {},
): Promise<Response> {
  const texte = JSON.stringify(corps);
  const nonce = crypto.randomBytes(16).toString("hex");
  const horodatage = String(Math.floor(Date.now() / 1000));
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
  bd.suppressions = 0;
  bd.limiteRefusee = false;
  process.env.CONFIRMATIONS_PAGE_GUIDE_ENABLED = "true";
  process.env.GUIDES_RESEAU_HMAC_SECRET = SECRET;
  delete process.env.GUIDES_RESEAU_HMAC_SECRET_PRECEDENT;
  delete process.env.VIDEOS_STUDIO_HMAC_SECRET;
  process.env.DATABASE_URL = "postgresql://u:p@db.example.test:5432/x";
  for (const m of ["log", "info", "warn", "error", "debug"] as const)
    vi.spyOn(console, m).mockImplementation(() => undefined);
});

describe("accusé · route", () => {
  it.each([undefined, "1", "false", "TRUE", ""])(
    "interrupteur « %s » → 503, rien de lu",
    async (v) => {
      if (v === undefined) delete process.env.CONFIRMATIONS_PAGE_GUIDE_ENABLED;
      else process.env.CONFIRMATIONS_PAGE_GUIDE_ENABLED = v;
      const r = await appel();
      expect(r.status).toBe(503);
      expect((await r.json()).erreur).toBe("reception_eteinte");
      expect(bd.appelsPrisma).toBe(0);
    },
  );
  it("mauvaise signature → 401", async () => {
    expect((await appel(VALIDE, { secret: "z".repeat(40) })).status).toBe(401);
    expect(bd.appelsPrisma).toBe(0);
  });
  it("secret des vidéos seul (aucun repli) → 503", async () => {
    delete process.env.GUIDES_RESEAU_HMAC_SECRET;
    process.env.VIDEOS_STUDIO_HMAC_SECRET = SECRET;
    expect((await appel()).status).toBe(503);
    expect(bd.appelsPrisma).toBe(0);
  });
  it("aucun GET ; chaîne de requête refusée", async () => {
    expect((module as Record<string, unknown>).GET).toBeUndefined();
    expect((await appel(VALIDE, { recherche: "?x=1" })).status).toBe(400);
  });
  it("corps de plus de 4 Ko → 413", async () => {
    expect((await appel({ ...VALIDE, x: "a".repeat(5000) })).status).toBe(413);
  });
  it.each([
    { schemaVersion: 1, issues: [] },
    { schemaVersion: 1, issues: [{ ref: "a", issue: "autre" }] },
    { schemaVersion: 1, issues: VALIDE.issues, adresse: "a@exemple.test" },
  ])("corps invalide %j → 400", async (c) => {
    const r = await appel(c);
    expect(r.status).toBe(400);
    expect(await r.text()).not.toContain("a@exemple.test");
    expect(bd.appelsPrisma).toBe(0);
  });
  it("corps valide → 200 sans donnée de personne, aucun DELETE", async () => {
    const r = await appel();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, schemaVersion: 1, recus: 1 });
    expect(bd.suppressions).toBe(0);
  });
});
