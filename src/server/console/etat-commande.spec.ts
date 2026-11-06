import { createHash, createHmac } from "node:crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import {
  repondreEtatCommande,
  signerRequeteConsole,
  ENTETE_HORODATAGE_CONSOLE,
  ENTETE_SIGNATURE_CONSOLE,
} from "./etat-commande";

const SECRET = "s".repeat(40);
const NUMERO = "AXI-DEV-2026-001";
const CHEMIN = `/api/console/v1/commandes/${NUMERO}/etat`;
const MAINTENANT = Date.parse("2026-11-20T12:00:00Z");

function requete(
  corps: unknown,
  opts: {
    ts?: number;
    cle?: string | null;
    signature?: string;
    secret?: string;
    chemin?: string;
  } = {},
): Request {
  const brut = typeof corps === "string" ? corps : JSON.stringify(corps);
  const ts = String(opts.ts ?? Math.floor(MAINTENANT / 1000));
  const chemin = opts.chemin ?? CHEMIN;
  const signature =
    opts.signature ?? signerRequeteConsole(opts.secret ?? SECRET, ts, "POST", chemin, brut);
  const entetes: Record<string, string> = {
    "content-type": "application/json",
    [ENTETE_HORODATAGE_CONSOLE]: ts,
    [ENTETE_SIGNATURE_CONSOLE]: signature,
  };
  if (opts.cle !== null) entetes["idempotency-key"] = opts.cle ?? "cle-0001-abcdef";
  return new Request(`https://axion-ia.com${chemin}`, {
    method: "POST",
    headers: entetes,
    body: brut,
  });
}

