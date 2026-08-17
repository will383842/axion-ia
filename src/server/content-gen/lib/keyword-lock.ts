/**
 * Content Generator — Global keyword lock Redis (Sprint Final P1-14 2026-05-22).
 *
 * Audit final Fl-08 multi-campagnes parallèles 23/25 — gap :
 * `keyword-selector` réserve atomiquement au niveau DB (`SELECT ... FOR UPDATE
 * SKIP LOCKED`) puis met à jour `last_used_at`. Si 3 campagnes parallèles
 * tirent un keyword commun (transversal) à quelques millisecondes d'écart, la
 * réservation DB est correcte (chacune obtient un keyword différent), MAIS si
 * Will configure 2 campagnes avec la *même* liste de keywords (ex: blog-from-
 * title qui force `primaryKeyword="formation IA Paris"`), 2 workers peuvent
 * générer simultanément le même article sans que le keyword-selector ne soit
 * jamais sollicité.
 *
 * Ce module ajoute un second niveau de défense : un lock Redis atomique par
 * keyword normalisé. Acquis juste après que le keyword est résolu (DB ou
 * payload direct), AVANT l'appel LLM. Released par le content-publish-worker
 * en fin de pipeline. TTL 30 min = couvre génération + judge + improve +
 * publish (pipeline typique 5-15 min ; marge 2-6×).
 *
 * Primitive Redis : `SET key value NX EX ttl`. Atomic single-command, pas
 * besoin de Redlock library (overkill pour V1 single-region Redis). Le ttl
 * garantit auto-release en cas de crash worker (lock pas orphelin > 30 min).
 *
 * Stub-aware : si `REDIS_URL=stub.invalid` (build SSG GH Actions), le client
 * redis.ts retourne un Proxy no-op. Le `set NX EX` retourne null → on
 * considère que le lock est acquis (build-safe : on ne veut pas bloquer le
 * SSG d'un sitemap qui n'aurait aucune raison de tenir un lock keyword).
 */

import { redis } from "@/lib/redis";

const KEYWORD_LOCK_PREFIX = "keyword-lock:";
const DEFAULT_TTL_SEC = 1800; // 30 min — couvre gen + judge + improve + publish

/**
 * TTL par défaut exporté (Fix 2026-08-15 C3) : le content-gen-worker doit passer
 * un token de propriété (3ᵉ argument), donc expliciter aussi le TTL — on exporte
 * la constante pour qu'il ne duplique pas un « 1800 » magique qui divergerait.
 */
export const KEYWORD_LOCK_TTL_SEC = DEFAULT_TTL_SEC;

/**
 * Normalisation FR cohérente avec `keyword-selector.normalize` :
 * lowercase + NFD strip diacritics + trim. Garantit que "Formation IA",
 * "formation ia", "Formation IA " produisent le même lock key.
 *
 * Utilise `̀-ͯ` (combining diacritical marks) en notation Unicode
 * échappée pour éviter tout caractère invisible dans la regex source.
 */
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/** Détection runtime du Redis stub (build SSG). */
function isStubRedis(): boolean {
  return Boolean(process.env.REDIS_URL?.includes("stub.invalid"));
}

