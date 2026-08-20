/**
 * Tests — rate-limit.ts.
 *
 * 🔴 Ce module n'avait AUCUN test, et son comportement le plus lourd de
 * conséquences était celui qu'on ne voit jamais : ce qui se passe quand Redis
 * tombe.
 *
 * Réponse d'origine : `catch { return failOpen(...) }`. Tous les compteurs du
 * site — une quarantaine — laissaient alors tout passer, **sans une ligne de
 * journal**, y compris celui qui protège la connexion à la console
 * d'administration contre la force brute. Le commentaire promettait une alerte
 * Sentry « branchée en M11 » ; elle ne l'a jamais été.
 *
 * Une panne d'infrastructure devenait donc une fenêtre d'attaque, et personne
 * n'était en mesure de savoir qu'elle s'était ouverte.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

vi.mock("./redis", () => ({
  redis: { pipeline: vi.fn(), zrem: vi.fn() },
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { redis } from "./redis";
import * as Sentry from "@sentry/nextjs";
import { checkRateLimit } from "./rate-limit";

const mockRedis = redis as unknown as {
  pipeline: ReturnType<typeof vi.fn>;
  zrem: ReturnType<typeof vi.fn>;
};

/** Redis répond normalement : `zcard` rend `compte`. */
function redisRepond(compte: number) {
  mockRedis.pipeline.mockReturnValue({
    zremrangebyscore: vi.fn(),
    zadd: vi.fn(),
    zcard: vi.fn(),
    pexpire: vi.fn(),
    exec: vi.fn().mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, compte],
      [null, 1],
    ]),
  });
}

