// @vitest-environment node
//
// L5-27 — `POST /api/interne/compteurs-guide-reseau` : LECTURE seule, des nombres et rien d'autre.
// Base simulée (une table lue, espions sur toute écriture), aucun appel réel.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";

type Ligne = { mot: string; reseau: string; occurredAt: Date; emailKey?: string };
const { bd } = vi.hoisted(() => ({
  bd: { lignes: [] as Ligne[], lectures: 0, ecritures: 0, panne: false },
}));

vi.mock("@/lib/prisma", () => {
  const ecriture = () => async () => {
    bd.ecritures++;
    return {};
  };
  return {
    prisma: {
      guideReseauOrigine: {
        create: ecriture(),
        createMany: ecriture(),
        update: ecriture(),
        updateMany: ecriture(),
        upsert: ecriture(),
        delete: ecriture(),
        deleteMany: ecriture(),
        findMany: async ({ where }: { where: { occurredAt: { gte: Date; lt: Date } } }) => {
          bd.lectures++;
          if (bd.panne) throw new Error("panne lecture");
          const { gte, lt } = where.occurredAt;
          // Ligne brute renvoyée telle quelle : un champ en trop (emailKey) ne doit JAMAIS sortir.
          return bd.lignes.filter((l) => l.occurredAt >= gte && l.occurredAt < lt);
        },
      },
      $executeRaw: async () => {
        bd.ecritures++;
        return 0;
      },
      $transaction: async () => {
        bd.ecritures++;
      },
    },
  };
});
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@sentry/nextjs", () => ({ captureException: () => undefined }));

import { POST } from "@/app/api/interne/compteurs-guide-reseau/route";
import { signerRequete } from "@/server/videos/signature";

const SECRET = "g".repeat(40);
const CHEMIN = "/api/interne/compteurs-guide-reseau";

function appel(
  corps: unknown,
  opt: { secret?: string; brut?: string; signer?: boolean; requete?: string } = {},
): Promise<Response> {
  const texte = opt.brut ?? JSON.stringify(corps);
  const nonce = crypto.randomBytes(16).toString("hex");
  const horodatage = String(Math.floor(Date.now() / 1000));
  const entetes: Record<string, string> = { "content-type": "application/json" };
  if (opt.signer !== false) {
    entetes["x-axion-horodatage"] = horodatage;
    entetes["x-axion-nonce"] = nonce;
    entetes["x-axion-signature"] = signerRequete({
      secret: opt.secret ?? SECRET,
      horodatage,
      nonce,
      methode: "POST",
      chemin: CHEMIN,
      corps: texte,
    });
  }
  return POST(
    new NextRequest(`http://localhost${CHEMIN}${opt.requete ?? ""}`, {
      method: "POST",
      headers: entetes,
      body: texte,
    }),
  );
}

const PERIODE = { schemaVersion: 1, depuis: "2026-11-01", jusqua: "2026-11-03" };
const jour = (j: string, h = 10) => new Date(`${j}T${String(h).padStart(2, "0")}:00:00.000Z`);
function poser(n: number, mot: string, reseau: string, j: string) {
  for (let i = 0; i < n; i++)
    bd.lignes.push({
      mot,
      reseau,
      occurredAt: jour(j, i % 24),
      emailKey: "a".repeat(64),
    });
}

beforeEach(() => {
  vi.stubEnv("GUIDES_RESEAU_ENABLED", "true");
  vi.stubEnv("GUIDES_RESEAU_HMAC_SECRET", SECRET);
  bd.lignes = [];
  bd.lectures = 0;
  bd.ecritures = 0;
  bd.panne = false;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("compteurs-guide-reseau — critère 1 : par mot, réseau, jour ; effectif < 3 masqué", () => {
  it("compte par (mot, réseau, jour)", async () => {
    poser(4, "guide", "linkedin", "2026-11-01");
    poser(5, "guide", "linkedin", "2026-11-02");
    poser(3, "guide", "instagram", "2026-11-01");
    poser(6, "audit", "linkedin", "2026-11-01");
    const r = await appel(PERIODE);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.ok).toBe(true);
    const cle = (c: { mot: string; reseau: string; jour: string; n: number }) =>
      `${c.mot}|${c.reseau}|${c.jour}|${c.n}`;
    expect(j.compteurs.map(cle).sort()).toEqual(
      [
        "audit|linkedin|2026-11-01|6",
        "guide|instagram|2026-11-01|3",
        "guide|linkedin|2026-11-01|4",
        "guide|linkedin|2026-11-02|5",
      ].sort(),
    );
  });

  it("masque tout effectif inférieur à 3 (1 et 2 absents, 3 présent)", async () => {
    poser(1, "guide", "linkedin", "2026-11-01");
    poser(2, "audit", "linkedin", "2026-11-01");
    poser(3, "guide", "instagram", "2026-11-01");
    const j = await (await appel(PERIODE)).json();
    expect(j.compteurs).toEqual([{ mot: "guide", reseau: "instagram", jour: "2026-11-01", n: 3 }]);
    expect(j.masquees).toBe(2);
    for (const c of j.compteurs) expect(c.n).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(j)).not.toMatch(/"n":[12]\b/);
  });

  it("la borne « jusqua » est incluse, le jour suivant est exclu", async () => {
    poser(3, "guide", "linkedin", "2026-11-03");
    poser(3, "guide", "linkedin", "2026-11-04");
    const j = await (await appel(PERIODE)).json();
    expect(j.compteurs.map((c: { jour: string }) => c.jour)).toEqual(["2026-11-03"]);
  });
});

