// Sliding window rate limiter via Redis sorted sets (Sprint 15 / M8).
//
// Pattern : pour chaque (key, fenetre), on stocke des timestamps en sorted set,
// on purge les vieux, puis on compte ceux dans la fenetre courante. Atomique
// via pipeline.
//
// ── 🔴 Que faire quand Redis tombe ? (`D66-02`, 2026-08-19) ──────────────────
//
// Ce module laissait TOUT passer, sans une ligne de journal. L'en-tete
// promettait « alerte Sentry » et le catch promettait « branche en M11» : ni
// l'un ni l'autre n'a jamais existe. Une panne d'infrastructure ouvrait donc
// d'un coup les quarante compteurs du site — y compris celui qui protege la
// connexion a la console d'administration contre la force brute — et ne
// laissait aucune trace permettant de le constater apres coup.
//
// Le remede n'est PAS de tout fermer : le formulaire de contact, le chatbot et
// la demande de devis doivent survivre a un hoquet de Redis. La conduite se
// declare donc par appel, via `surPanne` :
//
//   · "laisser-passer" (defaut) — surfaces publiques. Une panne ne doit pas
//     couper le site.
//   · "refuser"                 — authentification, emission de liens de
//     connexion, demandes RGPD. La ou laisser passer transformerait une panne
//     en incident de securite.
//
// Dans les DEUX cas la panne est desormais signalee a Sentry, et `panne: true`
// remonte a l'appelant pour qu'il distingue « trop de tentatives » de « le
// compteur est aveugle » — un administrateur refuse pendant une panne doit
// pouvoir comprendre ce qui lui arrive.
//
// ⚠️ Le choix par appel est garde par `rate-limit.spec.ts` : tout appel dont
// la cle porte un prefixe sensible DOIT declarer `surPanne`.
//
// Usage type :
//   const ok = await checkRateLimit(`funnel:${ip}`, { limit: 5, windowSec: 900 });
//   if (!ok.allowed) throw new Error("too many attempts");

import * as Sentry from "@sentry/nextjs";
import { redis } from "./redis";

/** Conduite a tenir quand Redis est indisponible. */
export type ConduiteSurPanne = "laisser-passer" | "refuser";

export interface RateLimitConfig {
  /** Nombre max de hits autorises dans la fenetre. */
  limit: number;
  /** Duree de la fenetre en secondes. */
  windowSec: number;
  /**
   * Conduite si Redis est injoignable. Defaut : "laisser-passer".
   *
   * ⚠️ Obligatoire — et verifie par un test — des que la cle porte un prefixe
   * sensible (`auth:login`, `gdpr:`, `:magic:`).
   */
  surPanne?: ConduiteSurPanne;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Hits comptabilises dans la fenetre actuelle (ce hit inclus si allowed). */
  count: number;
  /** Hits restants avant blocage. */
  remaining: number;
  /** Timestamp ms du prochain reset (= timestamp du plus vieux hit + windowSec). */
  resetAt: number;
  /**
   * Vrai UNIQUEMENT si le verdict vient d'une panne du compteur, pas du
   * comptage. Permet a l'appelant de ne pas annoncer « trop de tentatives » a
   * quelqu'un qui n'en a fait aucune.
   */
  panne: boolean;
}

/**
 * CONSULTE un compteur sans y ajouter de tentative.
 *
 * ── 🔴 Pourquoi cette fonction existe (2026-09-06) ───────────────────────────
 *
 * La connexion a la console est verifiee DEUX fois sur les memes cles :
 * `signInAction` (features/admin-auth/actions.ts) puis `authorize()` (auth.ts),
 * que la premiere appelle via `signIn("credentials")`. Une connexion REUSSIE
 * consommait donc deux hits — le budget reel etait la moitie de celui affiche,
 * et c'est l'utilisateur legitime qui le payait.
 *
 * ⚠️ CE QUE CETTE FONCTION NE DOIT PAS DEVENIR. Remplacer naivement le
 *    comptage d'`authorize()` par une consultation OUVRIRAIT le peage :
 *    `/api/auth/callback/credentials` est joignable directement, sans passer
 *    par l'action serveur. Le comptage doit rester sur le chemin qu'on ne peut
 *    pas contourner. C'est donc l'ACTION qui consulte, et qui n'enregistre la
 *    tentative que sur les chemins ou elle rend la main sans appeler `signIn`.
 *
 * Sur panne, la conduite est celle de `config.surPanne`, comme `checkRateLimit`.
 */