/** Redis est tombé. */
function redisEnPanne() {
  mockRedis.pipeline.mockImplementation(() => {
    throw new Error("ECONNREFUSED 127.0.0.1:6379");
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRedis.zrem.mockResolvedValue(1);
});

describe("comptage nominal", () => {
  it("laisse passer sous la limite", async () => {
    redisRepond(3);
    const r = await checkRateLimit("test:ok", { limit: 5, windowSec: 60 });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
    expect(r.panne).toBe(false);
  });

  it("refuse au-dessus de la limite", async () => {
    redisRepond(6);
    const r = await checkRateLimit("test:ko", { limit: 5, windowSec: 60 });
    expect(r.allowed).toBe(false);
    expect(r.panne).toBe(false);
  });
});

describe("🔴 D66-02 — ce qui se passe quand Redis tombe", () => {
  it('refuse quand l\'appelant a déclaré `surPanne: "refuser"`', async () => {
    // Le cas de la connexion admin. Sans cela, il suffit d'attendre — ou de
    // provoquer — une indisponibilité de Redis pour disposer d'un nombre
    // illimité de tentatives de mot de passe sur la console.
    redisEnPanne();
    const r = await checkRateLimit("auth:login:ip:1.2.3.4", {
      limit: 100,
      windowSec: 900,
      surPanne: "refuser",
    });
    expect(r.allowed).toBe(false);
    expect(r.panne).toBe(true);
  });

  it("laisse passer par DÉFAUT — les formulaires publics ne tombent pas avec Redis", async () => {
    // Témoin de NON-RÉGRESSION, et il compte autant que le précédent. Fermer
    // les quarante autres compteurs d'un coup rendrait le formulaire de
    // contact, le chatbot et la demande de devis inutilisables à la première
    // hoquet de Redis — on aurait échangé un risque contre une panne.
    redisEnPanne();
    const r = await checkRateLimit("unified-contact:1.2.3.4", { limit: 3, windowSec: 600 });
    expect(r.allowed).toBe(true);
    expect(r.panne).toBe(true);
  });

  it("🔴 SIGNALE la panne, dans les deux conduites", async () => {
    // Le cœur du constat. Le `catch` d'origine était muet : ni Sentry, ni
    // console. Une ouverture de tous les compteurs du site ne laissait aucune
    // trace, donc n'était pas constatable après coup.
    redisEnPanne();
    await checkRateLimit("test:muet", { limit: 5, windowSec: 60 });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    redisEnPanne();
    await checkRateLimit("test:muet", { limit: 5, windowSec: 60, surPanne: "refuser" });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it("distingue la panne du dépassement — `panne` n'est vrai QUE sur incident", async () => {
    // Sans ce drapeau, un administrateur bloqué pendant une panne Redis lirait
    // « trop de tentatives » et chercherait un verrouillage qui n'existe pas.
    redisRepond(99);
    const r = await checkRateLimit("auth:login:ip:1.2.3.4", {
      limit: 5,
      windowSec: 900,
      surPanne: "refuser",
    });
    expect(r.allowed).toBe(false);
    expect(r.panne).toBe(false);
  });
});

describe("🔴 garde de FAMILLE — tout appel sensible déclare sa conduite", () => {
  /**
   * Les trois premiers tests garderaient un correctif ponctuel. Celui-ci garde
   * la RÈGLE : un compteur sensible ajouté demain sans `surPanne` rougit ici,
   * au lieu de rouvrir le trou en silence.
   *
   * Les préfixes retenus sont ceux où laisser passer transforme une panne
   * d'infrastructure en incident de sécurité : l'authentification, l'émission
   * de liens de connexion, et les demandes RGPD (dont l'effacement, plafonné à
   * UNE par jour).
   */
  const PREFIXES_SENSIBLES = ["auth:login", "gdpr:", ":magic:"];

  /**
   * ⚠️ Deux pièges, tous deux rencontrés en écrivant cette garde :
   *
   *  1. `src/**\/*.ts` en pathspec git ne ramène PAS `src/auth.ts` — soit
   *     précisément le compteur de connexion admin, le plus sensible du lot.
   *     Une garde de famille qui rate le membre le plus important de la
   *     famille est pire qu'aucune garde : elle rassure.
   *  2. Le module scanné contient lui-même `checkRateLimit(\`auth:login:...\`)`
   *     dans son en-tête d'exemple. Sans retrait des commentaires, la garde
   *     se dénonce elle-même et on la neutralise pour la faire taire.
   */
  function sansCommentaires(source: string): string {
    // Les blocs sont remplacés par autant de sauts de ligne : sans cela le
    // numéro rapporté ne désignerait pas la bonne ligne du fichier réel.
    return source
      .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ""))
      .replace(/^[ 	]*\/\/.*$/gm, "");
  }

  let memo: Array<{ fichier: string; source: string }> | null = null;
  function sourcesAvecAppels(): Array<{ fichier: string; source: string }> {
    if (memo !== null) return memo;
    const racine = process.cwd();
    const liste = execFileSync("git", ["ls-files", "src"], {
      cwd: racine,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    })
      .trim()
      .split(/\r?\n/)
      .filter((f) => /\.tsx?$/.test(f) && !/\.spec\.tsx?$/.test(f));
    memo = [];
    for (const fichier of liste) {
      const brut = readFileSync(path.join(racine, fichier), "utf8");
      if (!brut.includes("checkRateLimit(")) continue;
      const source = sansCommentaires(brut);
      if (!source.includes("checkRateLimit(")) continue;
      memo.push({ fichier, source });
    }
    return memo;
  }

  it("recense au moins les appels connus (sinon le balayage est vide et la garde vaine)", () => {
    expect(sourcesAvecAppels().length).toBeGreaterThanOrEqual(15);
  });

  it("aucun appel sensible ne laisse passer en cas de panne Redis", () => {
    const manquants: string[] = [];
    for (const { fichier, source } of sourcesAvecAppels()) {
      let curseur = source.indexOf("checkRateLimit(");
      while (curseur !== -1) {
        const fin = source.indexOf(");", curseur);
        const appel = source.slice(curseur, fin === -1 ? curseur + 400 : fin);
        const sensible = PREFIXES_SENSIBLES.some((p) => appel.includes(p));
        if (sensible && !appel.includes("surPanne")) {
          const ligne = source.slice(0, curseur).split("\n").length;
          manquants.push(`${fichier}:${ligne}`);
        }
        curseur = source.indexOf("checkRateLimit(", curseur + 1);
      }
    }
    expect(manquants, `appels sensibles sans \`surPanne\` : ${manquants.join(", ")}`).toEqual([]);
  });
});
