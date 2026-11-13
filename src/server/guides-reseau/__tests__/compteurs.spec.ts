// @vitest-environment node
//
// L5-27 — `POST /api/interne/compteurs-guide-reseau` : LECTURE seule, des nombres et rien d'autre.
// Base simulée (une table lue, espions sur toute écriture), aucun appel réel.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";

type Origine = {
  mot: string;
  reseau: string;
  postRef: string | null;
  versionTexte: string | null;
  guide: string;
  emailKey: string;
  occurredAt: Date;
};
type Demande = { emailKey: string; aimant: string; sentAt: Date | null; firstClickAt: Date | null };
const { bd } = vi.hoisted(() => ({
  bd: {
    origines: [] as Origine[],
    demandes: [] as Demande[],
    lectures: 0,
    requetesDemandes: [] as Array<{ taille: number; take: number }>,
    cleDemandesLues: [] as string[],
    ecritures: 0,
    panne: false,
  },
}));

vi.mock("@/lib/prisma", () => {
  const ecriture = () => async () => {
    bd.ecritures++;
    return {};
  };
  const ecritures = {
    create: ecriture(),
    createMany: ecriture(),
    update: ecriture(),
    updateMany: ecriture(),
    upsert: ecriture(),
    delete: ecriture(),
    deleteMany: ecriture(),
  };
  return {
    prisma: {
      guideReseauOrigine: {
        ...ecritures,
        findMany: async () => {
          bd.lectures++;
          if (bd.panne) throw new Error("panne lecture");
          return bd.origines; // lignes brutes : un champ en trop ne doit JAMAIS sortir
        },
      },
      guideRequest: {
        ...ecritures,
        // Honore le filtre `emailKey IN lot` et `take`, comme la vraie base.
        findMany: async (arg: {
          where: { emailKey: { in: string[] }; aimant: { in: string[] } };
          take: number;
        }) => {
          bd.lectures++;
          if (bd.panne) throw new Error("panne lecture");
          bd.requetesDemandes.push({ taille: arg.where.emailKey.in.length, take: arg.take });
          const lues = bd.demandes
            .filter((d) => arg.where.emailKey.in.includes(d.emailKey))
            .filter((d) => arg.where.aimant.in.includes(d.aimant))
            .slice(0, arg.take);
          for (const d of lues) bd.cleDemandesLues.push(d.emailKey);
          return lues;
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

const CORPS = { v: 1 };
const H = 3_600_000;
const J = 24 * H;
const il_y_a = (ms: number) => new Date(Date.now() - ms);
const CLE_A = "a".repeat(64);

function origine(o: Partial<Origine> & { occurredAt: Date }): Origine {
  return {
    mot: "guide",
    reseau: "linkedin",
    postRef: "post-1",
    versionTexte: "v1",
    guide: "guide-ia",
    emailKey: CLE_A,
    ...o,
  };
}

beforeEach(() => {
  vi.stubEnv("GUIDES_RESEAU_ENABLED", "true");
  vi.stubEnv("GUIDES_RESEAU_HMAC_SECRET", SECRET);
  bd.origines = [];
  bd.demandes = [];
  bd.lectures = 0;
  bd.requetesDemandes = [];
  bd.cleDemandesLues = [];
  bd.ecritures = 0;
  bd.panne = false;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("compteurs-guide-reseau v1 — lignes et fenêtres", () => {
  it("une ligne par (mot, réseau, post, version, cible) ; fenêtres glissantes, bornes incluses", async () => {
    bd.origines = [
      origine({ occurredAt: il_y_a(H) }),
      origine({ occurredAt: il_y_a(7 * J - 1000), emailKey: "b".repeat(64) }), // dans j7
      origine({ occurredAt: il_y_a(7 * J + 60_000), emailKey: "c".repeat(64) }), // j30 seulement
      origine({ occurredAt: il_y_a(31 * J), emailKey: "d".repeat(64) }), // total seulement
      origine({ occurredAt: il_y_a(H), reseau: "instagram", postRef: null, versionTexte: null }),
    ];
    const r = await appel(CORPS);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.v).toBe(1);
    expect(new Date(j.genereLe).toISOString()).toBe(j.genereLe);
    expect(j.lignes).toHaveLength(2);
    const li = j.lignes.find((l: { reseau: string }) => l.reseau === "linkedin");
    expect(li.formulaires).toEqual({ j7: 2, j30: 3, total: 4 });
    expect(li.cible).toBe("guide-ia");
    const ig = j.lignes.find((l: { reseau: string }) => l.reseau === "instagram");
    expect(ig.postRef).toBeNull();
    expect(ig.versionTexte).toBeNull();
    expect(ig.formulaires).toEqual({ j7: 1, j30: 1, total: 1 });
  });

  it("envois datés par sentAt, clics par firstClickAt, rattachés à l'origine la plus récente", async () => {
    bd.origines = [
      origine({ occurredAt: il_y_a(40 * J), postRef: "ancien" }),
      origine({ occurredAt: il_y_a(2 * J), postRef: "recent" }),
    ];
    bd.demandes = [
      { emailKey: CLE_A, aimant: "guide-ia", sentAt: il_y_a(2 * J), firstClickAt: il_y_a(10 * J) },
      { emailKey: CLE_A, aimant: "autre", sentAt: il_y_a(H), firstClickAt: null }, // sans origine : ignorée
    ];
    const j = await (await appel(CORPS)).json();
    const recent = j.lignes.find((l: { postRef: string }) => l.postRef === "recent");
    const ancien = j.lignes.find((l: { postRef: string }) => l.postRef === "ancien");
    expect(recent.envois).toEqual({ j7: 1, j30: 1, total: 1 });
    expect(recent.clics).toEqual({ j7: 0, j30: 1, total: 1 });
    expect(ancien.envois).toEqual({ j7: 0, j30: 0, total: 0 });
  });

  it("le mot stocké est renvoyé à l'identique (aucune retransformation)", async () => {
    const mots = ["ABC", "GUIDEIA2026", "A1", "Z".repeat(20)];
    bd.origines = mots.map((mot, i) =>
      origine({ mot, occurredAt: il_y_a(H), emailKey: String(i).repeat(64) }),
    );
    const j = await (await appel(CORPS)).json();
    expect(j.lignes.map((l: { mot: string }) => l.mot).sort()).toEqual([...mots].sort());
  });

  it("aucun masquage : un effectif de 1 est rendu tel quel", async () => {
    bd.origines = [origine({ occurredAt: il_y_a(H) })];
    const j = await (await appel(CORPS)).json();
    expect(j.lignes).toHaveLength(1);
    expect(j.lignes[0].formulaires.total).toBe(1);
    expect(Object.keys(j)).not.toContain("masquees");
  });
});

describe("compteurs-guide-reseau v1 — des nombres seulement", () => {
  it("clés de la réponse : liste fermée, aucune adresse, nom ni identifiant de personne", async () => {
    bd.origines = [origine({ occurredAt: il_y_a(H) })];
    bd.demandes = [
      { emailKey: CLE_A, aimant: "guide-ia", sentAt: il_y_a(H), firstClickAt: il_y_a(H) },
    ];
    const j = await (await appel(CORPS)).json();
    expect(Object.keys(j).sort()).toEqual(["genereLe", "lignes", "v"]);
    for (const l of j.lignes) {
      expect(Object.keys(l).sort()).toEqual([
        "cible",
        "clics",
        "envois",
        "formulaires",
        "mot",
        "postRef",
        "reseau",
        "versionTexte",
      ]);
      for (const f of [l.formulaires, l.envois, l.clics])
        expect(Object.keys(f).sort()).toEqual(["j30", "j7", "total"]);
    }
    const brut = JSON.stringify(j);
    expect(brut).not.toContain(CLE_A);
    expect(brut).not.toMatch(/@|email|prenom|personne|convRef|conv_ref/i);
  });

  it("le journal ne porte aucune donnée de personne", async () => {
    bd.origines = [origine({ occurredAt: il_y_a(H) })];
    await appel(CORPS);
    const log = JSON.stringify(
      (console.warn as unknown as { mock: { calls: unknown[] } }).mock.calls,
    );
    expect(log).toContain("guides_reseau_compteurs");
    expect(log).not.toContain(CLE_A);
  });
});

describe("compteurs-guide-reseau v1 — 401 et 404, rien lu ni écrit", () => {
  it("sans signature : 401, rien lu", async () => {
    bd.origines = [origine({ occurredAt: il_y_a(H) })];
    const r = await appel(CORPS, { signer: false });
    expect(r.status).toBe(401);
    expect(bd.lectures).toBe(0);
    expect(bd.ecritures).toBe(0);
  });

  it("mauvais secret : 401, rien lu", async () => {
    const r = await appel(CORPS, { secret: "x".repeat(40) });
    expect(r.status).toBe(401);
    expect(bd.lectures).toBe(0);
  });

  it("interrupteur éteint : 404, rien lu ni écrit (même avec une signature valide)", async () => {
    vi.stubEnv("GUIDES_RESEAU_ENABLED", "false");
    const r = await appel(CORPS);
    expect(r.status).toBe(404);
    expect(bd.lectures).toBe(0);
    expect(bd.ecritures).toBe(0);
  });

  it("interrupteur éteint ET sans signature : 404 (l'interrupteur passe en premier)", async () => {
    vi.stubEnv("GUIDES_RESEAU_ENABLED", "");
    const r = await appel(CORPS, { signer: false });
    expect(r.status).toBe(404);
    expect(bd.lectures).toBe(0);
  });
});

describe("compteurs-guide-reseau v1 — corps strict, lecture seule, fermé", () => {
  it.each([
    ["champ inconnu", { v: 1, email: "x" }],
    ["version inconnue", { v: 2 }],
    ["sans version", {}],
    ["ancienne forme", { schemaVersion: 1, depuis: "2026-11-01", jusqua: "2026-11-03" }],
  ])("%s : 422, rien lu", async (_nom, corps) => {
    const r = await appel(corps);
    expect(r.status).toBe(422);
    expect(bd.lectures).toBe(0);
  });

  it("JSON invalide : 422 ; chaîne de requête : 400", async () => {
    expect((await appel(null, { brut: "{pas du json" })).status).toBe(422);
    expect((await appel(CORPS, { requete: "?x=1" })).status).toBe(400);
  });

  it("la lecture ne sélectionne aucun champ de personne en sortie (clé de liaison interne seulement)", async () => {
    bd.origines = [origine({ occurredAt: il_y_a(H) })];
    const { prisma } = await import("@/lib/prisma");
    const espion = vi.spyOn(prisma.guideReseauOrigine, "findMany");
    await appel(CORPS);
    const arg = espion.mock.calls[0]![0] as { select: Record<string, boolean> };
    expect(Object.keys(arg.select).sort()).toEqual([
      "emailKey",
      "guide",
      "mot",
      "occurredAt",
      "postRef",
      "reseau",
      "versionTexte",
    ]);
  });

  it("panne de lecture : 500 fermé, sans résultat partiel", async () => {
    bd.origines = [origine({ occurredAt: il_y_a(H) })];
    bd.panne = true;
    const r = await appel(CORPS);
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ ok: false, erreur: "erreur_interne" });
    expect(bd.ecritures).toBe(0);
  });

  it("aucune écriture sur un appel réussi", async () => {
    bd.origines = [origine({ occurredAt: il_y_a(H) })];
    expect((await appel(CORPS)).status).toBe(200);
    expect(bd.ecritures).toBe(0);
  });
});

describe("compteurs-guide-reseau v1 — lecture filtrée des demandes (R4)", () => {
  it("les demandes hors réseau ne comptent pas et ne sont pas lues ; chiffres identiques à l'agrégation brute", async () => {
    const horsReseau = "f".repeat(64);
    bd.origines = [origine({ occurredAt: il_y_a(2 * J) })];
    bd.demandes = [
      { emailKey: CLE_A, aimant: "guide-ia", sentAt: il_y_a(H), firstClickAt: il_y_a(H) },
      { emailKey: horsReseau, aimant: "guide-ia", sentAt: il_y_a(H), firstClickAt: il_y_a(H) },
      { emailKey: horsReseau, aimant: "guide-ia", sentAt: il_y_a(2 * H), firstClickAt: null },
    ];
    const j = await (await appel(CORPS)).json();
    expect(j.lignes).toHaveLength(1);
    expect(j.lignes[0].envois).toEqual({ j7: 1, j30: 1, total: 1 });
    expect(j.lignes[0].clics).toEqual({ j7: 1, j30: 1, total: 1 });
    // Le filtre est côté base : aucune demande hors réseau n'est même lue.
    expect(bd.cleDemandesLues).toEqual([CLE_A]);
    // Référence : l'agrégation pure sur TOUTES les demandes donne les mêmes lignes.
    const { agreger } = await import("@/server/guides-reseau/compteurs");
    const ref = agreger(bd.origines, bd.demandes, new Date(j.genereLe));
    expect(JSON.parse(JSON.stringify(ref))).toEqual(j.lignes);
  });

  it("découpage en lots : 2 500 clés => 3 requêtes (1 000, 1 000, 500)", async () => {
    bd.origines = Array.from({ length: 2500 }, (_, i) =>
      origine({ occurredAt: il_y_a(H), emailKey: String(i).padStart(64, "0") }),
    );
    expect((await appel(CORPS)).status).toBe(200);
    expect(bd.requetesDemandes.map((r) => r.taille)).toEqual([1000, 1000, 500]);
  });

  it("aucune origine : aucune requête sur les demandes", async () => {
    expect((await appel(CORPS)).status).toBe(200);
    expect(bd.requetesDemandes).toHaveLength(0);
  });

  it("plafond sur les demandes : 500 plafond_depasse, sans donnée de personne ni résultat partiel", async () => {
    const { LIGNES_MAX_COMPTEURS } = await import("@/server/guides-reseau/compteurs");
    bd.origines = [origine({ occurredAt: il_y_a(H) })];
    bd.demandes = Array.from({ length: LIGNES_MAX_COMPTEURS + 1 }, () => ({
      emailKey: CLE_A,
      aimant: "guide-ia",
      sentAt: il_y_a(H),
      firstClickAt: null,
    }));
    const r = await appel(CORPS);
    expect(r.status).toBe(500);
    const corps = await r.json();
    expect(corps).toEqual({ ok: false, erreur: "plafond_depasse" });
    expect(JSON.stringify(corps)).not.toContain(CLE_A);
    const journaux = JSON.stringify([
      ...(console.warn as unknown as { mock: { calls: unknown[] } }).mock.calls,
      ...(console.error as unknown as { mock: { calls: unknown[] } }).mock.calls,
    ]);
    expect(journaux).not.toContain(CLE_A);
  });
});
