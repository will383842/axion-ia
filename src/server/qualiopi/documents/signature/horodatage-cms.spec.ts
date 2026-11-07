/**
 * Vérification de la signature CMS d'un jeton RFC 3161 — contre de VRAIS jetons produits par
 * `openssl ts -reply` (autorité de test à chaîne CA → TSA, usage étendu `timeStamping`).
 * Sans `openssl` dans l'environnement, la suite est sautée (jamais verte pour rien en CI : l'image
 * Ubuntu des Gates l'embarque).
 */
import { execFileSync, spawnSync } from "node:child_process";
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
}

function sh(dir: string, ...args: string[]): void {
  execFileSync("openssl", args, { cwd: dir, stdio: "pipe" });
}

/** Une autorité complète (CA racine + certificat TSA) et un jeton signé par elle. */
function fabriquer(nom: string, dossier: string): Autorite {
  const d = join(dossier, nom);
  execFileSync("mkdir", ["-p", d]);
  writeFileSync(join(d, "ext.cnf"), "extendedKeyUsage=critical,timeStamping\n");
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
    "rsa:2048",
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
  writeFileSync(join(d, "q.tsq"), construireRequete(EMPREINTE, NONCE));
  sh(d, "ts", "-reply", "-queryfile", "q.tsq", "-config", "ts.cnf", "-out", "r.tsr");
  return { caPem: readFileSync(join(d, "ca.pem"), "utf8"), jeton: readFileSync(join(d, "r.tsr")) };
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
});
