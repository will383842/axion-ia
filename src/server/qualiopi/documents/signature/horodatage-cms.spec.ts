/**
 * Vérification de la signature CMS d'un jeton RFC 3161 — contre de VRAIS jetons produits par
 * `openssl ts -reply` (autorité de test à chaîne CA → TSA, usage étendu `timeStamping`).
 * Sans `openssl` dans l'environnement, la suite est sautée (jamais verte pour rien en CI : l'image
 * Ubuntu des Gates l'embarque).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { construireRequete, lireReponse } from "./horodatage-rfc3161";
import { ErreurSignatureJeton, verifierSignatureJeton } from "./horodatage-cms";

const aOpenssl = spawnSync("openssl", ["version"]).status === 0;
const EMPREINTE = "cd".repeat(32);
const NONCE = Buffer.from("0a0b0c0d0e0f1011", "hex");

interface Autorite {
  readonly caPem: string;
  readonly jeton: Buffer;
  /** Numéro de série (hex) du certificat TSA. */
  readonly serieTsa: string;
  readonly dir: string;
}

interface Variante {
  /** Clé du certificat TSA (défaut : rsa:2048). */
  readonly cleTsa?: string[];
  /** Extension EKU du certificat TSA (défaut : critique, timeStamping seul). */
  readonly eku?: string;
  /** Nombre de certificats CA:TRUE cycliques (même DN, même clé que la CA) ajoutés au jeton. */
  readonly cycliques?: number;
}

function sh(dir: string, ...args: string[]): void {
  execFileSync("openssl", args, { cwd: dir, stdio: "pipe" });
}

/** Une autorité complète (CA racine + certificat TSA) et un jeton signé par elle. */
function fabriquer(nom: string, dossier: string, v: Variante = {}): Autorite {
  const d = join(dossier, nom);
  execFileSync("mkdir", ["-p", d]);
  writeFileSync(join(d, "ext.cnf"), `${v.eku ?? "extendedKeyUsage=critical,timeStamping"}\n`);
  writeFileSync(join(d, "serial"), "01\n");
  writeFileSync(
    join(d, "ts.cnf"),
    [
      "[ tsa ]",
      "default_tsa = tsa_config",
      "[ tsa_config ]",
      "dir = .",
      "serial = ./serial",
      "crypto_device = builtin",
      "signer_cert = ./tsa.pem",
      "certs = ./ca.pem",
      "signer_key = ./tsa.key",
      "signer_digest = sha256",
      "default_policy = 1.2.3.4.1",
      "digests = sha256",
      "accuracy = secs:1",
      "ordering = yes",
      "tsa_name = yes",
      "ess_cert_id_chain = no",
      "ess_cert_id_alg = sha256",
      "",
    ].join("\n"),
  );
  sh(
    d,
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    "ca.key",
    "-out",
    "ca.pem",
    "-subj",
    `/CN=Autorite de test ${nom}`,
    "-days",
    "3650",
    "-addext",
    "basicConstraints=critical,CA:TRUE",
    "-addext",
    "keyUsage=critical,keyCertSign",
  );
  sh(
    d,
    "req",
    "-newkey",
    ...(v.cleTsa ?? ["rsa:2048"]),
    "-nodes",
    "-keyout",
    "tsa.key",
    "-out",
    "tsa.csr",
    "-subj",
    `/CN=TSA de test ${nom}`,
  );
  sh(
    d,
    "x509",
    "-req",
    "-in",
    "tsa.csr",
    "-CA",
    "ca.pem",
    "-CAkey",
    "ca.key",
    "-CAcreateserial",
    "-out",
    "tsa.pem",
    "-days",
    "3650",
    "-extfile",
    "ext.cnf",
  );
  const caPem = readFileSync(join(d, "ca.pem"), "utf8");
  for (let k = 0; k < (v.cycliques ?? 0); k++) {
    // Même DN, même clé que la CA, CA:TRUE, empreinte différente (série) : chacun « émet » les autres.
    sh(
      d,
      "req",
      "-x509",
      "-new",
      "-key",
      "ca.key",
      "-out",
      `cyc${k}.pem`,
      "-subj",
      `/CN=Autorite de test ${nom}`,
      "-days",
      "3650",
      "-set_serial",
      String(1000 + k),
      "-addext",
      "basicConstraints=critical,CA:TRUE",
      "-addext",
      "keyUsage=critical,keyCertSign",
    );
    writeFileSync(join(d, "ca.pem"), readFileSync(join(d, `cyc${k}.pem`), "utf8"), { flag: "a" });
  }
  writeFileSync(join(d, "q.tsq"), construireRequete(EMPREINTE, NONCE));
  sh(d, "ts", "-reply", "-queryfile", "q.tsq", "-config", "ts.cnf", "-out", "r.tsr");
  return {
    caPem,
    jeton: readFileSync(join(d, "r.tsr")),
    serieTsa: new X509Certificate(readFileSync(join(d, "tsa.pem"))).serialNumber,
    dir: d,
  };
}