function base() {
  const ligne = {
    id: "c1",
    etat: null as string | null,
    etatDetail: null as unknown,
    etatCleIdempotence: null as string | null,
  };
  const prisma = {
    consoleCommande: {
      findUnique: vi.fn(async () => ({ ...ligne })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  return { ligne, prisma };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["CONSOLE_C1_SECRET"] = SECRET;
  delete process.env["DATABASE_URL"];
});

async function appeler(req: Request, prisma: unknown, numero = NUMERO) {
  return repondreEtatCommande(req, numero, { prisma: prisma as never, maintenantMs: MAINTENANT });
}

describe("POST /commandes/{numeroDevis}/etat — authentification", () => {
  it("canal fermé (secret absent) : 404, rien n'est lu", async () => {
    delete process.env["CONSOLE_C1_SECRET"];
    const { prisma } = base();
    const r = await appeler(requete({ etat: "recue" }), prisma);
    expect(r.status).toBe(404);
    expect(prisma.consoleCommande.findUnique).not.toHaveBeenCalled();
  });

  it("secret trop court : traité comme absent", async () => {
    process.env["CONSOLE_C1_SECRET"] = "court";
    const { prisma } = base();
    expect((await appeler(requete({ etat: "recue" }), prisma)).status).toBe(404);
  });

  it("au build (base stub) : 404", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    const { prisma } = base();
    expect((await appeler(requete({ etat: "recue" }), prisma)).status).toBe(404);
  });

  it("🔴 signature absente ou fausse : 401, rien n'est lu ni écrit", async () => {
    const { prisma } = base();
    expect(
      (await appeler(requete({ etat: "recue" }, { signature: "0".repeat(64) }), prisma)).status,
    ).toBe(401);
    expect((await appeler(requete({ etat: "recue" }, { signature: "" }), prisma)).status).toBe(401);
    expect(prisma.consoleCommande.findUnique).not.toHaveBeenCalled();
    expect(prisma.consoleCommande.updateMany).not.toHaveBeenCalled();
  });

  it("🔴 mauvais secret : 401", async () => {
    const { prisma } = base();
    const r = await appeler(requete({ etat: "recue" }, { secret: "x".repeat(40) }), prisma);
    expect(r.status).toBe(401);
  });

  it("🔴 fenêtre de 5 minutes : un horodatage plus vieux (ou futur) est refusé", async () => {
    const { prisma } = base();
    const s = Math.floor(MAINTENANT / 1000);
    expect((await appeler(requete({ etat: "recue" }, { ts: s - 301 }), prisma)).status).toBe(401);
    expect((await appeler(requete({ etat: "recue" }, { ts: s + 301 }), prisma)).status).toBe(401);
    expect((await appeler(requete({ etat: "recue" }, { ts: s - 299 }), prisma)).status).toBe(200);
  });

  it("🔴 la signature couvre le corps : un corps modifié après signature est refusé", async () => {
    const { prisma } = base();
    const ts = String(Math.floor(MAINTENANT / 1000));
    const signature = signerRequeteConsole(
      SECRET,
      ts,
      "POST",
      CHEMIN,
      JSON.stringify({ etat: "recue" }),
    );
    const r = await appeler(requete({ etat: "en_service" }, { signature }), prisma);
    expect(r.status).toBe(401);
  });

  it("🔴 la signature couvre le chemin : rejouée sur un autre devis, elle est refusée", async () => {
    const { prisma } = base();
    const ts = String(Math.floor(MAINTENANT / 1000));
    const signature = signerRequeteConsole(
      SECRET,
      ts,
      "POST",
      CHEMIN,
      JSON.stringify({ etat: "recue" }),
    );
    const autre = "/api/console/v1/commandes/AXI-DEV-2026-999/etat";
    const r = await appeler(
      requete({ etat: "recue" }, { signature, chemin: autre }),
      prisma,
      "AXI-DEV-2026-999",
    );
    expect(r.status).toBe(401);
  });

  it("la formule de signature est HMAC-SHA256(secret, ts.METHODE.chemin.sha256(corps))", () => {
    const corps = '{"etat":"recue"}';
    const attendu = createHmac("sha256", SECRET)
      .update(`1.POST.${CHEMIN}.${createHash("sha256").update(corps).digest("hex")}`)
      .digest("hex");
    expect(signerRequeteConsole(SECRET, "1", "POST", CHEMIN, corps)).toBe(attendu);
  });
});

describe("POST /commandes/{numeroDevis}/etat — traitement", () => {
  it("applique l'état (affichage seulement) et mémorise la clé d'idempotence", async () => {
    const { prisma } = base();
    const r = await appeler(requete({ etat: "acompte_attendu" }), prisma);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, deja_recu: false });
    const arg = (prisma.consoleCommande.updateMany.mock.calls[0] as unknown[])[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(arg.data).toMatchObject({
      etat: "acompte_attendu",
      etatCleIdempotence: "cle-0001-abcdef",
    });
    expect(arg.data["etatRecuAt"]).toEqual(new Date(MAINTENANT));
    // Seules les colonnes d'état sont écrites : jamais le contenu du fait.
    expect(Object.keys(arg.data).sort()).toEqual(
      ["etat", "etatCleIdempotence", "etatDetail", "etatRecuAt"].sort(),
    );
  });

  it("Idempotency-Key obligatoire : 400", async () => {
    const { prisma } = base();
    expect((await appeler(requete({ etat: "recue" }, { cle: null }), prisma)).status).toBe(400);
  });

  it("Idempotency-Key mal formée : 400", async () => {
    const { prisma } = base();
    expect((await appeler(requete({ etat: "recue" }, { cle: "a b" }), prisma)).status).toBe(400);
  });

  it("devis inconnu ou sans commande : 404", async () => {
    const { prisma } = base();
    prisma.consoleCommande.findUnique.mockResolvedValue(null as never);
    expect((await appeler(requete({ etat: "recue" }), prisma)).status).toBe(404);
    expect(prisma.consoleCommande.updateMany).not.toHaveBeenCalled();
  });

  it("numéro de devis mal formé : 404 sans lecture", async () => {
    const { prisma } = base();
    const chemin = "/api/console/v1/commandes/AXI_DEV!/etat";
    const r = await appeler(requete({ etat: "recue" }, { chemin }), prisma, "AXI_DEV!");
    expect(r.status).toBe(404);
    expect(prisma.consoleCommande.findUnique).not.toHaveBeenCalled();
  });

  it("état inconnu : 422, rien n'est écrit", async () => {
    const { prisma } = base();
    expect((await appeler(requete({ etat: "payee" }), prisma)).status).toBe(422);
    expect(prisma.consoleCommande.updateMany).not.toHaveBeenCalled();
  });

  it("corps non JSON : 400 ; champ en trop : 422", async () => {
    const { prisma } = base();
    expect((await appeler(requete("pas du json"), prisma)).status).toBe(400);
    expect((await appeler(requete({ etat: "recue", montant: 1 }), prisma)).status).toBe(422);
  });

  it("corps démesuré : 413", async () => {
    const { prisma } = base();
    const gros = { etat: "a_trancher", detail: { motif: "x".repeat(40_000) } };
    expect((await appeler(requete(gros), prisma)).status).toBe(413);
  });

  it("🔴 rejeu (même clé, même contenu) : 200 « déjà reçu », aucune écriture", async () => {
    const { prisma, ligne } = base();
    ligne.etat = "recue";
    ligne.etatCleIdempotence = "cle-0001-abcdef";
    ligne.etatDetail = null;
    const r = await appeler(requete({ etat: "recue" }), prisma);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, deja_recu: true });
    expect(prisma.consoleCommande.updateMany).not.toHaveBeenCalled();
  });

  it("🔴 même clé, contenu différent : 409, rien n'est écrit", async () => {
    const { prisma, ligne } = base();
    ligne.etat = "recue";
    ligne.etatCleIdempotence = "cle-0001-abcdef";
    const r = await appeler(requete({ etat: "en_service" }), prisma);
    expect(r.status).toBe(409);
    expect(prisma.consoleCommande.updateMany).not.toHaveBeenCalled();
  });

  it("🔴 deux requêtes simultanées : celle qui perd la condition d'écriture reçoit 409", async () => {
    const { prisma } = base();
    prisma.consoleCommande.updateMany.mockResolvedValue({ count: 0 });
    const r = await appeler(requete({ etat: "recue" }), prisma);
    expect(r.status).toBe(409);
  });

  it("détail : motif et codes actifs acceptés, bornés", async () => {
    const { prisma } = base();
    const r = await appeler(
      requete({
        etat: "en_service",
        detail: { codesActifs: ["relance-devis"], actifs: 1, total: 3 },
      }),
      prisma,
    );
    expect(r.status).toBe(200);
    const arg = (prisma.consoleCommande.updateMany.mock.calls[0] as unknown[])[0] as {
      data: { etatDetail: unknown };
    };
    expect(arg.data.etatDetail).toEqual({ codesActifs: ["relance-devis"], actifs: 1, total: 3 });
  });
});
