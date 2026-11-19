import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ErreurSignatureJeton, verifierSignatureJeton } from "./horodatage-cms";
import { ErreurHorodatage, lireReponse } from "./horodatage-rfc3161";

const FIXTURES = "src/server/qualiopi/documents/signature/__fixtures__/freetsa/";

// Essai HORS LIGNE sur une réponse réelle de FreeTSA (obtenue le 2026-11-19 depuis le poste du fondateur).
const lire = (nom: string): Buffer => readFileSync(FIXTURES + nom);
const meta = JSON.parse(lire("meta.json").toString("utf8")) as {
  empreinteHex: string;
  nonceHex: string;
  obtenuLe: string;
};
const reponse = lire("reponse.tsr");
const cacert = lire("cacert.pem").toString("utf8");
const nonce = Buffer.from(meta.nonceHex, "hex");
const GEN_TIME = new Date("2026-11-19T06:14:16Z");

describe("jeton réel FreeTSA (hors ligne)", () => {
  it("les fixtures sont celles attendues", () => {
    const sha = (b: Buffer): string => createHash("sha256").update(b).digest("hex");
    expect(sha(lire("cacert.pem"))).toBe(
      "2151b61137ffa86bf664691ba67e7da0b19f98c758e3d228d5d8ebf27e044438",
    );
    expect(sha(reponse)).toBe("168fbe9ee589f767905c256cf793844da877751a28b875e1c7ffe4ecee09a7c7");
    expect(sha(lire("donnee.txt"))).toBe(meta.empreinteHex);
  });

  it("lit le genTime attesté", () => {
    const jeton = lireReponse(reponse, meta.empreinteHex, nonce, new Date(meta.obtenuLe));
    expect(jeton.genTime.toISOString()).toBe(GEN_TIME.toISOString());
  });

  it("la signature CMS est valide face à la racine FreeTSA", () => {
    expect(() =>
      verifierSignatureJeton({ reponse, genTime: GEN_TIME, ancresPem: [cacert] }),
    ).not.toThrow();
  });

  it("refuse sans ancre FreeTSA (racines de Node)", () => {
    expect(() => verifierSignatureJeton({ reponse, genTime: GEN_TIME })).toThrow(
      ErreurSignatureJeton,
    );
  });

  it("refuse une empreinte altérée d'un octet", () => {
    const alteree = (meta.empreinteHex.startsWith("00") ? "01" : "00") + meta.empreinteHex.slice(2);
    expect(() => lireReponse(reponse, alteree, nonce, new Date(meta.obtenuLe))).toThrow(
      ErreurHorodatage,
    );
  });
  it("refuse une ancre illisible", () => {
    expect(() =>
      verifierSignatureJeton({
        reponse,
        genTime: GEN_TIME,
        ancresPem: ["-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----"],
      }),
    ).toThrow(ErreurSignatureJeton);
  });

  it("refuse le jeton réel face à un autre nonce", () => {
    expect(() =>
      lireReponse(
        reponse,
        meta.empreinteHex,
        Buffer.from("0000000000000000", "hex"),
        new Date(meta.obtenuLe),
      ),
    ).toThrow(ErreurHorodatage);
  });
});