interface Tlv {
  readonly tag: number;
  readonly contenu: Buffer;
}

function decoder(b: Buffer): Tlv[] {
  const out: Tlv[] = [];
  let i = 0;
  while (i < b.length) {
    const tag = b[i++] as number;
    let n = b[i++] as number;
    if (n & 0x80) {
      const k = n & 0x7f;
      n = 0;
      for (let j = 0; j < k; j++) n = (n << 8) | (b[i++] as number);
    }
    out.push({ tag, contenu: b.subarray(i, i + n) });
    i += n;
  }
  return out;
}

function encoder(tag: number, c: Buffer): Buffer {
  const n = c.length;
  const l =
    n < 0x80
      ? Buffer.from([n])
      : n < 0x100
        ? Buffer.from([0x81, n])
        : Buffer.from([0x82, n >> 8, n & 0xff]);
  return Buffer.concat([Buffer.from([tag]), l, c]);
}

/** Reconstruit un DER en remplaçant tout TLV égal à `ancien` par `nouveau` (longueurs recalculées). */
function remplacerTlv(b: Buffer, ancien: Buffer, nouveau: Buffer): Buffer {
  return Buffer.concat(
    decoder(b).map((t) => {
      const brut = encoder(t.tag, t.contenu);
      if (brut.equals(ancien)) return nouveau;
      return t.tag & 0x20 ? encoder(t.tag, remplacerTlv(t.contenu, ancien, nouveau)) : brut;
    }),
  );
}

const derDe = (pem: string): Buffer => Buffer.from(pem.replace(/-+[A-Z ]+-+|\s/g, ""), "base64");

/** Ré-émet un certificat TSA (même clé) avec d'autres extensions, signé par la CA, et le met dans le jeton. */
function avecCertificatTsa(a: Autorite, extensions: string, nom: string): Buffer {
  writeFileSync(join(a.dir, `${nom}.cnf`), `${extensions}\n`);
  sh(
    a.dir,
    "x509",
    "-req",
    "-in",
    "tsa.csr",
    "-CA",
    "ca.pem",
    "-CAkey",
    "ca.key",
    "-set_serial",
    "0x" + a.serieTsa,
    "-out",
    `${nom}.pem`,
    "-days",
    "3650",
    "-extfile",
    `${nom}.cnf`,
  );
  const ancien = derDe(readFileSync(join(a.dir, "tsa.pem"), "utf8"));
  const nouveau = derDe(readFileSync(join(a.dir, `${nom}.pem`), "utf8"));
  return remplacerTlv(a.jeton, ancien, nouveau);
}

