// @vitest-environment node
// G4 — enregistrerCible refuse une version qui DESCEND (409 version_perimee) ; même numéro ou plus haut = accepté.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";

const bd = vi.hoisted(() => ({ cibles: [] as Record<string, unknown>[], upserts: 0 }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cibleReseau: {
      findUnique: async ({ where }: { where: { code: string } }) =>
        bd.cibles.find((c) => c.code === where.code) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { code: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        bd.upserts++;
        const e = bd.cibles.find((c) => c.code === where.code);
        if (e) Object.assign(e, update);
        else bd.cibles.push({ version: 1, ...create });
      },
    },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));

import { POST } from "@/app/api/interne/cibles-reseau/route";
import { signerRequete } from "@/server/videos/signature";

const SECRET = "s".repeat(40);
const CH = "/api/interne/cibles-reseau";
const envoyer = (corps: unknown) => {
  const texte = JSON.stringify(corps);
  const nonce = crypto.randomBytes(16).toString("hex");
  const horodatage = String(Math.floor(Date.now() / 1000));
  return POST(
    new NextRequest(`http://localhost${CH}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-axion-horodatage": horodatage,
        "x-axion-nonce": nonce,
        "x-axion-signature": signerRequete({
          secret: SECRET,
          horodatage,
          nonce,
          methode: "POST",
          chemin: CH,
          corps: texte,
        }),
      },
      body: texte,
    }),
  );
};
const guide = (version?: number) => ({
  code: "gde-essai-01",
  type: "guide",
  titre: "Le plan en 3 étapes",
  cheminPdf: `guides-reseau/gde-essai-01/v${version ?? 1}.pdf`,
  ...(version !== undefined ? { version } : {}),
});

beforeEach(() => {
  bd.cibles = [];
  bd.upserts = 0;
  vi.stubEnv("GUIDES_RESEAU_ENABLED", "true");
  vi.stubEnv("GUIDES_RESEAU_HMAC_SECRET", SECRET);
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@db.example.test:5432/x");
});
afterEach(() => vi.unstubAllEnvs());

describe("version qui descend", () => {
  it("v3 puis v2 = 409 version_perimee {versionMax:3}, la fiche garde la v3", async () => {
    expect((await envoyer(guide(3))).status).toBe(200);
    const r = await envoyer(guide(2));
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ erreur: "version_perimee", versionMax: 3 });
    expect(bd.cibles[0]).toMatchObject({
      version: 3,
      cheminPdf: "guides-reseau/gde-essai-01/v3.pdf",
    });
    expect(bd.upserts).toBe(1);
  });
  it("même numéro (rejeu) et numéro plus haut acceptés ; sans version, aucune lecture bloquante", async () => {
    expect((await envoyer(guide(3))).status).toBe(200);
    expect((await envoyer(guide(3))).status).toBe(200);
    expect((await envoyer(guide(4))).status).toBe(200);
    expect((await envoyer(guide())).status).toBe(200);
  });
});
