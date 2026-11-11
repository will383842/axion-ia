// Jeton d'opposition — partie PURE du lot 1b (2026-09-02).
//
// Ce fichier n'importe ni Prisma, ni le CRM, ni les files : il est importé par
// le registre des gabarits (`templates/index.tsx`) et par le worker. Une
// première version l'avait laissé dans `opposition.ts`, avec le registre en
// base et la synchronisation CRM — et le rendu d'un e-mail tirait alors les
// files BullMQ et `next-auth` : neuf suites de gabarits tombaient à la
// collecte. Le jeton n'a besoin que de `node:crypto`.
//
// Deux formats, LUS TOUS LES DEUX À VIE :
//
//   - `op1.<adresse en base64url>.<HMAC-SHA256 tronqué>` — l'adresse y est en
//     clair (base64url n'est pas un chiffrement). Plus émis dès que
//     `OPPOSITION_JETON_V2` est allumé, mais les e-mails déjà partis le portent.
//   - `op2.<kid>.<base64url(iv[12] ‖ chiffré ‖ tag[16])>` — OPAQUE : AES-256-GCM
//     déterministe (IV synthétique = HMAC de l'adresse), sans table. Clés dérivées
//     d'`OPPOSITION_JETON_SECRET` (secret dédié, séparation de domaine par `kid`).
//
// 🔴 NE JAMAIS RETIRER LA LECTURE `op1` NI `op2`. Les liens n'ont pas de date de
// fin : un e-mail de 2026 ouvert en 2040 doit encore permettre de dire « stop ».
// Retirer ce code, c'est rendre des « stop » impossibles. Une rotation de secret
// AJOUTE un `kid` (et `OPPOSITION_JETON_SECRET_<KID>`, conservé à vie) ; elle ne
// remplace rien.
//
// Le préfixe permet à `/api/unsubscribe` de les distinguer d'un jeton newsletter
// (chaîne opaque en base). Jamais journalisé : ni jeton, ni adresse.

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  timingSafeEqual,
} from "node:crypto";

export const PREFIXE_JETON_OPPOSITION = "op1";
export const PREFIXE_JETON_OPPOSITION_V2 = "op2";
/** Identifiant de la clé utilisée à l'ÉMISSION. Une rotation en ajoute un autre. */
const KID_COURANT = "k1";
const LONGUEUR_MAX_JETON = 512;
const LONGUEUR_IV = 12;
const LONGUEUR_TAG = 16;
const SECRET_MIN = 32;
const LONGUEUR_SIGNATURE = 32;

let avertiSansSecret = false;
let avertiOp2IllisibleSansSecret = false;

function cleSignature(): Buffer {
  const secret = process.env["AUTH_SECRET"];
  if (!secret) {
    // `env.ts` exige AUTH_SECRET en production : on n'arrive ici qu'en dev ou
    // en test. On le dit une fois, et on signe avec une clé de développement
    // pour que le lien existe quand même dans Mailhog.
    if (!avertiSansSecret) {
      avertiSansSecret = true;
      console.warn(
        "[email-opposition] AUTH_SECRET absent : jetons d'opposition signés avec la clé de développement.",
      );
    }
    return createHash("sha256").update("axion-email-opposition|dev").digest();
  }
  return createHash("sha256").update(`axion-email-opposition|${secret}`).digest();
}

/** Adresse telle qu'elle est signée et stockée : sans espaces, en minuscules. */
export function normaliserAdresse(email: string): string {
  return email.trim().toLowerCase();
}

function signer(adresse: string): string {
  return createHmac("sha256", cleSignature())
    .update(adresse)
    .digest("base64url")
    .slice(0, LONGUEUR_SIGNATURE);
}

/** Jeton `op1` pour une adresse. Stable : même adresse, même jeton. */
function jetonOppositionOp1(email: string): string {
  const adresse = normaliserAdresse(email);
  const corps = Buffer.from(adresse, "utf8").toString("base64url");
  return `${PREFIXE_JETON_OPPOSITION}.${corps}.${signer(adresse)}`;
}

/** Secret dédié d'un `kid`, ou null s'il est absent / trop court. `k1` = `OPPOSITION_JETON_SECRET`. */
function secretOp2(kid: string): string | null {
  const nom =
    kid === "k1" ? "OPPOSITION_JETON_SECRET" : `OPPOSITION_JETON_SECRET_${kid.toUpperCase()}`;
  const secret = process.env[nom];
  return typeof secret === "string" && secret.length >= SECRET_MIN ? secret : null;
}

function clesOp2(kid: string): { enc: Buffer; iv: Buffer } | null {
  const secret = secretOp2(kid);
  if (secret === null) return null;
  return {
    enc: createHash("sha256").update(`axion-opposition-op2-enc|${kid}|${secret}`).digest(),
    iv: createHash("sha256").update(`axion-opposition-op2-iv|${kid}|${secret}`).digest(),
  };
}

function ivSynthetique(cleIv: Buffer, adresse: string): Buffer {
  return createHmac("sha256", cleIv).update(adresse).digest().subarray(0, LONGUEUR_IV);
}

/**
 * Jeton `op2` OPAQUE pour une adresse, ou null si le secret dédié est absent ou
 * trop court (l'appelant se replie alors sur `op1` : jamais « pas de lien »).
 * Stable : même adresse, même jeton.
 */
