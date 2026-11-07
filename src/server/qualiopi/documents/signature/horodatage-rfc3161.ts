/**
 * Horodatage certifié RFC 3161 — client minimal, SANS dépendance (lot 4 bis).
 *
 * ## Ce qui part chez l'autorité, et ce qui n'y part pas
 *
 * UNE empreinte SHA-256 (le `selfHash` de la signature) et un nonce. Aucun nom, aucune adresse,
 * aucun montant, aucun document : l'autorité ne peut rien apprendre du devis. Elle répond par un
 * jeton signé qui atteste que cette empreinte existait à l'instant `genTime`.
 *
 * ## Ce que ce module vérifie, et ce qu'il laisse à l'audit
 *
 * Vérifié ICI, à la réception : statut accordé (0 ou 1), empreinte du jeton = la nôtre, nonce =
 * le nôtre, `genTime` plausible (±15 min de l'horloge du serveur). La réponse brute (TimeStampResp
 * en DER) est ensuite conservée telle quelle : la signature CMS de l'autorité et sa chaîne de
 * certificats se vérifient hors ligne, par n'importe quel outil standard —
 *   `openssl ts -verify -in jeton.tsr -digest <selfHash> -CAfile <ca.pem>`
 * Ce module ne prétend PAS valider la signature de l'autorité : il refuse seulement un jeton qui
 * ne porte manifestement pas sur notre empreinte.
 *
 * Aucune horloge ni E/S cachée : le `fetch` et l'instant sont des paramètres.
 */

import { randomBytes } from "node:crypto";

/**
 * Autorité gratuite par défaut (Certum, Pologne — UE) ; surchargeable par `HORODATAGE_TSA_URL`.
 * ⚠️ Changer ce défaut, c'est changer l'entrée « autorité d'horodatage » de `content/subprocessors.ts`
 * (localisation, nom) dans la même PR. Service en http : seule une empreinte SHA-256 y transite.
 */
export const TSA_URL_PAR_DEFAUT = "http://time.certum.pl";
export const HORODATAGE_TIMEOUT_MS = 8_000;
const TOLERANCE_HORLOGE_MS = 15 * 60 * 1000;
const TAILLE_MAX_REPONSE = 64 * 1024;

/** OID id-sha256 (2.16.840.1.101.3.4.2.1), déjà encodé. */
const OID_SHA256 = Buffer.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]);

export class ErreurHorodatage extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurHorodatage";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface ConfigurationTsa {
  /** `null` : l'horodatage est coupé (signature possible, jeton jamais demandé). */
  readonly url: string | null;
}

/**
 * `HORODATAGE_TSA_URL` choisit l'autorité ; `HORODATAGE_DESACTIVE=true` coupe la demande de jeton
 * (les lignes restent « en attente » et reprennent dès la réactivation). Une URL qui n'est pas
 * http(s) est ignorée avec repli sur l'autorité par défaut : jamais de schéma exotique (file://…).
 */
export function configurationTsa(
  env: Readonly<Record<string, string | undefined>>,
): ConfigurationTsa {
  if (env["HORODATAGE_DESACTIVE"] === "true") return { url: null };
  const brut = (env["HORODATAGE_TSA_URL"] ?? "").trim();
  if (brut === "") return { url: TSA_URL_PAR_DEFAUT };
  try {
    const u = new URL(brut);
    if (u.protocol === "https:" || u.protocol === "http:") return { url: u.toString() };
  } catch {
    // retombe sur le défaut
  }
  return { url: TSA_URL_PAR_DEFAUT };
}

// ─────────────────────────────────────────────────────────────────────────────
// DER minimal
// ─────────────────────────────────────────────────────────────────────────────

function longueurDer(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n]);
  if (n < 0x100) return Buffer.from([0x81, n]);
  return Buffer.from([0x82, (n >> 8) & 0xff, n & 0xff]);
}

function tlv(tag: number, contenu: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), longueurDer(contenu.length), contenu]);
}

/** Entier DER positif : un octet de tête à 0 si le bit de poids fort est posé. */
function entierPositif(octets: Buffer): Buffer {
  let debut = 0;
  while (debut < octets.length - 1 && octets[debut] === 0) debut++;
  const utile = octets.subarray(debut);
  const contenu = (utile[0] ?? 0) & 0x80 ? Buffer.concat([Buffer.from([0]), utile]) : utile;
  return tlv(0x02, contenu);
}

