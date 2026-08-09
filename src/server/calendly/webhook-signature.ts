// Vérification de la signature des webhooks Calendly (2026-08-09).
//
// Calendly signe chaque livraison avec l'en-tête `Calendly-Webhook-Signature` :
//
//     Calendly-Webhook-Signature: t=1699999999,v1=<hmac-sha256 hexadécimal>
//
// Le condensat porte sur `${t}.${corps brut}` et utilise la clé secrète rendue
// UNE SEULE FOIS à la création de l'abonnement.
//
// 🔴 LE CORPS DOIT ÊTRE LE TEXTE BRUT, octet pour octet. Un `JSON.parse` suivi
// d'un `JSON.stringify` réordonne les clés et normalise les espaces : la
// signature ne correspond plus, et le symptôme (« tout est refusé en 401 »)
// n'indique pas du tout sa cause. D'où `req.text()` dans la route, jamais
// `req.json()`.
//
// Ce module est isolé de la route pour être testable sans construire de requête
// HTTP — la vérification de signature est exactement le genre de code qu'on ne
// veut pas tester « en vrai ».

import crypto from "node:crypto";

/**
 * Tolérance d'horloge, en secondes.
 *
 * Une livraison plus vieille que ça est refusée : sans cette borne, un
 * attaquant qui a capturé UNE requête valide peut la rejouer indéfiniment, et
 * chaque rejeu déclencherait une alerte. 5 minutes est la valeur retenue par
 * Stripe pour le même problème, et couvre largement une dérive NTP normale.
 */
export const TOLERANCE_SECONDS = 300;

export type SignatureVerdict =
  | { ok: true }
  | { ok: false; reason: "missing_header" | "malformed_header" | "stale" | "mismatch" };

/** Découpe `t=…,v1=…` sans supposer l'ordre des champs. */
function parseHeader(header: string): { t: string; v1: string } | null {
  let t: string | undefined;
  let v1: string | undefined;
  for (const part of header.split(",")) {
    const [rawKey, ...rest] = part.split("=");
    const key = rawKey?.trim();
    const value = rest.join("=").trim();
    if (!key || !value) continue;
    if (key === "t") t = value;
    else if (key === "v1") v1 = value;
  }
  return t && v1 ? { t, v1 } : null;
}

/** Comparaison à temps constant de deux condensats hexadécimaux. */
function hexEquals(a: string, b: string): boolean {
  // `timingSafeEqual` throw si les longueurs diffèrent — on le teste AVANT,
  // sinon la fonction lève au lieu de renvoyer false et la route rendrait 500
  // sur une signature simplement tronquée.
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    // Caractère non hexadécimal : `Buffer.from` tronque silencieusement, donc on
    // refuse plutôt que de comparer des tampons de longueurs incohérentes.
    return false;
  }
}

/**
 * Vérifie la signature d'une livraison Calendly.
 *
 * @param rawBody Corps de la requête TEL QUEL (`await req.text()`).
 * @param header  Contenu de l'en-tête `Calendly-Webhook-Signature`.
 * @param key     `CALENDLY_WEBHOOK_SIGNING_KEY`.
 * @param nowMs   Injectable pour les tests — jamais fourni en production.
 */
export function verifyCalendlySignature(
  rawBody: string,
  header: string | null,
  key: string,
  nowMs: number = Date.now(),
): SignatureVerdict {
  if (!header) return { ok: false, reason: "missing_header" };

  const parsed = parseHeader(header);
  if (!parsed) return { ok: false, reason: "malformed_header" };

  const timestamp = Number(parsed.t);
  if (!Number.isFinite(timestamp)) return { ok: false, reason: "malformed_header" };

  // `Math.abs` volontairement : une livraison DATÉE DANS LE FUTUR est tout aussi
  // suspecte qu'une trop ancienne, et sans valeur absolue elle passerait.
  if (Math.abs(nowMs / 1000 - timestamp) > TOLERANCE_SECONDS) {
    return { ok: false, reason: "stale" };
  }

  const expected = crypto
    .createHmac("sha256", key)
    .update(`${parsed.t}.${rawBody}`, "utf8")
    .digest("hex");

  return hexEquals(expected, parsed.v1) ? { ok: true } : { ok: false, reason: "mismatch" };
}
