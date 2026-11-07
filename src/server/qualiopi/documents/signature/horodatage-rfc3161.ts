/**
 * Horodatage certifié RFC 3161 — client minimal, SANS dépendance (lot 4 bis).
 *
 * ## Ce qui part chez l'autorité, et ce qui n'y part pas
 *
 * UNE empreinte SHA-256 (le `selfHash` de la signature) et un nonce. Aucun nom, aucune adresse,
 * aucun montant, aucun document : l'autorité ne peut rien apprendre du devis. Elle répond par un
 * jeton signé qui atteste que cette empreinte existait à l'instant `genTime`.
 *
 * ## Ce que ce module vérifie
 *
 * À la réception, dans cet ordre : statut accordé (0 ou 1), empreinte du jeton = la nôtre, nonce =
 * le nôtre, `genTime` plausible (±15 min de l'horloge du serveur) — puis, et c'est ce qui fait
 * d'un octet-stream un JETON : la signature CMS de l'autorité (attribut `messageDigest` = condensat
 * du TSTInfo, signature des attributs signés), l'usage étendu `timeStamping` du certificat
 * signataire, et la chaîne de certificats jusqu'à une ANCRE DE CONFIANCE fournie par l'exploitant
 * (`HORODATAGE_TSA_CA_PEM`), chaque certificat étant valide à l'instant attesté. `node:crypto`
 * seul. Sans ancre, rien n'est accepté : un jeton qu'on ne sait pas vérifier n'est pas « obtenu ».
 * Pas de contrôle de révocation (CRL/OCSP) : à l'audit, hors ligne —
 *   `openssl ts -verify -in jeton.tsr -digest <selfHash> -CAfile <ca.pem>`
 *
 * La réponse de l'autorité est lue EN FLUX avec un plafond (`TAILLE_MAX_REPONSE`) : une autorité
 * malveillante ou défaillante ne peut pas nous faire charger un corps sans fin en mémoire.
 *
 * Aucune horloge ni E/S cachée : le `fetch` et l'instant sont des paramètres.
 */

import { createHash, randomBytes, verify as verifierSignature, X509Certificate } from "node:crypto";

export const HORODATAGE_TIMEOUT_MS = 8_000;
const TOLERANCE_HORLOGE_MS = 15 * 60 * 1000;
export const TAILLE_MAX_REPONSE = 64 * 1024;

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
  /** Certificats (PEM) de confiance contre lesquels la chaîne du jeton doit se fermer. */
  readonly ancresPem: readonly string[];
}

const PEM_CERTIFICAT = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;

/**
 * `HORODATAGE_TSA_URL` choisit l'autorité — AUCUNE par défaut : une autorité n'est jamais nommée
 * par le code (c'est un sous-traitant, il se déclare). `HORODATAGE_TSA_CA_PEM` porte la ou les
 * ancres de confiance (PEM, retours à la ligne éventuellement écrits « \n »).
 *
 * Coupé (`url: null`, lignes « en attente ») tant que : l'URL n'est pas posée ; ou elle n'est pas
 * https en production ; ou son schéma est exotique ; ou aucune ancre n'est configurée (un jeton ne
 * pourrait pas être vérifié, donc ne vaudrait rien) ; ou `HORODATAGE_DESACTIVE=true`.
 */
export function configurationTsa(
  env: Readonly<Record<string, string | undefined>>,
): ConfigurationTsa {
  const coupe: ConfigurationTsa = { url: null, ancresPem: [] };
  if (env["HORODATAGE_DESACTIVE"] === "true") return coupe;
  const brut = (env["HORODATAGE_TSA_URL"] ?? "").trim();
  if (brut === "") return coupe;
  const ancresPem =
    (env["HORODATAGE_TSA_CA_PEM"] ?? "").replace(/\\n/g, "\n").match(PEM_CERTIFICAT) ?? [];
  if (ancresPem.length === 0) return coupe;
  try {
    const u = new URL(brut);
    const production = env["NODE_ENV"] === "production";
    if (u.protocol === "https:" || (u.protocol === "http:" && !production)) {
      return { url: u.toString(), ancresPem };
    }
  } catch {
    // URL illisible : coupé
  }
  return coupe;
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
  /** Le TLV complet (en-tête compris) : les attributs signés se vérifient sur cet encodage. */
  readonly brut: Buffer;
}

