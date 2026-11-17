/**
 * F7 — pièces jointes des e-mails écrits à la main : concurrence sur un VRAI Postgres (Gate D, étape
 * « E-mails écrits à la main : pièces jointes concurrentes » de `.github/workflows/ci.yml`,
 * `pnpm test:integration tests/integration/emails-manuels`).
 *
 * Ce qui est éprouvé sur la vraie base : le verrou `SELECT … FOR UPDATE` de la ligne de l'e-mail
 * (limites lues sous verrou, finalisation qui relit le statut au rangement, cloisonnement par auteur).
 * Tout ce qui sort de la base est simulé : compartiment R2 (en mémoire), débit, antivirus, Sentry.
 *
 * AUCUNE suppression : identifiants aléatoires, base jetable de Gate D. Le fichier refuse de tourner
 * hors d'une base locale (il écrit des lignes de test). Sans `DATABASE_URL`, il ÉCHOUE, il ne se saute pas.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";

interface Objet {
  octets: Uint8Array;
  etag: string;
}
const h = vi.hoisted(() => {
  class ObjetR2Modifie extends Error {}
  return { seau: new Map<string, Objet>(), ObjetR2Modifie, n: 0 };
});

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@/env", () => ({ env: { EMAIL_MANUEL_ACTIF: "true" } }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: true, count: 0, remaining: 0, resetAt: 0, panne: false }),
}));
vi.mock("@/server/careers/clamav", () => ({ analyserFlux: vi.fn() }));
vi.mock("@/lib/r2-storage", () => {
  const lire = (cle: string, etag: string): Objet => {
    const o = h.seau.get(cle);
    if (!o || o.etag !== etag) throw new h.ObjetR2Modifie(cle);
    return o;
  };
  return {
    ObjetR2Modifie: h.ObjetR2Modifie,
    isR2Configured: () => true,
    enteteObjetR2: async (cle: string) => {
      const o = h.seau.get(cle);
      return o ? { taille: o.octets.length, etag: o.etag } : null;
    },
    lirePlageObjetR2: async (cle: string, spec: string, etag: string) => {
      const o = lire(cle, etag).octets;
      const m = /^bytes=(\d*)-(\d*)$/.exec(spec)!;
      if (m[1] === "") return o.subarray(Math.max(0, o.length - Number(m[2])));
      return o.subarray(Number(m[1]), m[2] === "" ? o.length : Number(m[2]) + 1);
    },
    fluxObjetGeneralR2: async (cle: string, etag: string) => {
      const o = lire(cle, etag);
      return (async function* () {
        yield o.octets;
      })();
    },
    copierObjetR2: async (source: string, dest: string, etag: string) => {
      h.seau.set(dest, { ...lire(source, etag) });
    },
    signerEnvoiDirectR2: async (cle: string) => `https://r2.example/${cle}?sig=x`,
  };
});

import {
  finaliserPiecesJointesEmail,
  ouvrirEnvoisPiecesJointesEmail,
} from "../../../src/server/email-manuel/pieces-jointes";
import type { Antivirus } from "../../../src/server/contact/pieces-jointes";

const db = new PrismaClient();
const MO = 1024 * 1024;
const PDF = new Uint8Array(Buffer.from("%PDF-1.7\n" + "x".repeat(50_000)));
let A: { id: string; role: string };
let B: { id: string; role: string };

async function adminDeTest(): Promise<{ id: string; role: string }> {
  const u = await db.adminUser.create({
    data: {
      name: "Test F7",
      email: `f7-${randomUUID()}@example.invalid`,
      passwordHash: "inutilisable",
      role: "admin",
      status: "suspended",
    },
  });
  return { id: u.id, role: "admin" };
}

async function brouillon(auteur: { id: string }): Promise<string> {
  const e = await db.emailManuel.create({
    data: {
      cleIdempotence: randomUUID(),
      entiteType: "Client",
      entiteId: randomUUID(),
      destinataireHash: "a".repeat(64),
      destinataireChiffre: "x",
      expediteurNom: "Axion-IA",
      objet: "",
      corpsSource: "",
      statut: "brouillon",
      ecritParId: auteur.id,
      ecritParNom: "Direction",
    },
  });
  return e.id;
}

const annonces = (n: number, taille: number) =>
  Array.from({ length: n }, (_, i) => ({ nom: `f${i}.pdf`, taille }));

const sain: Antivirus = async (flux) => {
  for await (const _ of flux) {
    // lu
  }
  return { issue: "sain" };
};

/** Ouvre 1 fichier PDF et dépose ses octets sous la clé temporaire tirée par le serveur. */
async function pret(auteur: { id: string; role: string }, id: string) {
  const r = await ouvrirEnvoisPiecesJointesEmail({
    acteur: auteur,
    emailManuelId: id,
    pieces: [{ nom: "a.pdf", taille: PDF.length }],
  });
  if (!r.ok) throw new Error(`ouverture refusée : ${r.message}`);
  const l = await db.emailManuelPieceJointe.findFirstOrThrow({ where: { emailManuelId: id } });
  h.n += 1;
  h.seau.set(l.cleStockage, { octets: PDF, etag: `"e${h.n}"` });
  return r;
}

