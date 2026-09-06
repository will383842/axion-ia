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
import { checkRateLimit, consulterRateLimit, enregistrerTentative } from "./rate-limit";

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

describe("consulter sans compter (2026-09-06)", () => {
  /** `consulterRateLimit` n'utilise que `zremrangebyscore` puis `zcard`. */
  function redisConsulte(compte: number) {
    const zadd = vi.fn();
    mockRedis.pipeline.mockReturnValue({
      zremrangebyscore: vi.fn(),
      zadd,
      zcard: vi.fn(),
      pexpire: vi.fn(),
      exec: vi.fn().mockResolvedValue([
        [null, 0],
        [null, compte],
      ]),
    });
    return { zadd };
  }

  it("n'ajoute AUCUNE tentative — c'est toute sa raison d'être", async () => {
    const { zadd } = redisConsulte(3);
    await consulterRateLimit("auth:login:email:a@b.fr", { limit: 10, windowSec: 900 });
    // Sans cette assertion, `consulterRateLimit` pourrait compter comme avant et
    // le double comptage survivrait à sa propre correction, sans aucun rouge.
    expect(zadd).not.toHaveBeenCalled();
  });

  it("rend le compte en cours sans le gonfler", async () => {
    redisConsulte(3);
    const r = await consulterRateLimit("auth:login:email:a@b.fr", { limit: 10, windowSec: 900 });
    expect(r.count).toBe(3);
    expect(r.remaining).toBe(7);
    expect(r.allowed).toBe(true);
  });

  it("🔑 refuse DÈS que le compte atteint la limite — la tentative en cours n'est pas comptée", async () => {
    // `checkRateLimit` compare `count <= limit` parce que son `count` INCLUT le
    // hit qu'il vient d'ajouter. Reprendre ce `<=` ici laisserait passer une
    // 11e tentative sur un plafond de 10 : la consultation ne compte pas.
    redisConsulte(10);
    const r = await consulterRateLimit("auth:login:email:a@b.fr", { limit: 10, windowSec: 900 });
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("suit la conduite déclarée quand Redis tombe", async () => {
    redisEnPanne();
    const refus = await consulterRateLimit("auth:login:ip:1.2.3.4", {
      limit: 10,
      windowSec: 900,
      surPanne: "refuser",
    });
    expect(refus.allowed).toBe(false);
    expect(refus.panne).toBe(true);

    vi.clearAllMocks();
    redisEnPanne();
    const passe = await consulterRateLimit("public:x", { limit: 3, windowSec: 600 });
    expect(passe.allowed).toBe(true);
  });

  it("`enregistrerTentative` ajoute un hit, et ne jette jamais sur panne", async () => {
    const zadd = vi.fn();
    mockRedis.pipeline.mockReturnValue({
      zremrangebyscore: vi.fn(),
      zadd,
      pexpire: vi.fn(),
      exec: vi.fn().mockResolvedValue([]),
    });
    await enregistrerTentative("auth:login:email:a@b.fr", { limit: 10, windowSec: 900 });
    expect(zadd).toHaveBeenCalledTimes(1);

    // Une panne du compteur ne doit pas transformer un refus de connexion en 500.
    vi.clearAllMocks();
    redisEnPanne();
    await expect(
      enregistrerTentative("auth:login:email:a@b.fr", { limit: 10, windowSec: 900 }),
    ).resolves.toBeUndefined();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
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
   * 🔴 2026-09-06 — CETTE GARDE A FAILLI CESSER DE COUVRIR SON MEMBRE LE PLUS
   *    SENSIBLE, SANS ROUGIR UNE SECONDE.
   *
   * Les deux compteurs de connexion admin s'écrivaient
   * `checkRateLimit(\`auth:login:ip:\${ip}\`, { … })`. En sortant les plafonds
   * vers le SSOT `lib/limites-connexion-admin.ts`, ils sont devenus
   * `checkRateLimit(cleConnexionIp(ip), LIMITE_CONNEXION_IP)` : plus aucun
   * littéral `auth:login` dans le texte de l'appel. Le test `sensible` rendait
   * donc `false`, l'appel n'était plus examiné, et le témoin « ≥ 15 fichiers »
   * continuait de passer (43 fichiers). **Zéro rouge, zéro couverture.**
   *
   * Les constructeurs de clés du SSOT sont donc des marqueurs sensibles au même
   * titre qu'un préfixe littéral.
   */
  const CONSTRUCTEURS_SENSIBLES = ["cleConnexionIp", "cleConnexionCompte"];

  /**
   * Configurations SSOT dont le `surPanne` est vérifié à la source.
   *
   * Un appel qui les passe satisfait la règle sans répéter `surPanne` sur
   * place — c'est tout l'intérêt d'un SSOT. Le contrôle n'est pas perdu : il
   * est déplacé dans `limites-connexion-admin.spec.ts`, qui assert que ces deux
   * constantes déclarent bien `surPanne: "refuser"`. Sans ce test-là, cette
   * liste serait une échappatoire.
   */
  const CONFIGS_SSOT_VERIFIEES = ["LIMITE_CONNEXION_IP", "LIMITE_CONNEXION_COMPTE"];

  /**
   * Les fonctions qui rendent un VERDICT, et qui doivent donc dire quoi faire
   * sur panne. `enregistrerTentative` n'en rend pas : elle en est exclue.
   */
  const FONCTIONS_A_VERDICT = ["checkRateLimit(", "consulterRateLimit("];

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
      if (!FONCTIONS_A_VERDICT.some((f) => brut.includes(f))) continue;
      const source = sansCommentaires(brut);
      if (!FONCTIONS_A_VERDICT.some((f) => source.includes(f))) continue;
      memo.push({ fichier, source });
    }
    return memo;
  }

  it("recense au moins les appels connus (sinon le balayage est vide et la garde vaine)", () => {
    expect(sourcesAvecAppels().length).toBeGreaterThanOrEqual(15);
  });

  /** Tous les appels à verdict du dépôt, texte de l'appel + position. */
  function appelsAVerdict(): Array<{ fichier: string; ligne: number; appel: string }> {
    const out: Array<{ fichier: string; ligne: number; appel: string }> = [];
    for (const { fichier, source } of sourcesAvecAppels()) {
      for (const fn of FONCTIONS_A_VERDICT) {
        let curseur = source.indexOf(fn);
        while (curseur !== -1) {
          const fin = source.indexOf(");", curseur);
          out.push({
            fichier,
            ligne: source.slice(0, curseur).split("\n").length,
            appel: source.slice(curseur, fin === -1 ? curseur + 400 : fin),
          });
          curseur = source.indexOf(fn, curseur + 1);
        }
      }
    }
    return out;
  }

  const estSensible = (appel: string): boolean =>
    PREFIXES_SENSIBLES.some((p) => appel.includes(p)) ||
    CONSTRUCTEURS_SENSIBLES.some((c) => appel.includes(c));

  it("aucun appel sensible ne laisse passer en cas de panne Redis", () => {
    const manquants = appelsAVerdict()
      .filter(
        ({ appel }) =>
          estSensible(appel) &&
          !appel.includes("surPanne") &&
          !CONFIGS_SSOT_VERIFIEES.some((c) => appel.includes(c)),
      )
      .map(({ fichier, ligne }) => `${fichier}:${ligne}`);
    expect(manquants, `appels sensibles sans \`surPanne\` : ${manquants.join(", ")}`).toEqual([]);
  });

  /**
   * 🔴 LE TÉMOIN POSITIF DE LA SENSIBILITÉ, et il manquait.
   *
   * Le test ci-dessus rend une liste vide dans DEUX mondes : celui où tous les
   * appels sensibles déclarent leur conduite, et celui où plus aucun appel
   * n'est reconnu comme sensible. C'est le second qui s'est produit le
   * 2026-09-06 sans que rien ne bouge. On exige donc que la reconnaissance
   * TROUVE quelque chose — et nommément les deux compteurs de connexion, qui
   * sont la raison d'être de cette garde.
   */
  it("reconnaît encore les compteurs de connexion admin — sinon elle ne garde rien", () => {
    const sensibles = appelsAVerdict().filter(({ appel }) => estSensible(appel));
    expect(sensibles.length, "plus aucun appel sensible reconnu").toBeGreaterThanOrEqual(4);

    const fichiers = new Set(sensibles.map((a) => a.fichier));
    expect(fichiers, "le compteur de `authorize()` n'est plus vu").toContain("src/auth.ts");
    expect(fichiers, "le compteur de `signInAction` n'est plus vu").toContain(
      "src/features/admin-auth/actions.ts",
    );
  });
});
