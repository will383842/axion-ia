/**
 * 🔴 `D5-3-02` — vérification de la signature des webhooks ZeptoMail.
 *
 * Cet endpoint est PUBLIC : il n'a pas de session, pas de cookie, et ce qu'il
 * accepte marque des envois comme rebondis. Une signature mal vérifiée
 * laisserait n'importe qui déclarer qu'une convocation n'est jamais arrivée.
 *
 * ## Trois écarts avec le webhook Calendly voisin
 *
 * Ils rendent une recopie dangereuse, et chacun a son cas ici :
 *   · séparateur `;` au lieu de `,` ;
 *   · condensat en BASE64, pas en hexadécimal — donc terminé par des `=` de
 *     bourrage, qui cassent un découpage naïf sur le premier `=` ;
 *   · horodatage en MILLISECONDES, et hors du condensat.
 */

import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifierSignatureZeptomail, TOLERANCE_SECONDS } from "./zeptomail-webhook-signature";

const CLE = "cle-secrete-de-test";
const MAINTENANT = 1_766_000_000_000; // ms

const CORPS = JSON.stringify({
  event_name: "hardbounce",
  event_message: { request_id: "req-1" },
});

function signer(corps: string, cle = CLE): string {
  return crypto.createHmac("sha256", cle).update(corps, "utf8").digest("base64");
}

function entete(corps: string, opts: { ts?: number; algo?: string; cle?: string } = {}): string {
  const ts = opts.ts ?? MAINTENANT;
  const algo = opts.algo ?? "HmacSHA256";
  return `ts=${ts};s=${signer(corps, opts.cle ?? CLE)};s-algorithm=${algo}`;
}