/** Lit les TLV consécutifs d'un tampon. Lève sur toute forme non DER définie. */
function enfants(tampon: Buffer): Noeud[] {
  const out: Noeud[] = [];
  let i = 0;
  while (i < tampon.length) {
    const debut = i;
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
    out.push({
      tag,
      contenu: tampon.subarray(i, i + longueur),
      brut: tampon.subarray(debut, i + longueur),
    });
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

const ERR_TAILLE = "taille de réponse inattendue";

/** Lit le corps EN FLUX et s'arrête dès que le plafond est franchi : jamais de corps sans fin. */
async function lireCorpsPlafonne(res: Response): Promise<Buffer> {
  const annonce = Number(res.headers.get("content-length"));
  if (Number.isFinite(annonce) && annonce > TAILLE_MAX_REPONSE) {
    await res.body?.cancel().catch(() => undefined);
    throw new ErreurHorodatage(ERR_TAILLE);
  }
  if (res.body === null) throw new ErreurHorodatage(ERR_TAILLE);
  const lecteur = res.body.getReader();
  const morceaux: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      total += value.byteLength;
      if (total > TAILLE_MAX_REPONSE) {
        await lecteur.cancel().catch(() => undefined);
        throw new ErreurHorodatage(ERR_TAILLE);
      }
      morceaux.push(Buffer.from(value));
    }
  } catch (err) {
    if (err instanceof ErreurHorodatage) throw err;
    throw new ErreurHorodatage("autorité injoignable");
  }
  return Buffer.concat(morceaux);
}

/**
 * Demande un jeton pour une empreinte. LÈVE (`ErreurHorodatage`) sur toute indisponibilité, toute
 * réponse illisible et tout jeton dont la signature ou la chaîne ne se vérifie pas : c'est
 * l'appelant qui décide de réessayer — la signature, elle, n'en dépend jamais.
 */
