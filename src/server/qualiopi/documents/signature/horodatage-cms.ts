/**
 * Vérification de la SIGNATURE CMS d'un jeton d'horodatage RFC 3161 — `node:crypto` seul (audit sécurité).
 *
 * Pourquoi : `lireReponse` ne contrôle que la FORME du jeton (empreinte, nonce, instant). Sans cette
 * vérification, quiconque se place entre nous et l'autorité (ou une autorité malveillante) pouvait
 * fabriquer un jeton bien formé : il devenait « obtenu », donc DÉFINITIF (déclencheur SQL).
 *
 * ## Ce qui est vérifié
 *  1. le contenu signé (TSTInfo) a pour empreinte celle de l'attribut signé `messageDigest` ;
 *  2. la signature du SignerInfo (sur les attributs signés) se vérifie avec la clé d'un certificat
 *     embarqué dans le jeton — RSA PKCS#1 v1.5 ou ECDSA ; tout autre schéma est REFUSÉ (échec fermé) ;
 *  3. ce certificat porte l'usage étendu `timeStamping` (1.3.6.1.5.5.7.3.8) et est valide à `genTime` ;
 *  4. une chaîne de certificats mène à une ANCRE DE CONFIANCE : QUAND `HORODATAGE_TSA_CA_PEM` est posé,
 *     ces ancres-là SEULEMENT (autorité à racine privée, ex. FreeTSA) ; sinon les racines de Node
 *     (`tls.rootCertificates`, magasin Mozilla). Chaque lien : émetteur déclaré (`checkIssued`) ET
 *     signature vérifiée, validité à `genTime`. Anti-DoS : au plus 10 certificats embarqués (sinon refus
 *     net), certificats déjà visités écartés, profondeur 6, arrêt au premier émetteur valide ;
 *  5. contrôles de forme : contentType = id-signedData, eContentType = id-ct-TSTInfo, un seul attribut
 *     `messageDigest`, usage étendu `timeStamping` CRITIQUE et EXCLUSIF, clé RSA ≥ 2048 bits ou ECDSA
 *     (DSA refusé), et le `sid` du SignerInfo désigne bien le certificat dont la clé a signé.
 *
 * ## Ce qui NE l'est PAS (limite assumée)
 *  · la RÉVOCATION (ni CRL ni OCSP : pas d'E/S réseau ici) ;
 *  · les contraintes de nom, de politique et de longueur de chemin au-delà de `CA:TRUE` ;
 *  · l'attribut `signingCertificateV2` (lien cryptographique certificat ↔ jeton) ;
 *  · RSA-PSS, EdDSA et DSA (refus) ; RSA < 2048 bits (refus).
 * L'audit hors ligne reste possible sur le jeton brut conservé : `openssl ts -verify -in jeton.tsr
 * -digest <selfHash> -CAfile <ca.pem>` — voir `horodatage-rfc3161.ts`.
 *
 * Aucune horloge ni E/S : l'instant et les ancres sont des paramètres.
 */
import { createHash, verify, X509Certificate } from "node:crypto";
import { rootCertificates } from "node:tls";

export class ErreurSignatureJeton extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurSignatureJeton";
  }
}

const OID_EKU_HORODATAGE = "1.3.6.1.5.5.7.3.8";
const OID_MESSAGE_DIGEST = "2a864886f70d010904";
const PROFONDEUR_MAX = 6;
/** Plafond de certificats embarqués dans un jeton : au-delà, refus net (anti-DoS, jeton piégé). */
const CERTIFICATS_MAX = 10;
const OID_SIGNED_DATA = "2a864886f70d010702";
const OID_CT_TSTINFO = "2a864886f70d0109100104";
const RSA_BITS_MIN = 2048;

const HACHAGES: Readonly<Record<string, string>> = {
  "608648016503040201": "sha256",
  "608648016503040202": "sha384",
  "608648016503040203": "sha512",
};

interface Noeud {
  readonly tag: number;
  readonly contenu: Buffer;
  /** TLV complet (étiquette + longueur + contenu), tel que reçu. */
  readonly brut: Buffer;
}