/**
 * Tente d'acquérir un lock global Redis sur ce keyword.
 *
 * @param keyword - Keyword brut (sera normalisé). Ex: "Formation IA Paris".
 * @param ttlSec  - TTL en secondes (auto-release si crash). Default 1800 (30 min).
 * @param owner   - Token de propriété (Fix 2026-08-15 C3, voir ci-dessous).
 * @returns `true` si lock acquis, `false` si un autre worker le tient déjà.
 *
 * ## Token de propriété (Fix 2026-08-15, audit e2e — C3)
 *
 * Symptôme observé en prod : le lock n'était relâché QUE par le
 * content-publish-worker. Un job dont la 1ʳᵉ passe sortait sans publier
 * (boucle qualité → re-génération, retry BullMQ après crash) revenait dans
 * les 30 min du TTL et retombait sur… SON PROPRE lock — impossible de
 * distinguer « moi-même il y a 5 min » d'« un worker concurrent ». Le job se
 * marquait alors `cancelled` « Keyword lock held by another worker » : le
 * pipeline s'auto-annulait, précisément sur les contenus que la boucle
 * qualité devait améliorer.
 *
 * Correctif : la valeur stockée sous la clé n'est plus le "1" anonyme mais le
 * token du propriétaire (le `contentGenJobId`). Si le SET NX échoue, on lit
 * la valeur : si elle porte NOTRE token, le lock est ré-entrant — on le
 * considère acquis et on rafraîchit le TTL (la re-génération repart pour un
 * cycle complet). Cette voie couvre aussi le retry après crash (même jobId),
 * ce qu'une simple libération dans le catch d'échec ne couvrirait pas — c'est
 * pourquoi l'option « propriété » a été préférée à l'option « release sur
 * chaque chemin de sortie ».
 *
 * Sans token (appels existants) : comportement historique inchangé.
 *
 * Cas particuliers :
 *  - keyword vide / null-ish → `true` (no-op, ne bloque pas le pipeline)
 *  - Redis stub (build SSG) → `true` (no-op, ne bloque pas le build)
 *  - Erreur Redis (timeout, ECONNREFUSED) → `true` (fail-open ; on ne veut
 *    pas qu'une panne Redis bloque TOUT content-gen ; le DB-level lock du
 *    keyword-selector reste la défense primaire).
 */
export async function acquireKeywordLock(
  keyword: string,
  ttlSec: number = DEFAULT_TTL_SEC,
  owner?: string,
): Promise<boolean> {
  if (!keyword || typeof keyword !== "string") return true;
  if (isStubRedis()) return true;

  const key = `${KEYWORD_LOCK_PREFIX}${normalize(keyword)}`;
  try {
    // ioredis signature : set(key, value, 'EX', seconds, 'NX'). Retourne "OK"
    // si acquis (clé absente), null sinon (clé déjà présente).
    // Note : ordre des modificateurs important — "EX" doit précéder le TTL.
    const res = await redis.set(key, owner ?? "1", "EX", ttlSec, "NX");
    if (res === "OK") return true;
    // Fix 2026-08-15 (C3) — lock déjà présent : est-ce LE NÔTRE ? (re-génération
    // boucle qualité ou retry BullMQ du même job < TTL). Si oui, ré-entrant :
    // acquis, et on repousse le TTL pour couvrir le nouveau cycle complet.
    // Micro-fenêtre GET→SET non atomique tolérée : si le lock expire entre les
    // deux, le SET XX est un no-op et le TTL résiduel reste le filet de sécurité.
    if (owner) {
      const current = await redis.get(key);
      if (current === owner) {
        await redis.set(key, owner, "EX", ttlSec, "XX");
        return true;
      }
    }
    return false;
  } catch (err) {
    // Fail-open : panne Redis ne doit pas bloquer le pipeline. Le DB-level
    // lock du keyword-selector reste la défense primaire (SKIP LOCKED).
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[keyword-lock] acquire failed, fail-open:",
        err instanceof Error ? err.message : String(err),
      );
    }
    return true;
  }
}

/**
 * Release explicitement le lock Redis sur ce keyword. À appeler en fin de
 * pipeline (succès publication). En cas d'échec / crash, le TTL garantit
 * auto-release après 30 min.
 *
 * @param keyword - Keyword brut (sera normalisé). Doit matcher acquireKeywordLock.
 *
 * Cas particuliers :
 *  - keyword vide / null-ish → no-op
 *  - Redis stub (build SSG) → no-op
 *  - Erreur Redis → log silencieux (lock auto-release via TTL de toute façon)
 */
export async function releaseKeywordLock(keyword: string): Promise<void> {
  if (!keyword || typeof keyword !== "string") return;
  if (isStubRedis()) return;

  const key = `${KEYWORD_LOCK_PREFIX}${normalize(keyword)}`;
  try {
    await redis.del(key);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[keyword-lock] release failed (lock TTL will auto-expire):",
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}

/**
 * Build la clé Redis pour ce keyword. Exporté pour tests + introspection
 * admin (debugging "quel keyword est lock right now ?").
 */
export function buildKeywordLockKey(keyword: string): string {
  return `${KEYWORD_LOCK_PREFIX}${normalize(keyword)}`;
}