/** TimeStampReq (RFC 3161 §2.4.1) : version 1, empreinte SHA-256, nonce, certReq TRUE. */
export function construireRequete(empreinteHex: string, nonce: Buffer): Buffer {
  if (!/^[0-9a-f]{64}$/.test(empreinteHex)) throw new ErreurHorodatage("empreinte invalide");
  if (nonce.length === 0 || nonce.length > 8) throw new ErreurHorodatage("nonce invalide");
  const algo = tlv(0x30, Buffer.concat([OID_SHA256, Buffer.from([0x05, 0x00])]));
  const imprint = tlv(0x30, Buffer.concat([algo, tlv(0x04, Buffer.from(empreinteHex, "hex"))]));
  return tlv(
    0x30,
    Buffer.concat([
      Buffer.from([0x02, 0x01, 0x01]),
      imprint,
      entierPositif(nonce),
      Buffer.from([0x01, 0x01, 0xff]),
    ]),
  );
}

interface Noeud {
  readonly tag: number;
  readonly contenu: Buffer;
}

/** Lit les TLV consécutifs d'un tampon. Lève sur toute forme non DER définie. */
function enfants(tampon: Buffer): Noeud[] {
  const out: Noeud[] = [];
  let i = 0;
  while (i < tampon.length) {
    const tag = tampon[i++];
    if (tag === undefined || (tag & 0x1f) === 0x1f)
      throw new ErreurHorodatage("étiquette DER non gérée");
    const l0 = tampon[i++];
    if (l0 === undefined) throw new ErreurHorodatage("DER tronqué");
    let longueur = l0;
    if (l0 & 0x80) {
      const n = l0 & 0x7f;
      if (n === 0 || n > 3) throw new ErreurHorodatage("longueur DER non gérée");
      longueur = 0;
      for (let k = 0; k < n; k++) {
        const b = tampon[i++];
        if (b === undefined) throw new ErreurHorodatage("DER tronqué");
        longueur = (longueur << 8) | b;
      }
    }
    if (i + longueur > tampon.length) throw new ErreurHorodatage("DER tronqué");
    out.push({ tag, contenu: tampon.subarray(i, i + longueur) });
    i += longueur;
  }
  return out;
}

function exiger(n: Noeud | undefined, tag: number, quoi: string): Noeud {
  if (n === undefined || n.tag !== tag) throw new ErreurHorodatage(`réponse illisible : ${quoi}`);
  return n;
}

function entierDe(n: Noeud): bigint {
  return n.contenu.length === 0 ? 0n : BigInt(`0x${n.contenu.toString("hex")}`);
}

/** GeneralizedTime « AAAAMMJJHHMMSS[.fff]Z » → Date. */
export function lireGeneralizedTime(texte: string): Date {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.(\d{1,3})\d*)?Z$/.exec(texte);
  if (!m) throw new ErreurHorodatage("genTime illisible");
  const ms = m[7] === undefined ? 0 : Number(m[7].padEnd(3, "0"));
  const d = new Date(
    Date.UTC(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6]),
      ms,
    ),
  );
  if (Number.isNaN(d.getTime())) throw new ErreurHorodatage("genTime illisible");
  return d;
}

export interface JetonLu {
  /** Instant attesté par l'autorité. */
  readonly genTime: Date;
}

/**
 * Lit et contrôle une TimeStampResp. Lève `ErreurHorodatage` pour toute réponse qui n'est pas un
 * jeton accordé portant sur NOTRE empreinte et NOTRE nonce.
 */