describe("compteurs-guide-reseau — critère 2 : des nombres seulement", () => {
  it("clés de la réponse : liste fermée, aucune adresse, nom ni identifiant de personne", async () => {
    poser(4, "guide", "linkedin", "2026-11-01");
    const r = await appel(PERIODE);
    const j = await r.json();
    expect(Object.keys(j).sort()).toEqual(["compteurs", "masquees", "ok", "schemaVersion"]);
    for (const c of j.compteurs) {
      expect(Object.keys(c).sort()).toEqual(["jour", "mot", "n", "reseau"]);
      expect(typeof c.n).toBe("number");
    }
    const brut = JSON.stringify(j);
    expect(brut).not.toContain("a".repeat(64)); // emailKey de la base simulée
    expect(brut).not.toMatch(/@|email|nom|prenom|personne|conv|compte_ref|id"/i);
  });

  it("la lecture ne demande que mot, reseau et occurredAt", async () => {
    poser(3, "guide", "linkedin", "2026-11-01");
    const { prisma } = await import("@/lib/prisma");
    const espion = vi.spyOn(prisma.guideReseauOrigine, "findMany");
    await appel(PERIODE);
    const arg = espion.mock.calls[0]![0] as { select: Record<string, boolean> };
    expect(Object.keys(arg.select).sort()).toEqual(["mot", "occurredAt", "reseau"]);
  });

  it("le journal ne porte aucune donnée de personne", async () => {
    poser(3, "guide", "linkedin", "2026-11-01");
    await appel(PERIODE);
    const log = JSON.stringify(
      (console.warn as unknown as { mock: { calls: unknown[] } }).mock.calls,
    );
    expect(log).toContain("guides_reseau_compteurs");
    expect(log).not.toContain("a".repeat(64));
  });
});

describe("compteurs-guide-reseau — critère 3 : 401 et 503, rien lu ni écrit", () => {
  it("sans signature : 401, rien lu", async () => {
    poser(3, "guide", "linkedin", "2026-11-01");
    const r = await appel(PERIODE, { signer: false });
    expect(r.status).toBe(401);
    expect(bd.lectures).toBe(0);
    expect(bd.ecritures).toBe(0);
  });

  it("mauvais secret : 401, rien lu", async () => {
    const r = await appel(PERIODE, { secret: "x".repeat(40) });
    expect(r.status).toBe(401);
    expect(bd.lectures).toBe(0);
    expect(bd.ecritures).toBe(0);
  });

  it("interrupteur éteint : 503, rien lu ni écrit (même avec une signature valide)", async () => {
    vi.stubEnv("GUIDES_RESEAU_ENABLED", "false");
    const r = await appel(PERIODE);
    expect(r.status).toBe(503);
    expect(bd.lectures).toBe(0);
    expect(bd.ecritures).toBe(0);
  });

  it("interrupteur éteint ET sans signature : 503 (l'interrupteur passe en premier)", async () => {
    vi.stubEnv("GUIDES_RESEAU_ENABLED", "");
    const r = await appel(PERIODE, { signer: false });
    expect(r.status).toBe(503);
    expect(bd.lectures).toBe(0);
  });
});

describe("compteurs-guide-reseau — corps strict, lecture seule, fermé", () => {
  it.each([
    ["champ inconnu", { ...PERIODE, email: "x" }],
    ["version inconnue", { ...PERIODE, schemaVersion: 2 }],
    ["date mal formée", { ...PERIODE, depuis: "01/11/2026" }],
    ["jour inexistant", { ...PERIODE, depuis: "2026-02-31" }],
    ["période inversée", { ...PERIODE, depuis: "2026-11-05" }],
    ["période trop longue", { ...PERIODE, depuis: "2025-01-01" }],
  ])("%s : 422, rien lu", async (_nom, corps) => {
    const r = await appel(corps);
    expect(r.status).toBe(422);
    expect(bd.lectures).toBe(0);
  });

  it("JSON invalide : 422 ; chaîne de requête : 400", async () => {
    expect((await appel(null, { brut: "{pas du json" })).status).toBe(422);
    expect((await appel(PERIODE, { requete: "?x=1" })).status).toBe(400);
  });

  it("panne de lecture : 500 fermé, sans résultat partiel", async () => {
    poser(3, "guide", "linkedin", "2026-11-01");
    bd.panne = true;
    const r = await appel(PERIODE);
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ ok: false, erreur: "erreur_interne" });
    expect(bd.ecritures).toBe(0);
  });

  it("aucune écriture sur un appel réussi", async () => {
    poser(5, "guide", "linkedin", "2026-11-01");
    expect((await appel(PERIODE)).status).toBe(200);
    expect(bd.ecritures).toBe(0);
  });
});
