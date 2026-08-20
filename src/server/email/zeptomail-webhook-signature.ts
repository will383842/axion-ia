// Vérification de la signature des webhooks ZeptoMail (2026-08-20, `D5-3-02`).
//
// ZeptoMail signe chaque livraison avec l'en-tête `Producer-Signature` :
//
//     Producer-Signature: ts=<timestamp_ms>;s=<hmac base64>;s-algorithm=HmacSHA256
//
// Le condensat porte sur le CORPS de la requête, avec la clé d'authentification
// configurée dans Agent > Webhooks > « Authentication Key ».
//
// ⚠️ Trois écarts avec le webhook Calendly voisin, qui rendent une recopie
// dangereuse — d'où un module distinct plutôt qu'un paramétrage du premier :
//   · séparateur `;` et non `,` ;
//   · condensat en BASE64, pas en hexadécimal ;
//   · l'horodatage est en MILLISECONDES, pas en secondes, et il n'entre PAS
//     dans le condensat (Calendry signe `${t}.${corps}`, ZeptoMail signe le
//     corps seul).
//
// 🔴 LE CORPS DOIT ÊTRE LE TEXTE BRUT, octet pour octet. Un `JSON.parse` suivi
// d'un `JSON.stringify` réordonne les clés et normalise les espaces : la
// signature ne correspond plus, et le symptôme (« tout est refusé en 401 ») ne
// dit rien de sa cause. D'où `req.text()` dans la route, jamais `req.json()`.
//
// Module isolé de la route pour être testable sans construire de requête HTTP —
// la vérification de signature est exactement le genre de code qu'on ne veut pas
// tester « en vrai ».

import crypto from "node:crypto";

/**
 * Tolérance d'horloge, en secondes.
 *
 * Une livraison plus vieille que ça est refusée : sans cette borne, quiconque a
 * capturé UNE requête valide peut la rejouer indéfiniment, et chaque rejeu
 * marquerait des envois comme rebondis. Même valeur que le webhook Calendly du
 * dépôt, et que Stripe pour le même problème.
 */
export const TOLERANCE_SECONDS = 300;

export type VerdictSignature =
  | { ok: true }
  | {
      ok: false;
      reason: "missing_header" | "malformed_header" | "bad_algorithm" | "stale" | "mismatch";
    };

/** Découpe `ts=…;s=…;s-algorithm=…` sans supposer l'ordre des champs. */
function parseEntete(header: string): { ts: string; s: string; algo: string } | null {
  let ts: string | undefined;
  let s: string | undefined;
  let algo: string | undefined;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    const key = rawKey?.trim();
    // ⚠️ `rest.join("=")` et non `rest[0]` : une signature base64 se termine
    // fréquemment par `=` de bourrage. Découper sur le premier `=` seulement
    // tronquerait la valeur, et la comparaison échouerait pour une raison qui
    // n'a rien à voir avec la clé.
    const value = rest.join("=").trim();
    if (!key || !value) continue;
    if (key === "ts") ts = value;
    else if (key === "s") s = value;
    else if (key === "s-algorithm") algo = value;
  }
  return ts && s && algo ? { ts, s, algo } : null;
}

/** Comparaison à temps constant de deux condensats base64. */
function base64Equals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "base64");
  const bufB = Buffer.from(b, "base64");
  // `timingSafeEqual` lève si les longueurs diffèrent — on le teste AVANT,
  // sinon la fonction lève au lieu de rendre `false` et la route répondrait 500
  // sur une signature simplement tronquée.
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Vérifie la signature d'une livraison ZeptoMail.
 *
 * @param corpsBrut Corps de la requête TEL QUEL (`await req.text()`).
 * @param header    Contenu de l'en-tête `Producer-Signature`.
 * @param cle       `ZEPTOMAIL_WEBHOOK_KEY`.
 * @param nowMs     Injectable pour les tests — jamais fourni en production.
 */
export function verifierSignatureZeptomail(
  corpsBrut: string,
  header: string | null,
  cle: string,
  nowMs: number = Date.now(),
): VerdictSignature {
  if (!header) return { ok: false, reason: "missing_header" };
  const parts = parseEntete(header);
  if (parts === null) return { ok: false, reason: "malformed_header" };

  // L'algorithme est ANNONCÉ par l'émetteur : on le vérifie plutôt que de le
  // supposer. Accepter un algorithme inconnu en calculant quand même un
  // HMAC-SHA256 reviendrait à ignorer un changement de contrat côté
  // fournisseur — et à le découvrir par des refus inexpliqués.
  if (parts.algo.trim().toLowerCase() !== "hmacsha256") {
    return { ok: false, reason: "bad_algorithm" };
  }

  const tsMs = Number(parts.ts);
  if (!Number.isFinite(tsMs)) return { ok: false, reason: "malformed_header" };
  // ⚠️ MILLISECONDES. Traiter cet horodatage comme des secondes rendrait TOUTE
  // livraison « périmée de 55 ans » — un refus total dont la cause serait
  // introuvable dans les journaux.
  if (Math.abs(nowMs - tsMs) / 1000 > TOLERANCE_SECONDS) return { ok: false, reason: "stale" };

  const attendu = crypto.createHmac("sha256", cle).update(corpsBrut, "utf8").digest("base64");
  if (base64Equals(attendu, parts.s)) return { ok: true };

  // 🔑 SECONDE TENTATIVE sur le corps décodé, et ce n'est pas une facilité.
  //
  // La documentation ZeptoMail prescrit de « décoder le corps (URLDecoder) »
  // avant de recalculer le condensat. Selon la façon dont l'agent poste, le
  // corps arrive tantôt tel quel, tantôt percent-encodé — et une implémentation
  // qui n'en essaie qu'une refuse tout, sans que le journal dise laquelle.
  //
  // La sécurité n'en souffre pas : les deux formes dérivent du même corps de
  // façon déterministe, et il faut toujours la clé pour produire l'un ou
  // l'autre condensat.
  let decode: string;
  try {
    decode = decodeURIComponent(corpsBrut.replace(/\+/g, " "));
  } catch {
    // Corps contenant un `%` isolé : `decodeURIComponent` lève. Ce n'est pas une
    // signature invalide, c'est une forme qu'on ne sait pas décoder — on s'en
    // tient au verdict de la première tentative.
    return { ok: false, reason: "mismatch" };
  }
  if (decode === corpsBrut) return { ok: false, reason: "mismatch" };

  const attenduDecode = crypto.createHmac("sha256", cle).update(decode, "utf8").digest("base64");
  return base64Equals(attenduDecode, parts.s) ? { ok: true } : { ok: false, reason: "mismatch" };
}