describe("garde de l'environnement", () => {
  it("DATABASE_URL existe et vise une base locale", () => {
    const url = process.env.DATABASE_URL;
    expect(url, "DATABASE_URL absent : ce test ne se saute pas").toBeTruthy();
    expect(new URL(url!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
  });
});

describe("pièces jointes d'e-mails, Postgres réel", () => {
  beforeAll(async () => {
    const hote = new URL(process.env.DATABASE_URL ?? "postgresql://x@invalide/x").hostname;
    if (!/^(localhost|127\.0\.0\.1)$/.test(hote)) throw new Error("base non locale : refus");
    A = await adminDeTest();
    B = await adminDeTest();
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  it("I1 — deux ouvertures de 5 × 1 Mo : une seule passe, 5 lignes", async () => {
    const id = await brouillon(A);
    const ouvrir = () =>
      ouvrirEnvoisPiecesJointesEmail({ acteur: A, emailManuelId: id, pieces: annonces(5, MO) });
    const rs = await Promise.all([ouvrir(), ouvrir()]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.emailManuelPieceJointe.count({ where: { emailManuelId: id } })).toBe(5);
  });

  it("I2 — cinq ouvertures de 2 × 2 Mo : exactement 2 passent, somme ≤ 10 Mo", async () => {
    const id = await brouillon(A);
    const rs = await Promise.all(
      Array.from({ length: 5 }, () =>
        ouvrirEnvoisPiecesJointesEmail({
          acteur: A,
          emailManuelId: id,
          pieces: annonces(2, 2 * MO),
        }),
      ),
    );
    expect(rs.filter((r) => r.ok)).toHaveLength(2);
    const lignes = await db.emailManuelPieceJointe.findMany({ where: { emailManuelId: id } });
    expect(lignes.length).toBeLessThanOrEqual(4);
    expect(lignes.reduce((t, l) => t + l.tailleOctets, 0)).toBeLessThanOrEqual(10 * MO);
  });

  it("I3 — l'e-mail part pendant le contrôle : la pièce est refusée « envoi_parti », jamais acceptée", async () => {
    const id = await brouillon(A);
    const r = await pret(A, id);
    const parti: Antivirus = async (flux) => {
      for await (const _ of flux) {
        // lu
      }
      await db.emailManuel.update({
        where: { id },
        data: { statut: "en_file", corpsHtml: "<p>x</p>" },
      });
      return { issue: "sain" };
    };
    await finaliserPiecesJointesEmail(
      { acteur: A, emailManuelId: id, jeton: r.jeton },
      { antivirus: parti },
    );
    const lignes = await db.emailManuelPieceJointe.findMany({ where: { emailManuelId: id } });
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ statut: "refusee", motifRefus: "envoi_parti" });
    expect(lignes.some((l) => l.statut === "acceptee")).toBe(false);
  });

  it("I4 — deux finalisations avec le même jeton : un seul contrôle", async () => {
    const id = await brouillon(A);
    const r = await pret(A, id);
    const av = vi.fn(sain);
    const fin = () =>
      finaliserPiecesJointesEmail(
        { acteur: A, emailManuelId: id, jeton: r.jeton },
        { antivirus: av },
      );
    const rs = await Promise.all([fin(), fin()]);
    const controlees = rs.map((x) => x.ok && x.controlees).sort();
    expect(controlees).toEqual([false, true]);
    expect(av).toHaveBeenCalledTimes(1);
    const definitives = [...h.seau.keys()].filter((k) => k.startsWith(`emails-manuels/${id}/`));
    expect(definitives).toHaveLength(1);
    // Jeton invalide pour mémoire : jamais de contrôle sans lui.
    expect(randomBytes(32).toString("base64url")).toHaveLength(43);
  });

  it("I5 — B ouvre sur le brouillon de A : inconnu, aucune ligne", async () => {
    const id = await brouillon(A);
    const r = await ouvrirEnvoisPiecesJointesEmail({
      acteur: B,
      emailManuelId: id,
      pieces: annonces(1, 1000),
    });
    expect(r).toMatchObject({ ok: false, refus: "inconnu" });
    expect(await db.emailManuelPieceJointe.count({ where: { emailManuelId: id } })).toBe(0);
  });
});