function lireTlvs(tampon: Buffer): Noeud[] {
  const out: Noeud[] = [];
  let i = 0;
  while (i < tampon.length) {
    const debut = i;
    const tag = tampon[i++];
    if (tag === undefined || (tag & 0x1f) === 0x1f) throw new ErreurSignatureJeton("DER illisible");
    const l0 = tampon[i++];
    if (l0 === undefined) throw new ErreurSignatureJeton("DER tronqué");
    let longueur = l0;
    if (l0 & 0x80) {
      const n = l0 & 0x7f;
      if (n === 0 || n > 3) throw new ErreurSignatureJeton("longueur DER non gérée");
      longueur = 0;
      for (let k = 0; k < n; k++) {
        const b = tampon[i++];
        if (b === undefined) throw new ErreurSignatureJeton("DER tronqué");
        longueur = (longueur << 8) | b;
      }
    }
    if (i + longueur > tampon.length) throw new ErreurSignatureJeton("DER tronqué");
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
  if (n === undefined || n.tag !== tag) throw new ErreurSignatureJeton(`jeton illisible : ${quoi}`);
  return n;
}

export interface EntreesSignatureJeton {
  /** Réponse brute (TimeStampResp, DER). */
  readonly reponse: Buffer;
  /** Instant attesté (`genTime`), déjà lu par `lireReponse`. */
  readonly genTime: Date;
  /** Ancres de confiance en PEM (HORODATAGE_TSA_CA_PEM) : si non vide, REMPLACE les racines de Node. */
  readonly ancresPem?: readonly string[];
  /** Remplace les racines de Node (tests). */
  readonly racines?: readonly string[];
}

/** Sépare un fichier PEM contenant plusieurs certificats. */
export function certificatsDePem(pem: string): string[] {
  return pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? [];
}

function valideA(c: X509Certificate, a: Date): boolean {
  return (
    new Date(c.validFrom).getTime() <= a.getTime() && a.getTime() <= new Date(c.validTo).getTime()
  );
}

/**
 * Chaîne `cert` → ancre, par les certificats embarqués `intermediaires`.
 * `visites` : empreintes déjà parcourues (un cycle ou un doublon n'est jamais revisité) ; on s'arrête
 * au premier émetteur valide qui mène à une ancre.
 */
function chaineJusquAUneAncre(
  cert: X509Certificate,
  intermediaires: readonly X509Certificate[],
  ancres: readonly X509Certificate[],
  genTime: Date,
  profondeur: number,
  visites: Set<string>,
): boolean {
  if (profondeur > PROFONDEUR_MAX) return false;
  visites.add(cert.fingerprint256);
  // Le certificat EST une ancre.
  if (ancres.some((a) => a.fingerprint256 === cert.fingerprint256)) return true;
  const estEmetteur = (e: X509Certificate): boolean =>
    e.ca && valideA(e, genTime) && cert.checkIssued(e) && cert.verify(e.publicKey);
  if (ancres.some(estEmetteur)) return true;
  for (const i of intermediaires) {
    if (visites.has(i.fingerprint256) || !estEmetteur(i)) continue;
    if (chaineJusquAUneAncre(i, intermediaires, ancres, genTime, profondeur + 1, visites)) {
      return true;
    }
  }
  return false;
}

/** Entier DER sans zéros de tête, en hexadécimal minuscule. */
function serieHex(contenu: Buffer): string {
  return contenu.toString("hex").replace(/^(00)+(?=.)/, "");
}

/** Sous-séquence `issuer` et numéro de série du TBSCertificate. */
function emetteurEtSerie(cert: X509Certificate): { issuer: Buffer; serie: string } {
  const tbs = exiger(
    lireTlvs(exiger(lireTlvs(cert.raw)[0], 0x30, "certificat").contenu)[0],
    0x30,
    "tbs",
  );
  const champs = lireTlvs(tbs.contenu);
  const d = champs[0]?.tag === 0xa0 ? 1 : 0;
  return {
    serie: serieHex(exiger(champs[d], 0x02, "série").contenu),
    issuer: exiger(champs[d + 2], 0x30, "émetteur").brut,
  };
}

/** Extension X.509 (DER) par OID : drapeau « critique » et contenu de l'OCTET STRING. */
function extensionDe(
  cert: X509Certificate,
  oidHex: string,
): { critique: boolean; valeur: Buffer } | undefined {
  const tbs = exiger(
    lireTlvs(exiger(lireTlvs(cert.raw)[0], 0x30, "certificat").contenu)[0],
    0x30,
    "tbs",
  );
  const ext = lireTlvs(tbs.contenu).find((n) => n.tag === 0xa3);
  if (ext === undefined) return undefined;
  const liste = lireTlvs(exiger(lireTlvs(ext.contenu)[0], 0x30, "extensions").contenu);
  for (const e of liste) {
    const champs = lireTlvs(exiger(e, 0x30, "extension").contenu);
    if (champs[0]?.contenu.toString("hex") !== oidHex) continue;
    const critique = champs[1]?.tag === 0x01 && champs[1].contenu[0] === 0xff;
    const octets = champs[critique || champs[1]?.tag === 0x01 ? 2 : 1];
    return { critique, valeur: exiger(octets, 0x04, "extension (octets)").contenu };
  }
  return undefined;
}

/** Le `sid` du SignerInfo désigne-t-il ce certificat ? (issuerAndSerialNumber ou subjectKeyIdentifier) */
function sidDesigne(sid: Noeud | undefined, cert: X509Certificate): boolean {
  if (sid === undefined) return false;
  if (sid.tag === 0x30) {
    const [issuer, serie] = lireTlvs(sid.contenu);
    if (issuer === undefined || serie === undefined || serie.tag !== 0x02) return false;
    const c = emetteurEtSerie(cert);
    return issuer.brut.equals(c.issuer) && serieHex(serie.contenu) === c.serie;
  }
  if (sid.tag === 0x80) {
    const ski = extensionDe(cert, "551d0e");
    if (ski === undefined) return false;
    const id = lireTlvs(ski.valeur)[0];
    return id?.tag === 0x04 && id.contenu.equals(sid.contenu);
  }
  return false;
}

/** Usage étendu : `timeStamping` seul, marqué critique. */
function controlerUsageHorodatage(c: X509Certificate): void {
  const usages = c.keyUsage ?? [];
  if (!usages.includes(OID_EKU_HORODATAGE)) {
    throw new ErreurSignatureJeton("le certificat n'est pas un certificat d'horodatage");
  }
  if (usages.length !== 1) {
    throw new ErreurSignatureJeton("l'usage étendu timeStamping doit être exclusif");
  }
  if (extensionDe(c, "551d25")?.critique !== true) {
    throw new ErreurSignatureJeton("l'usage étendu timeStamping doit être critique");
  }
}

/**
 * Lève `ErreurSignatureJeton` si la signature CMS du jeton n'est pas celle d'une autorité de confiance.
 */
export function verifierSignatureJeton(entrees: EntreesSignatureJeton): void {
  // TimeStampResp → ContentInfo → [0] SignedData.
  const racine = exiger(lireTlvs(entrees.reponse)[0], 0x30, "TimeStampResp");
  const contentInfo = exiger(lireTlvs(racine.contenu)[1], 0x30, "timeStampToken");
  const signedData = exiger(
    lireTlvs(exiger(lireTlvs(contentInfo.contenu)[1], 0xa0, "content").contenu)[0],
    0x30,
    "SignedData",
  );
  if (
    exiger(lireTlvs(contentInfo.contenu)[0], 0x06, "contentType").contenu.toString("hex") !==
    OID_SIGNED_DATA
  ) {
    throw new ErreurSignatureJeton("le contentType du jeton n'est pas id-signedData");
  }
  const sd = lireTlvs(signedData.contenu);
  // version, digestAlgorithms, encapContentInfo, [0] certificates?, [1] crls?, signerInfos.
  const encap = lireTlvs(exiger(sd[2], 0x30, "encapContentInfo").contenu);
  if (exiger(encap[0], 0x06, "eContentType").contenu.toString("hex") !== OID_CT_TSTINFO) {
    throw new ErreurSignatureJeton("l'eContentType du jeton n'est pas id-ct-TSTInfo");
  }
  const octets = exiger(
    lireTlvs(exiger(encap[1], 0xa0, "eContent").contenu)[0],
    0x04,
    "TSTInfo (octets)",
  );
  const tstInfo = exiger(lireTlvs(octets.contenu)[0], 0x30, "TSTInfo").brut;

  const certsNoeud = sd.find((n) => n.tag === 0xa0);
  if (certsNoeud === undefined) throw new ErreurSignatureJeton("aucun certificat dans le jeton");
  const certsBruts = lireTlvs(certsNoeud.contenu);
  if (certsBruts.length > CERTIFICATS_MAX) {
    throw new ErreurSignatureJeton(
      `trop de certificats embarqués (${certsBruts.length} > ${CERTIFICATS_MAX})`,
    );
  }
  const embarques: X509Certificate[] = [];
  for (const c of certsBruts) {
    if (c.tag !== 0x30) continue;
    try {
      embarques.push(new X509Certificate(c.brut));
    } catch {
      // certificat illisible : ignoré, il ne pourra pas servir de preuve
    }
  }
  if (embarques.length === 0) throw new ErreurSignatureJeton("aucun certificat lisible");

  const signerInfos = lireTlvs(exiger(sd[sd.length - 1], 0x31, "signerInfos").contenu);
  if (signerInfos.length !== 1) throw new ErreurSignatureJeton("un seul signataire attendu");
  const si = lireTlvs(exiger(signerInfos[0], 0x30, "SignerInfo").contenu);
  // version, sid, digestAlgorithm, [0] signedAttrs, signatureAlgorithm, signature.
  const algoHachage = lireTlvs(exiger(si[2], 0x30, "digestAlgorithm").contenu)[0];
  const hachage = HACHAGES[exiger(algoHachage, 0x06, "oid").contenu.toString("hex")];
  if (hachage === undefined) throw new ErreurSignatureJeton("algorithme de hachage non géré");
  const attrs = exiger(si[3], 0xa0, "signedAttrs");
  const algoSignature = lireTlvs(exiger(si[4], 0x30, "signatureAlgorithm").contenu)[0];
  const oidSignature = exiger(algoSignature, 0x06, "oid").contenu.toString("hex");
  const signature = exiger(si[5], 0x04, "signature").contenu;

  // 1. messageDigest == hachage(TSTInfo).
  const attributs = lireTlvs(attrs.contenu).map((attr) =>
    lireTlvs(exiger(attr, 0x30, "attribut").contenu),
  );
  const digests = attributs.filter(([oid]) => oid?.contenu.toString("hex") === OID_MESSAGE_DIGEST);
  if (digests.length > 1) throw new ErreurSignatureJeton("attribut messageDigest en double");
  const valeursDigest = digests[0]?.[1];
  const digestAttendu =
    valeursDigest === undefined
      ? undefined
      : exiger(lireTlvs(exiger(valeursDigest, 0x31, "valeurs").contenu)[0], 0x04, "digest").contenu;
  if (digestAttendu === undefined) throw new ErreurSignatureJeton("messageDigest absent");
  if (!createHash(hachage).update(tstInfo).digest().equals(digestAttendu)) {
    throw new ErreurSignatureJeton("le contenu signé ne correspond pas à la signature");
  }

  // 2. Signature sur les attributs signés, ré-étiquetés en SET (RFC 5652 §5.4).
  const aSigner = Buffer.from(attrs.brut);
  aSigner[0] = 0x31;
  // RSA : rsaEncryption (1.2.840.113549.1.1.1) ou sha*WithRSA ; ECDSA : 1.2.840.10045.4.3.* / 10045.2.1.
  const rsa = oidSignature.startsWith("2a864886f70d0101");
  const ecdsa = oidSignature.startsWith("2a8648ce3d04") || oidSignature === "2a8648ce3d0201";
  if (!rsa && !ecdsa) throw new ErreurSignatureJeton("schéma de signature non géré");
  if (oidSignature === "2a864886f70d01010a") {
    throw new ErreurSignatureJeton("schéma de signature non géré"); // RSA-PSS
  }

  const signataire = embarques.find((c) => {
    try {
      return verify(hachage, aSigner, c.publicKey, signature);
    } catch {
      return false;
    }
  });
  if (signataire === undefined) {
    throw new ErreurSignatureJeton(
      "la signature de l'autorité ne se vérifie avec aucun certificat",
    );
  }

  // 3. Clé acceptable, `sid` cohérent, usage étendu « horodatage » et validité à l'instant du jeton.
  const cle = signataire.publicKey;
  if (cle.asymmetricKeyType === "rsa") {
    if ((cle.asymmetricKeyDetails?.modulusLength ?? 0) < RSA_BITS_MIN) {
      throw new ErreurSignatureJeton(`clé RSA de moins de ${RSA_BITS_MIN} bits refusée`);
    }
  } else if (cle.asymmetricKeyType !== "ec") {
    throw new ErreurSignatureJeton("type de clé non géré (DSA, EdDSA… refusés)");
  }
  if (!sidDesigne(si[1], signataire)) {
    throw new ErreurSignatureJeton("le sid du signataire ne désigne pas la clé qui a signé");
  }
  controlerUsageHorodatage(signataire);
  if (!valideA(signataire, entrees.genTime)) {
    throw new ErreurSignatureJeton("certificat de l'autorité hors validité à l'instant du jeton");
  }

  // 4. Chaîne jusqu'à une ancre de confiance.
  // HORODATAGE_TSA_CA_PEM posé → ces ancres SEULES (même si elles sont illisibles : échec fermé).
  const ancresPrivees = (entrees.ancresPem ?? []).filter((p) => p.trim() !== "");
  const sources = ancresPrivees.length > 0 ? ancresPrivees : (entrees.racines ?? rootCertificates);
  const ancres = sources.flatMap((pem) =>
    certificatsDePem(pem).flatMap((p) => {
      try {
        return [new X509Certificate(p)];
      } catch {
        return [];
      }
    }),
  );
  if (!chaineJusquAUneAncre(signataire, embarques, ancres, entrees.genTime, 0, new Set())) {
    throw new ErreurSignatureJeton("la chaîne de certificats ne mène à aucune ancre de confiance");
  }
}