describe.skipIf(!aOpenssl)("signature CMS d'un jeton d'horodatage", () => {
  let dossier = "";
  let bonne: Autorite;
  let fausse: Autorite;
  const maintenant = (): Date => new Date();

  beforeAll(() => {
    dossier = mkdtempSync(join(tmpdir(), "tsa-"));
    bonne = fabriquer("bonne", dossier);
    fausse = fabriquer("fausse", dossier);
  }, 60_000);
  afterAll(() => rmSync(dossier, { recursive: true, force: true }));

  const genTimeDe = (jeton: Buffer): Date =>
    lireReponse(jeton, EMPREINTE, NONCE, maintenant()).genTime;

  it("accepte un jeton signé par une autorité dont la racine est de confiance", () => {
    expect(() =>
      verifierSignatureJeton({
        reponse: bonne.jeton,
        genTime: genTimeDe(bonne.jeton),
        racines: [bonne.caPem],
      }),
    ).not.toThrow();
  });

  it("accepte aussi une racine fournie par HORODATAGE_TSA_CA_PEM (ancresPem)", () => {
    expect(() =>
      verifierSignatureJeton({
        reponse: bonne.jeton,
        genTime: genTimeDe(bonne.jeton),
        racines: [],
        ancresPem: [bonne.caPem],
      }),
    ).not.toThrow();
  });

  it("🔴 refuse un jeton bien formé mais signé par une autorité INCONNUE (faux jeton)", () => {
    // Le jeton « fausse » est un jeton RFC 3161 valide en tout point... pour une autre racine.
    expect(() =>
      verifierSignatureJeton({
        reponse: fausse.jeton,
        genTime: genTimeDe(fausse.jeton),
        racines: [bonne.caPem],
      }),
    ).toThrow(/ancre de confiance/);
  });

  it("🔴 refuse un jeton quand AUCUNE ancre n'est de confiance (racines publiques de Node seules)", () => {
    expect(() =>
      verifierSignatureJeton({ reponse: bonne.jeton, genTime: genTimeDe(bonne.jeton) }),
    ).toThrow(ErreurSignatureJeton);
  });

  it("🔴 refuse un jeton dont le contenu signé a été modifié", () => {
    const altere = Buffer.from(bonne.jeton);
    // Dernier chiffre de l'empreinte horodatée : on retourne un bit dans le TSTInfo.
    const i = altere.indexOf(Buffer.from(EMPREINTE, "hex"));
    expect(i).toBeGreaterThan(0);
    altere[i + 3] = (altere[i + 3] ?? 0) ^ 0x01;
    expect(() =>
      verifierSignatureJeton({
        reponse: altere,
        genTime: genTimeDe(bonne.jeton),
        racines: [bonne.caPem],
      }),
    ).toThrow(/contenu signé/);
  });

  it("🔴 refuse un jeton dont la SIGNATURE a été modifiée", () => {
    const altere = Buffer.from(bonne.jeton);
    altere[altere.length - 5] = (altere[altere.length - 5] ?? 0) ^ 0xff;
    expect(() =>
      verifierSignatureJeton({
        reponse: altere,
        genTime: genTimeDe(bonne.jeton),
        racines: [bonne.caPem],
      }),
    ).toThrow(ErreurSignatureJeton);
  });

  it("refuse un certificat hors validité à l'instant du jeton", () => {
    const dansDixAns = new Date(Date.now() + 11 * 365 * 24 * 3600 * 1000);
    expect(() =>
      verifierSignatureJeton({ reponse: bonne.jeton, genTime: dansDixAns, racines: [bonne.caPem] }),
    ).toThrow(/validité/);
  });

  it("refuse une réponse qui n'est pas un jeton", () => {
    expect(() =>
      verifierSignatureJeton({
        reponse: Buffer.from("pas du DER"),
        genTime: new Date(),
        racines: [],
      }),
    ).toThrow(ErreurSignatureJeton);
  });

  describe("durcissement (audit)", () => {
    const refuse = (a: Autorite, jeton: Buffer, motif: RegExp): void => {
      expect(() =>
        verifierSignatureJeton({ reponse: jeton, genTime: genTimeDe(a.jeton), racines: [a.caPem] }),
      ).toThrow(motif);
    };
    const remplacer = (jeton: Buffer, de: string, vers: string, dernier = false): Buffer => {
      const b = Buffer.from(jeton);
      const cle = Buffer.from(de, "hex");
      const i = dernier ? b.lastIndexOf(cle) : b.indexOf(cle);
      expect(i).toBeGreaterThan(0);
      Buffer.from(vers, "hex").copy(b, i);
      return b;
    };

    it("🔴 DoS : un jeton portant 60 certificats cycliques est refusé en moins d'une seconde", () => {
      const piege = fabriquer("cyclique", dossier, { cycliques: 60 });
      const t0 = Date.now();
      expect(() =>
        verifierSignatureJeton({
          reponse: piege.jeton,
          genTime: genTimeDe(piege.jeton),
          racines: [fausse.caPem], // ancre étrangère : aucun émetteur valide n'existe
        }),
      ).toThrow(/trop de certificats/);
      expect(Date.now() - t0).toBeLessThan(1000);
    }, 60_000);

    it("🔴 DoS : 9 certificats cycliques (sous le plafond) sans ancre : refus rapide, pas d'explosion", () => {
      const piege = fabriquer("cyclique9", dossier, { cycliques: 8 });
      const t0 = Date.now();
      expect(() =>
        verifierSignatureJeton({
          reponse: piege.jeton,
          genTime: genTimeDe(piege.jeton),
          racines: [fausse.caPem],
        }),
      ).toThrow(/ancre de confiance/);
      expect(Date.now() - t0).toBeLessThan(1000);
    }, 60_000);

    it("accepte une chaîne avec cycles quand l'ancre est présente", () => {
      const ok = fabriquer("cyclique-ok", dossier, { cycliques: 3 });
      expect(() =>
        verifierSignatureJeton({
          reponse: ok.jeton,
          genTime: genTimeDe(ok.jeton),
          racines: [ok.caPem],
        }),
      ).not.toThrow();
    }, 60_000);

    it("🔴 HORODATAGE_TSA_CA_PEM posé : SEULES ces ancres comptent (pas les racines de Node)", () => {
      // `racines` (= magasin) contient la bonne CA, mais `ancresPem` est posé et ne la contient pas.
      expect(() =>
        verifierSignatureJeton({
          reponse: bonne.jeton,
          genTime: genTimeDe(bonne.jeton),
          racines: [bonne.caPem],
          ancresPem: [fausse.caPem],
        }),
      ).toThrow(/ancre de confiance/);
    });

    it("🔴 refuse un contentType qui n'est pas id-signedData", () => {
      refuse(
        bonne,
        remplacer(bonne.jeton, "2a864886f70d010702", "2a864886f70d010703"),
        /signedData/,
      );
    });

    it("🔴 refuse un eContentType qui n'est pas id-ct-TSTInfo", () => {
      refuse(
        bonne,
        remplacer(bonne.jeton, "2a864886f70d0109100104", "2a864886f70d0109100105"),
        /TSTInfo/,
      );
    });

    it("🔴 refuse un attribut messageDigest en double", () => {
      refuse(
        bonne,
        remplacer(bonne.jeton, "06092a864886f70d010903", "06092a864886f70d010904"),
        /en double/,
      );
    });

    it("🔴 refuse un usage étendu timeStamping NON critique", () => {
      const j = avecCertificatTsa(bonne, "extendedKeyUsage=timeStamping", "eku-nc");
      refuse(bonne, j, /critique/);
    });

    it("🔴 refuse un usage étendu timeStamping non exclusif", () => {
      const j = avecCertificatTsa(
        bonne,
        "extendedKeyUsage=critical,timeStamping,clientAuth",
        "eku-multi",
      );
      refuse(bonne, j, /exclusif/);
    });

    it("🔴 refuse une clé RSA de moins de 2048 bits", () => {
      const a = fabriquer("rsa1024", dossier, { cleTsa: ["rsa:1024"] });
      refuse(a, a.jeton, /2048/);
    }, 60_000);

    it("🔴 refuse une clé DSA", () => {
      const d = join(dossier, "dsa");
      execFileSync("mkdir", ["-p", d]);
      sh(
        d,
        "genpkey",
        "-genparam",
        "-algorithm",
        "DSA",
        "-pkeyopt",
        "dsa_paramgen_bits:2048",
        "-out",
        "p.pem",
      );
      sh(d, "genpkey", "-paramfile", "p.pem", "-out", "dsa.key");
      sh(d, "req", "-new", "-key", "dsa.key", "-out", "dsa.csr", "-subj", "/CN=TSA dsa");
      writeFileSync(join(d, "ext.cnf"), "extendedKeyUsage=critical,timeStamping\n");
      sh(
        bonne.dir,
        "x509",
        "-req",
        "-in",
        join(d, "dsa.csr"),
        "-CA",
        "ca.pem",
        "-CAkey",
        "ca.key",
        "-set_serial",
        "0x" + bonne.serieTsa,
        "-out",
        join(d, "dsa.pem"),
        "-days",
        "3650",
        "-extfile",
        join(d, "ext.cnf"),
      );
      const ancienCert = derDe(readFileSync(join(bonne.dir, "tsa.pem"), "utf8"));
      const nouveauCert = derDe(readFileSync(join(d, "dsa.pem"), "utf8"));
      // Signature DSA sur les attributs signés, et algorithme DSA-with-SHA256 (2.16.840.1.101.3.4.3.2).
      const contentInfo = decoder(decoder(bonne.jeton)[0]!.contenu)[1]!;
      const sd = decoder(decoder(contentInfo.contenu)[1]!.contenu)[0]!;
      const champs = decoder(sd.contenu);
      const si = decoder(decoder(champs[champs.length - 1]!.contenu)[0]!.contenu);
      const attrs = si[3]!;
      writeFileSync(join(d, "attrs.der"), encoder(0x31, attrs.contenu));
      sh(d, "dgst", "-sha256", "-sign", "dsa.key", "-out", "sig.bin", "attrs.der");
      const algo = encoder(
        0x30,
        Buffer.concat([encoder(0x06, Buffer.from("608648016503040302", "hex"))]),
      );
      let j = remplacerTlv(bonne.jeton, ancienCert, nouveauCert);
      j = remplacerTlv(j, encoder(0x30, si[4]!.contenu), algo);
      j = remplacerTlv(
        j,
        encoder(0x04, si[5]!.contenu),
        encoder(0x04, readFileSync(join(d, "sig.bin"))),
      );
      refuse(bonne, j, /DSA|non géré/);
    }, 60_000);

    it("🔴 refuse un sid (issuerAndSerialNumber) qui ne désigne pas la clé signataire", () => {
      // Le numéro de série apparaît dans le certificat, puis dans le sid : on altère le sid.
      const hex = bonne.serieTsa.toLowerCase();
      const octets = Buffer.from(hex.length % 2 === 0 ? hex : `0${hex}`, "hex");
      const occ: number[] = [];
      for (let i = bonne.jeton.indexOf(octets); i >= 0; i = bonne.jeton.indexOf(octets, i + 1)) {
        occ.push(i);
      }
      const cible = occ.find((i) => {
        const b = Buffer.from(bonne.jeton);
        b[i + octets.length - 1] = (b[i + octets.length - 1] ?? 0) ^ 0x01;
        try {
          verifierSignatureJeton({
            reponse: b,
            genTime: genTimeDe(bonne.jeton),
            racines: [bonne.caPem],
          });
          return false;
        } catch (e) {
          return e instanceof ErreurSignatureJeton && /sid|désigne/.test(e.message);
        }
      });
      expect(cible).toBeDefined();
    });
  });
});