export function jetonOppositionOp2(email: string): string | null {
  const cles = clesOp2(KID_COURANT);
  if (cles === null) return null;
  const adresse = normaliserAdresse(email);
  const iv = ivSynthetique(cles.iv, adresse);
  const chiffre = createCipheriv("aes-256-gcm", cles.enc, iv);
  chiffre.setAAD(Buffer.from(`op2|${KID_COURANT}`));
  const corps = Buffer.concat([chiffre.update(adresse, "utf8"), chiffre.final()]);
  const paquet = Buffer.concat([iv, corps, chiffre.getAuthTag()]);
  return `${PREFIXE_JETON_OPPOSITION_V2}.${KID_COURANT}.${paquet.toString("base64url")}`;
}

function lireOp2(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIXE_JETON_OPPOSITION_V2) return null;
  const [, kid, corps] = parts as [string, string, string];
  if (!/^[a-z0-9]{1,4}$/.test(kid)) return null;
  const cles = clesOp2(kid);
  if (cles === null) {
    // Un « stop » bien formé mais illisible faute de secret sur CE conteneur : la personne
    // arriverait sur « lien expiré » sans qu'on le sache. On le dit une fois par processus,
    // sans aucune valeur (ni jeton, ni adresse) : le `kid` au plus.
    if (!avertiOp2IllisibleSansSecret) {
      avertiOp2IllisibleSansSecret = true;
      console.error(JSON.stringify({ event: "opposition_jeton_op2_illisible_sans_secret", kid }));
    }
    return null;
  }
  const paquet = Buffer.from(corps, "base64url");
  if (paquet.length <= LONGUEUR_IV + LONGUEUR_TAG) return null;
  const iv = paquet.subarray(0, LONGUEUR_IV);
  const tag = paquet.subarray(paquet.length - LONGUEUR_TAG);
  const chiffre = paquet.subarray(LONGUEUR_IV, paquet.length - LONGUEUR_TAG);
  let adresse: string;
  try {
    const d = createDecipheriv("aes-256-gcm", cles.enc, iv);
    d.setAAD(Buffer.from(`op2|${kid}`));
    d.setAuthTag(tag);
    adresse = Buffer.concat([d.update(chiffre), d.final()]).toString("utf8");
  } catch {
    return null;
  }
  if (adresse === "" || !adresse.includes("@") || normaliserAdresse(adresse) !== adresse)
    return null;
  // IV « synthétique » : l'IV doit être celui de CETTE adresse, sinon le jeton a été
  // fabriqué avec un IV arbitraire.
  const attendu = ivSynthetique(cles.iv, adresse);
  if (attendu.length !== iv.length || !timingSafeEqual(attendu, iv)) return null;
  return adresse;
}

let avertiRepliOp1 = false;

/** Une seule fois par processus, SANS valeur : ni jeton, ni adresse, ni secret. */
function avertirRepliOp1(): void {
  if (avertiRepliOp1) return;
  avertiRepliOp1 = true;
  console.warn(JSON.stringify({ event: "opposition_jeton_repli_op1" }));
  // Import dynamique : ce module reste PUR (importé par le registre des gabarits).
  void import("@sentry/nextjs")
    .then((Sentry) =>
      Sentry.captureMessage(
        "opposition_jeton_repli_op1 : OPPOSITION_JETON_SECRET absent",
        "warning",
      ),
    )
    .catch(() => {});
}

/**
 * Jeton d'opposition pour une adresse — le SEUL point d'émission du dépôt (garde :
 * `tests/unit/email/plus-aucun-op1-emis.spec.ts`).
 *
 * `OPPOSITION_JETON_V2` (exactement « true », lu à l'exécution, éteint par défaut, app ET
 * worker) émet l'`op2` opaque. Éteint, ou secret absent : `op1` — jamais « pas de lien ».
 * ORDRE D'ALLUMAGE (fenêtre app↔worker, AGENTS.md) : la lecture `op2` doit être en ligne
 * côté APP avant d'allumer, sinon un clic de la fenêtre échoue (un « stop » perdu).
 */
export function jetonOpposition(email: string): string {
  if (process.env["OPPOSITION_JETON_V2"] === "true") {
    const op2 = jetonOppositionOp2(email);
    if (op2 !== null) return op2;
    avertirRepliOp1();
  }
  return jetonOppositionOp1(email);
}

export function estJetonOpposition(token: string | null | undefined): boolean {
  return (
    typeof token === "string" &&
    (token.startsWith(`${PREFIXE_JETON_OPPOSITION}.`) ||
      token.startsWith(`${PREFIXE_JETON_OPPOSITION_V2}.`))
  );
}

/** Adresse portée par un jeton (`op1` ou `op2`), ou null s'il ne tient pas. */
export function lireJetonOpposition(token: string): string | null {
  if (token.length > LONGUEUR_MAX_JETON) return null;
  if (token.startsWith(`${PREFIXE_JETON_OPPOSITION_V2}.`)) return lireOp2(token);
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIXE_JETON_OPPOSITION) return null;
  const [, corps, signature] = parts as [string, string, string];
  let adresse: string;
  try {
    adresse = Buffer.from(corps, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (adresse === "" || !adresse.includes("@") || normaliserAdresse(adresse) !== adresse)
    return null;
  const attendue = signer(adresse);
  const a = Buffer.from(attendue, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return adresse;
}

/** URL absolue du lien « Ne plus recevoir de sollicitations » pour une adresse. */
export function urlOpposition(email: string): string {
  const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com";
  return `${siteUrl}/api/unsubscribe?token=${encodeURIComponent(jetonOpposition(email))}`;
}