export async function demanderJeton(input: {
  readonly empreinteHex: string;
  readonly url: string;
  readonly maintenant: Date;
  readonly ancresPem: readonly string[];
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
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw new ErreurHorodatage(`autorité : HTTP ${res.status}`);
  }
  const brut = await lireCorpsPlafonne(res);
  const { genTime } = lireReponse(brut, input.empreinteHex, nonce, input.maintenant);
  verifierJeton(brut, input.ancresPem, genTime);
  return { jeton: brut, genTime, autorite: input.url.slice(0, 300) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Signature CMS, usage étendu, chaîne de confiance
// ─────────────────────────────────────────────────────────────────────────────

const OID_EKU_TIMESTAMPING = "1.3.6.1.5.5.7.3.8";
const OID_CT_TSTINFO = "1.2.840.113549.1.9.16.1.4";
const OID_ATTR_CONTENT_TYPE = "1.2.840.113549.1.9.3";
const OID_ATTR_MESSAGE_DIGEST = "1.2.840.113549.1.9.4";
/** Condensats acceptés pour la signature de l'autorité (SHA-1 volontairement absent). */
const CONDENSATS: Readonly<Record<string, string>> = {
  "2.16.840.1.101.3.4.2.1": "sha256",
  "2.16.840.1.101.3.4.2.2": "sha384",
  "2.16.840.1.101.3.4.2.3": "sha512",
};
/** rsaEncryption, sha{256,384,512}WithRSAEncryption, ecPublicKey, ecdsa-with-SHA{256,384,512}. */
const SIGNATURES_ADMISES = new Set([
  "1.2.840.113549.1.1.1",
  "1.2.840.113549.1.1.11",
  "1.2.840.113549.1.1.12",
  "1.2.840.113549.1.1.13",
  "1.2.840.10045.2.1",
  "1.2.840.10045.4.3.2",
  "1.2.840.10045.4.3.3",
  "1.2.840.10045.4.3.4",
]);
const PROFONDEUR_CHAINE_MAX = 6;

function oidTexte(n: Noeud): string {
  const o = exiger(n, 0x06, "oid").contenu;
  if (o.length === 0) throw new ErreurHorodatage("réponse illisible : oid");
  const arcs: number[] = [];
  let valeur = 0;
  for (let k = 0; k < o.length; k++) {
    valeur = valeur * 128 + (o[k]! & 0x7f);
    if (!(o[k]! & 0x80)) {
      arcs.push(valeur);
      valeur = 0;
    }
  }
  const premier = arcs[0] ?? 0;
  const tete = premier < 80 ? [Math.floor(premier / 40), premier % 40] : [2, premier - 80];
  return [...tete, ...arcs.slice(1)].join(".");
}

function lireCertificat(source: string | Buffer, quoi: string): X509Certificate {
  try {
    return new X509Certificate(source);
  } catch {
    throw new ErreurHorodatage(`certificat illisible : ${quoi}`);
  }
}

/** Le certificat porte-t-il l'usage étendu `id-kp-timeStamping` ? */
export function usageHorodatagePermis(cert: X509Certificate): boolean {
  return (cert.keyUsage ?? []).includes(OID_EKU_TIMESTAMPING);
}

function valideA(cert: X509Certificate, instant: Date): boolean {
  const t = instant.getTime();
  return Date.parse(cert.validFrom) <= t && t <= Date.parse(cert.validTo);
}

/**
 * Vérifie la signature CMS d'un jeton et sa chaîne. LÈVE `ErreurHorodatage` au moindre défaut.
 * `instant` est le `genTime` attesté : les certificats doivent être valides ALORS, pas aujourd'hui
 * (un jeton reste vérifiable après l'expiration du certificat de l'autorité).
 */
export function verifierJeton(reponse: Buffer, ancresPem: readonly string[], instant: Date): void {
  if (ancresPem.length === 0) throw new ErreurHorodatage("aucune ancre de confiance configurée");
  const ancres = ancresPem.map((p) => lireCertificat(p, "ancre"));

  const [racine] = enfants(reponse);
  const resp = exiger(racine, 0x30, "TimeStampResp");
  const contentInfo = exiger(enfants(resp.contenu)[1], 0x30, "timeStampToken");
  const ci = enfants(contentInfo.contenu);
  const signedData = enfants(exiger(ci[1], 0xa0, "content").contenu)[0];
  const sd = enfants(exiger(signedData, 0x30, "SignedData").contenu);
  const encap = enfants(exiger(sd[2], 0x30, "encapContentInfo").contenu);
  if (oidTexte(exiger(encap[0], 0x06, "eContentType")) !== OID_CT_TSTINFO) {
    throw new ErreurHorodatage("contenu signé inattendu");
  }
  const tstInfoOctets = enfants(exiger(encap[1], 0xa0, "eContent").contenu)[0];
  const tstInfo = exiger(tstInfoOctets, 0x04, "TSTInfo (octets)").contenu;

  const certsNoeud = sd.find((n) => n.tag === 0xa0);
  const signerInfos = sd[sd.length - 1];
  const certificats = enfants(exiger(certsNoeud, 0xa0, "certificats").contenu).map((n) =>
    lireCertificat(n.brut, "jeton"),
  );
  const infos = enfants(exiger(signerInfos, 0x31, "signerInfos").contenu);
  if (infos.length !== 1) throw new ErreurHorodatage("signature CMS : un seul signataire attendu");
  const si = enfants(exiger(infos[0], 0x30, "SignerInfo").contenu);

  // si : version, sid, digestAlgorithm, [0] signedAttrs, signatureAlgorithm, signature
  const sid = enfants(exiger(si[1], 0x30, "sid (émetteur + série)").contenu);
  const serie = entierDe(exiger(sid[1], 0x02, "série du signataire"));
  const condensat =
    CONDENSATS[oidTexte(enfants(exiger(si[2], 0x30, "digestAlgorithm").contenu)[0]!)];
  if (condensat === undefined) throw new ErreurHorodatage("signature CMS : condensat non admis");
  const attrs = exiger(si[3], 0xa0, "attributs signés");
  const algoSignature = oidTexte(enfants(exiger(si[4], 0x30, "signatureAlgorithm").contenu)[0]!);
  if (!SIGNATURES_ADMISES.has(algoSignature)) {
    throw new ErreurHorodatage("signature CMS : algorithme non admis");
  }
  const signature = exiger(si[5], 0x04, "signature").contenu;

  // Attributs : contentType = TSTInfo, messageDigest = condensat du TSTInfo.
  let digestAttendu: Buffer | undefined;
  let typeOk = false;
  for (const attr of enfants(attrs.contenu)) {
    const [oid, valeurs] = enfants(exiger(attr, 0x30, "attribut").contenu);
    const nom = oidTexte(exiger(oid, 0x06, "attribut"));
    const valeur = enfants(exiger(valeurs, 0x31, "valeurs").contenu)[0];
    if (nom === OID_ATTR_MESSAGE_DIGEST) digestAttendu = exiger(valeur, 0x04, "digest").contenu;
    if (nom === OID_ATTR_CONTENT_TYPE)
      typeOk = oidTexte(exiger(valeur, 0x06, "type")) === OID_CT_TSTINFO;
  }
  if (!typeOk || digestAttendu === undefined) {
    throw new ErreurHorodatage("signature CMS : attributs signés incomplets");
  }
  const calcule = createHash(condensat).update(tstInfo).digest();
  if (!calcule.equals(digestAttendu)) {
    throw new ErreurHorodatage(
      "signature CMS : le condensat du contenu horodaté ne correspond pas",
    );
  }

  // La signature porte sur les attributs ré-encodés avec l'étiquette SET (0x31), pas [0].
  const asigner = tlv(0x31, attrs.contenu);
  const signataires = certificats.filter((c) => BigInt(`0x${c.serialNumber}`) === serie);
  const signataire = signataires.find((c) => {
    try {
      return verifierSignature(condensat, asigner, c.publicKey, signature);
    } catch {
      return false;
    }
  });
  if (signataire === undefined) {
    throw new ErreurHorodatage("signature CMS invalide ou certificat signataire introuvable");
  }
  if (!usageHorodatagePermis(signataire)) {
    throw new ErreurHorodatage("certificat sans usage d'horodatage (timeStamping)");
  }

  // Chaîne : signataire → (intermédiaires embarqués) → ancre configurée.
  let courant = signataire;
  for (let profondeur = 0; profondeur < PROFONDEUR_CHAINE_MAX; profondeur++) {
    if (!valideA(courant, instant)) {
      throw new ErreurHorodatage("certificat hors période de validité à l'instant attesté");
    }
    const ancre = ancres.find(
      (a) =>
        a.fingerprint256 === courant.fingerprint256 ||
        (courant.checkIssued(a) && a.ca && courant.verify(a.publicKey)),
    );
    if (ancre !== undefined) {
      if (!valideA(ancre, instant)) {
        throw new ErreurHorodatage("ancre hors période de validité à l'instant attesté");
      }
      return;
    }
    const parent = certificats.find(
      (c) =>
        c.fingerprint256 !== courant.fingerprint256 &&
        c.ca &&
        courant.checkIssued(c) &&
        courant.verify(c.publicKey),
    );
    if (parent === undefined) break;
    courant = parent;
  }
  throw new ErreurHorodatage("chaîne de certificats non reliée à une ancre de confiance");
}