export async function consulterRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  const cutoff = now - windowMs;

  try {
    const pipe = redis.pipeline();
    pipe.zremrangebyscore(key, 0, cutoff);
    pipe.zcard(key);
    const results = await pipe.exec();

    if (!results) {
      return surPanne(new Error("rate-limit: pipeline sans resultat"), key, now, config, windowMs);
    }
    const count = (results[1]?.[1] as number | undefined) ?? 0;
    return {
      // 🔑 `<` et non `<=` : la tentative en cours n'est PAS encore comptee.
      //    Autoriser a `count === limit` laisserait passer la (limit + 1)e.
      allowed: count < config.limit,
      count,
      remaining: Math.max(0, config.limit - count),
      resetAt: now + windowMs,
      panne: false,
    };
  } catch (err) {
    return surPanne(err, key, now, config, windowMs);
  }
}

/**
 * ENREGISTRE une tentative sans rendre de verdict.
 *
 * Complement de `consulterRateLimit` : l'appelant a consulte, a laisse passer,
 * et sait maintenant que la tentative doit etre decomptee (mot de passe faux,
 * compte inconnu, compte inactif). N'echoue jamais bruyamment — une panne du
 * compteur ne doit pas transformer un refus de connexion en erreur 500.
 */
export async function enregistrerTentative(key: string, config: RateLimitConfig): Promise<void> {
  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;

  try {
    const pipe = redis.pipeline();
    pipe.zremrangebyscore(key, 0, now - windowMs);
    pipe.zadd(key, now, member);
    pipe.pexpire(key, windowMs);
    await pipe.exec();
  } catch (err) {
    // Meme signalement que les verdicts : un compteur aveugle doit etre datable.
    Sentry.captureException(err, {
      level: "error",
      tags: { service: "enregistrerTentative" },
      extra: { clePrefixe: key.split(":").slice(0, 2).join(":") },
    });
  }
}

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  const cutoff = now - windowMs;
  const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;

  try {
    const pipe = redis.pipeline();
    pipe.zremrangebyscore(key, 0, cutoff);
    pipe.zadd(key, now, member);
    pipe.zcard(key);
    pipe.pexpire(key, windowMs);
    const results = await pipe.exec();

    if (!results) {
      // Pipeline sans resultat : Redis a repondu, mais pas exploitablement.
      // Meme traitement qu'une panne — c'en est une.
      return surPanne(new Error("rate-limit: pipeline sans resultat"), key, now, config, windowMs);
    }
    const countResult = results[2];
    const count = (countResult?.[1] as number | undefined) ?? 0;
    const allowed = count <= config.limit;
    if (!allowed) {
      // Suppression du marker du hit refuse (sinon il bloque le reset)
      await redis.zrem(key, member);
    }
    return {
      allowed,
      count: allowed ? count : count - 1,
      remaining: Math.max(0, config.limit - count),
      resetAt: now + windowMs,
      panne: false,
    };
  } catch (err) {
    return surPanne(err, key, now, config, windowMs);
  }
}

function surPanne(
  err: unknown,
  key: string,
  now: number,
  config: RateLimitConfig,
  windowMs: number,
): RateLimitResult {
  const conduite = config.surPanne ?? "laisser-passer";

  // 🔴 Signale TOUJOURS, quelle que soit la conduite. C'etait le pire du
  // constat : les compteurs s'ouvraient en silence, donc la fenetre
  // d'exposition n'etait meme pas datable apres coup.
  Sentry.captureException(err, {
    level: conduite === "refuser" ? "error" : "warning",
    tags: { service: "checkRateLimit", conduite },
    // ⚠️ Le prefixe SEUL : la cle complete porte une IP ou une adresse
    // electronique, qui n'ont rien a faire dans un rapport d'incident.
    extra: { clePrefixe: key.split(":").slice(0, 2).join(":") },
  });

  return {
    allowed: conduite === "laisser-passer",
    count: 0,
    remaining: conduite === "laisser-passer" ? config.limit : 0,
    resetAt: now + windowMs,
    panne: true,
  };
}