describe("verifierSignatureZeptomail", () => {
  it("accepte une livraison correctement signée", () => {
    expect(verifierSignatureZeptomail(CORPS, entete(CORPS), CLE, MAINTENANT)).toEqual({ ok: true });
  });

  it("🔴 refuse une signature produite avec une AUTRE clé", () => {
    // Le cas qui compte : quelqu'un qui connaît le format mais pas le secret.
    const header = entete(CORPS, { cle: "mauvaise-cle" });
    expect(verifierSignatureZeptomail(CORPS, header, CLE, MAINTENANT)).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });

  it("🔴 refuse un corps MODIFIÉ après signature", () => {
    const header = entete(CORPS);
    const altere = CORPS.replace("hardbounce", "softbounce");
    expect(verifierSignatureZeptomail(altere, header, CLE, MAINTENANT)).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });

  it("🔴 refuse un REJEU au-delà de la tolérance", () => {
    // Sans cette borne, une requête valide capturée une fois se rejoue
    // indéfiniment — et chaque rejeu marquerait des envois comme rebondis.
    const vieux = MAINTENANT - (TOLERANCE_SECONDS + 1) * 1000;
    const header = entete(CORPS, { ts: vieux });
    expect(verifierSignatureZeptomail(CORPS, header, CLE, MAINTENANT)).toEqual({
      ok: false,
      reason: "stale",
    });
  });

  it("accepte une livraison juste DANS la tolérance", () => {
    // Témoin de non-vacuité du rejeu : sans lui, une borne trop stricte
    // refuserait tout et le cas précédent passerait quand même.
    const limite = MAINTENANT - (TOLERANCE_SECONDS - 10) * 1000;
    const header = entete(CORPS, { ts: limite });
    expect(verifierSignatureZeptomail(CORPS, header, CLE, MAINTENANT)).toEqual({ ok: true });
  });

  it("🔴 l'horodatage est en MILLISECONDES", () => {
    // Le traiter comme des secondes rendrait TOUTE livraison « périmée de
    // 55 ans » — un refus total dont la cause serait introuvable au journal.
    const enSecondes = Math.floor(MAINTENANT / 1000);
    const header = entete(CORPS, { ts: enSecondes });
    expect(verifierSignatureZeptomail(CORPS, header, CLE, MAINTENANT).ok).toBe(false);
  });

  it("🔴 le `=` de bourrage base64 ne tronque pas la signature", () => {
    // Un découpage sur le PREMIER `=` amputerait le condensat. On vérifie sur un
    // corps dont la signature se termine réellement par `=`, sinon le cas ne
    // prouve rien.
    let corps = CORPS;
    for (let i = 0; i < 50 && !signer(corps).endsWith("="); i++) corps = `${CORPS}${" ".repeat(i)}`;
    expect(signer(corps).endsWith("="), "aucun corps de test ne produit de bourrage").toBe(true);
    expect(verifierSignatureZeptomail(corps, entete(corps), CLE, MAINTENANT)).toEqual({ ok: true });
  });

  it("refuse un algorithme annoncé différent", () => {
    // Accepter un algorithme inconnu en calculant quand même un HMAC-SHA256
    // reviendrait à ignorer un changement de contrat côté fournisseur.
    const header = entete(CORPS, { algo: "HmacSHA1" });
    expect(verifierSignatureZeptomail(CORPS, header, CLE, MAINTENANT)).toEqual({
      ok: false,
      reason: "bad_algorithm",
    });
  });

  it("refuse un en-tête absent ou malformé, sans lever", () => {
    expect(verifierSignatureZeptomail(CORPS, null, CLE, MAINTENANT)).toEqual({
      ok: false,
      reason: "missing_header",
    });
    expect(verifierSignatureZeptomail(CORPS, "n'importe quoi", CLE, MAINTENANT)).toEqual({
      ok: false,
      reason: "malformed_header",
    });
    expect(
      verifierSignatureZeptomail(CORPS, "ts=abc;s=xx;s-algorithm=HmacSHA256", CLE, MAINTENANT),
    ).toEqual({ ok: false, reason: "malformed_header" });
  });

  it("🔴 une signature TRONQUÉE est refusée, pas une exception", () => {
    // `timingSafeEqual` lève sur des longueurs différentes : sans le test de
    // longueur, la route rendrait 500 au lieu de 401 — et un 500 sur un endpoint
    // public se lit comme une panne, pas comme un rejet.
    const header = `ts=${MAINTENANT};s=abc;s-algorithm=HmacSHA256`;
    expect(() => verifierSignatureZeptomail(CORPS, header, CLE, MAINTENANT)).not.toThrow();
    expect(verifierSignatureZeptomail(CORPS, header, CLE, MAINTENANT).ok).toBe(false);
  });

  it("accepte un corps percent-encodé, comme la doc le prévoit", () => {
    // La documentation ZeptoMail prescrit de décoder le corps avant de
    // recalculer le condensat. Selon la façon dont l'agent poste, il arrive
    // tantôt tel quel, tantôt encodé — n'en essayer qu'une refuserait tout.
    const corpsClair = '{"event_name":"hardbounce","raison":"boîte pleine"}';
    const corpsEncode = encodeURIComponent(corpsClair);
    const header = `ts=${MAINTENANT};s=${signer(corpsClair)};s-algorithm=HmacSHA256`;
    expect(verifierSignatureZeptomail(corpsEncode, header, CLE, MAINTENANT)).toEqual({ ok: true });
  });

  it("un corps avec un `%` isolé ne fait pas lever la vérification", () => {
    // `decodeURIComponent` lève sur `%` non suivi de deux hexadécimaux. Ce n'est
    // pas une signature invalide, c'est une forme indécodable : on refuse
    // proprement.
    const corps = '{"note":"remise 50% sur la formation"}';
    const header = `ts=${MAINTENANT};s=${signer("autre chose")};s-algorithm=HmacSHA256`;
    expect(() => verifierSignatureZeptomail(corps, header, CLE, MAINTENANT)).not.toThrow();
    expect(verifierSignatureZeptomail(corps, header, CLE, MAINTENANT).ok).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 La signature telle que le FOURNISSEUR l'émet — percent-encodée.
//
// Les tests ci-dessus fabriquent la signature avec `signer()`, donc toujours
// sous forme NUE. Ils vérifiaient la forme qu'ils produisaient eux-mêmes : la
// garde et la chose gardée partageaient la forme de la signature.
//
// Or la documentation ZeptoMail donne l'en-tête ainsi — noter le `%3D` final :
//
//     ts=1596109465823;s=dN0yVozgabP5NPlxMDfP1r5u65bVO9kTGEZMIQlqI2o%3D;s-algorithm=HmacSHA256
//
// Sans décodage, `Buffer.from("…I2o%3D", "base64")` rend 33 octets au lieu de
// 32 : le décodeur de Node ignore le `%` mais garde le `D`. `base64Equals`
// compare des longueurs différentes et rend `false`. **Toute livraison réelle
// aurait été refusée en `mismatch`, quelle que soit la clé.**
//
// 🔑 Le défaut était invisible parce que le webhook n'a reçu AUCUN appel
// réel depuis sa création le 2026-08-20 (`dernier appel webhook : JAMAIS`,
// constaté sur deux lignes horaires consécutives le 2026-09-01). Le seul juge
// qui aurait tranché — une livraison véritable — n'est jamais venu.
// ─────────────────────────────────────────────────────────────────────────────

describe("signature percent-encodée — la forme réellement émise", () => {
  /** Encode le bourrage base64 comme le fait ZeptoMail dans sa documentation. */
  function enteteEncodee(corps: string, opts: { cle?: string } = {}): string {
    const brut = signer(corps, opts.cle ?? CLE);
    return `ts=${MAINTENANT};s=${brut.replace(/=/g, "%3D")};s-algorithm=HmacSHA256`;
  }

  it("🔴 accepte une signature dont le bourrage est percent-encodé", () => {
    const entete = enteteEncodee(CORPS);
    expect(entete, "le test doit bien produire un %3D, sinon il ne mesure rien").toContain("%3D");
    expect(
      verifierSignatureZeptomail(CORPS, entete, CLE, MAINTENANT),
      "Une signature percent-encodée est refusée. C'est la forme que la " +
        "documentation ZeptoMail montre, donc TOUTE livraison réelle serait " +
        "rejetée en `mismatch`. Vérifier `decodeSignature()` dans " +
        "`zeptomail-webhook-signature.ts`.",
    ).toEqual({ ok: true });
  });

  it("🔴 une MAUVAISE clé reste refusée, même percent-encodée", () => {
    // Le décodage ne doit pas être une porte dérobée : il canonicalise une
    // forme, il ne dispense pas de connaître le secret.
    expect(
      verifierSignatureZeptomail(
        CORPS,
        enteteEncodee(CORPS, { cle: "autre-cle" }),
        CLE,
        MAINTENANT,
      ),
    ).toEqual({ ok: false, reason: "mismatch" });
  });

  it("les deux formes rendent le MÊME verdict — nue et encodée", () => {
    const nue = verifierSignatureZeptomail(CORPS, entete(CORPS), CLE, MAINTENANT);
    const encodee = verifierSignatureZeptomail(CORPS, enteteEncodee(CORPS), CLE, MAINTENANT);
    expect(encodee).toEqual(nue);
  });

  it("une valeur avec un `%` isolé ne fait pas lever — elle est simplement refusée", () => {
    const verdict = verifierSignatureZeptomail(
      CORPS,
      `ts=${MAINTENANT};s=abc%zz;s-algorithm=HmacSHA256`,
      CLE,
      MAINTENANT,
    );
    expect(verdict.ok).toBe(false);
  });
});