export function lireReponse(
  reponse: Buffer,
  empreinteHex: string,
  nonce: Buffer,
  maintenant: Date,
): JetonLu {
  if (reponse.length === 0 || reponse.length > TAILLE_MAX_REPONSE) {
    throw new ErreurHorodatage("taille de réponse inattendue");
  }
  const [racine] = enfants(reponse);
  const resp = exiger(racine, 0x30, "TimeStampResp");
  const [statutInfo, contentInfo] = enfants(resp.contenu);
  const statut = enfants(exiger(statutInfo, 0x30, "PKIStatusInfo").contenu)[0];
  const code = entierDe(exiger(statut, 0x02, "status"));
  if (code !== 0n && code !== 1n)
    throw new ErreurHorodatage(`jeton refusé par l'autorité (statut ${code})`);

  // ContentInfo → [0] → SignedData → encapContentInfo → [0] → OCTET STRING = TSTInfo.
  const ci = enfants(exiger(contentInfo, 0x30, "timeStampToken").contenu);
  const signedData = enfants(exiger(ci[1], 0xa0, "content").contenu)[0];
  const sd = enfants(exiger(signedData, 0x30, "SignedData").contenu);
  const encap = enfants(exiger(sd[2], 0x30, "encapContentInfo").contenu);
  const octets = enfants(exiger(encap[1], 0xa0, "eContent").contenu)[0];
  const tst = enfants(exiger(octets, 0x04, "TSTInfo (octets)").contenu)[0];
  const champs = enfants(exiger(tst, 0x30, "TSTInfo").contenu);

  // version, policy, messageImprint, serialNumber, genTime, [accuracy], [ordering], [nonce] …
  const imprint = enfants(exiger(champs[2], 0x30, "messageImprint").contenu);
  const algo = enfants(exiger(imprint[0], 0x30, "algorithme").contenu)[0];
  if (!exiger(algo, 0x06, "oid").contenu.equals(OID_SHA256.subarray(2))) {
    throw new ErreurHorodatage("algorithme d'empreinte inattendu");
  }
  const haché = exiger(imprint[1], 0x04, "empreinte").contenu;
  if (!haché.equals(Buffer.from(empreinteHex, "hex"))) {
    throw new ErreurHorodatage("le jeton ne porte pas sur notre empreinte");
  }
  const genTime = lireGeneralizedTime(exiger(champs[4], 0x18, "genTime").contenu.toString("ascii"));
  if (Math.abs(genTime.getTime() - maintenant.getTime()) > TOLERANCE_HORLOGE_MS) {
    throw new ErreurHorodatage("instant du jeton hors tolérance");
  }
  const nonceRecu = champs.slice(5).find((c) => c.tag === 0x02);
  if (nonceRecu === undefined) throw new ErreurHorodatage("nonce absent du jeton");
  if (entierDe(nonceRecu) !== BigInt(`0x${nonce.toString("hex")}`)) {
    throw new ErreurHorodatage("nonce différent de celui demandé");
  }
  return { genTime };
}

// ─────────────────────────────────────────────────────────────────────────────
// Demande
// ─────────────────────────────────────────────────────────────────────────────

export interface JetonObtenu {
  /** Réponse brute (TimeStampResp, DER), conservée telle quelle. */
  readonly jeton: Buffer;
  readonly genTime: Date;
  readonly autorite: string;
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Demande un jeton pour une empreinte. LÈVE (`ErreurHorodatage`) sur toute indisponibilité :
 * c'est l'appelant qui décide de réessayer — la signature, elle, n'en dépend jamais.
 */
export async function demanderJeton(input: {
  readonly empreinteHex: string;
  readonly url: string;
  readonly maintenant: Date;
  readonly fetcher?: Fetcher;
  readonly nonce?: Buffer;
}): Promise<JetonObtenu> {
  const nonce = input.nonce ?? randomBytes(8);
  const corps = construireRequete(input.empreinteHex, nonce);
  const fetcher: Fetcher = input.fetcher ?? ((u, i) => fetch(u, i));
  let res: Response;
  try {
    res = await fetcher(input.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/timestamp-query",
        Accept: "application/timestamp-reply",
      },
      body: new Uint8Array(corps),
      redirect: "error",
      signal: AbortSignal.timeout(HORODATAGE_TIMEOUT_MS),
    });
  } catch {
    // Pas de détail réseau dans l'erreur : elle est journalisée et stockée.
    throw new ErreurHorodatage("autorité injoignable");
  }
  if (!res.ok) throw new ErreurHorodatage(`autorité : HTTP ${res.status}`);
  const brut = Buffer.from(await res.arrayBuffer());
  const { genTime } = lireReponse(brut, input.empreinteHex, nonce, input.maintenant);
  return { jeton: brut, genTime, autorite: input.url.slice(0, 300) };
}
