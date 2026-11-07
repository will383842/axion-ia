import { X509Certificate } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  configurationTsa,
  construireRequete,
  demanderJeton,
  ErreurHorodatage,
  lireGeneralizedTime,
  lireReponse,
  usageHorodatagePermis,
  verifierJeton,
} from "./horodatage-rfc3161";

const EMPREINTE = "ab".repeat(32);
const NONCE = Buffer.from("0102030405060708", "hex");
const MAINTENANT = new Date("2026-11-07T10:00:00.000Z");

// ── fabrique d'une TimeStampResp DER, pour éprouver la lecture sans réseau ──
function len(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n]);
  if (n < 0x100) return Buffer.from([0x81, n]);
  return Buffer.from([0x82, n >> 8, n & 0xff]);
}
const tlv = (tag: number, c: Buffer): Buffer =>
  Buffer.concat([Buffer.from([tag]), len(c.length), c]);
const OID_SHA256 = Buffer.from("0609608648016503040201", "hex");

function reponse(opts: {
  statut?: number;
  empreinteHex?: string;
  nonce?: Buffer;
  genTime?: string;
  sansNonce?: boolean;
}): Buffer {
  const statut = tlv(0x30, Buffer.from([0x02, 0x01, opts.statut ?? 0]));
  const imprint = tlv(
    0x30,
    Buffer.concat([
      tlv(0x30, Buffer.concat([OID_SHA256, Buffer.from([0x05, 0x00])])),
      tlv(0x04, Buffer.from(opts.empreinteHex ?? EMPREINTE, "hex")),
    ]),
  );
  const nonce = opts.nonce ?? NONCE;
  const tst = tlv(
    0x30,
    Buffer.concat([
      Buffer.from([0x02, 0x01, 0x01]),
      Buffer.from("06032a0301", "hex"),
      imprint,
      Buffer.from([0x02, 0x02, 0x01, 0x23]),
      tlv(0x18, Buffer.from(opts.genTime ?? "20261107100005Z", "ascii")),
      ...(opts.sansNonce ? [] : [tlv(0x02, Buffer.concat([Buffer.from([0]), nonce]))]),
    ]),
  );
  const encap = tlv(
    0x30,
    Buffer.concat([Buffer.from("060b2a864886f70d0109100104", "hex"), tlv(0xa0, tlv(0x04, tst))]),
  );
  const signedData = tlv(
    0x30,
    Buffer.concat([Buffer.from([0x02, 0x01, 0x03]), tlv(0x31, Buffer.alloc(0)), encap]),
  );
  const contentInfo = tlv(
    0x30,
    Buffer.concat([Buffer.from("06092a864886f70d010702", "hex"), tlv(0xa0, signedData)]),
  );
  return tlv(
    0x30,
    Buffer.concat([statut, ...(opts.statut && opts.statut > 1 ? [] : [contentInfo])]),
  );
}

// Réponse produite par « openssl ts -reply » (même moteur que les autorités gratuites usuelles),
// pour l'empreinte SHA-256 de « hello » et le nonce 0x595D0C7FAF9A7E7C : la lecture ne repose
// pas que sur notre propre fabrique.
const REELLE = Buffer.from(
  "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",
  "base64",
);
const HELLO = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
const NONCE_REEL = Buffer.from("595d0c7faf9a7e7c", "hex");

const CA_PEM = `-----BEGIN CERTIFICATE-----
MIIDLDCCAhSgAwIBAgIUAvCjV3OsHOkBXiKXMV5IwVd64wUwDQYJKoZIhvcNAQEL
BQAwEzERMA8GA1UEAwwIVGVzdCBUU0EwHhcNMjYxMTA3MDA1NDU5WhcNMjYxMTA5
MDA1NDU5WjATMREwDwYDVQQDDAhUZXN0IFRTQTCCASIwDQYJKoZIhvcNAQEBBQAD
ggEPADCCAQoCggEBANOkzOCLkH2lW0cHPWX4PDwxRzI4Sd+pI+WpfNTw2Kvct8Jc
SXI1bNaYdvd+Tn6Y9xIOaVmZQejs3tWJchWJZlSzUn4DjHBGpQIC3wLmRqZgauTE
PH1P+MTT2VojWH8aGJFUEYMhhWrw13UlIObPydntFwTYn8fSMGyLPRNMNzYsaXGO
+Sm0aQ9mgKfJ91nrMBVZFk8uJ1erSoEwzK4I+wKgYpxenVoFBQ01cepZVArxQ2rH
AXff+Xbmnef5u/D9c509EyD7JNfd1+OqlSuFEVkx4zM2qcxi7IHnRGl5bYbfOeYt
vUweXHGkssSf5OhA4WBxsRXVMOhLEslRLO/Ntk8CAwEAAaN4MHYwHQYDVR0OBBYE
FKWIU0YexT+3vb2FmWH85VkE8EOMMB8GA1UdIwQYMBaAFKWIU0YexT+3vb2FmWH8
5VkE8EOMMA8GA1UdEwEB/wQFMAMBAf8wFgYDVR0lAQH/BAwwCgYIKwYBBQUHAwgw
CwYDVR0PBAQDAgeAMA0GCSqGSIb3DQEBCwUAA4IBAQAHwJV6ACTnc4YimCsO95ok
epl0P/tSbm4KH9Bu5hluVOpEX58VWy8Uk802ZjU2fEPp6MYtPZYqvKcVfanRxEAr
75lEgLFE8k+MAn4tSVFnnTtsy0s1YvJC9FyB4SZmtmRShZxoThPxdi3mELGfLUmV
JY3BWfgZO2IyNY/mADYqToFEAjIljZaTP+Q/qd+3+CdBA7H+2g1qm6Ogf9hkdAx1
a0HYKIEERbfmKGY6gMo4nKYnOtn+BXwbeDMZjQFG58/1ZuUwAgdIB9l/hVTtxMPn
ZHSzDvd2C9g8aLp2+V/Ptyg2MgAtM6azXSx0FL8F+0BllNbtvexgniFRJEHqvQgf
-----END CERTIFICATE-----
`;
// Autre certificat auto-signé (sans usage d'horodatage) : n'est pas l'ancre de ce jeton.
const AUTRE_PEM = `-----BEGIN CERTIFICATE-----
MIIDATCCAemgAwIBAgIUFJfZ5Mi3A6Y0nnbghgZ9fQmriB4wDQYJKoZIhvcNAQEL
BQAwEDEOMAwGA1UEAwwFQXV0cmUwHhcNMjYxMTA3MDkwNTMxWhcNMzYxMTA0MDkw
NTMxWjAQMQ4wDAYDVQQDDAVBdXRyZTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCC
AQoCggEBAJckvaTEVlOL3xN1VhiMfniJYPIo/EOGyboiYnM/cEhT1ToAOt22YuDm
vWuNxVNeqLgKp+3ObmshiIp91prEQK9vQ6sFMGWk4HRz9Old/pizagWEnGzZ9F6k
NW0WeqKiaqhxNcxKAknA24KLE9VK+uPVpWrrNBM8dg8VpR9V5D8iaNrti8Pk9aPQ
I+mSnPy6qwDpIT5kbzK3cVis0CvxWT1JPgfW6EZeRhqBV6bogsFefZheUKreKy76
lYwfJLT0j+bIlo5dJ7ExXf+CKknohYld/PG4w1moKZD1tvPydtgcHtadSDwt6/tG
kjtzD06tsukuMamUbTOcagfvAJpcwj0CAwEAAaNTMFEwHQYDVR0OBBYEFPm00VN8
Su5LLO5YINscbdUcxOJVMB8GA1UdIwQYMBaAFPm00VN8Su5LLO5YINscbdUcxOJV
MA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAA3qKnmndI68fLcH
KbEAjnZWwlvxP6BhFtN5EaJkkWUR+ujd5vBc2JBmuklaLrg9CJtfbIqM9V+Jx0iY
Xuq+KPpIw7Q27/n1Wy9tCeQPsk34NXGJs/rISvdUoLDVQqMugPZMAtABddo8avkd
/efl548tKiA+GDvT6PuGbe4YSb5aC43zAATWC7OsPumK9Ri5GHJQkIEdZd0gkozb
5SjVJJ4T5GoXphsCxHn7eAsIavHLOi/l8StTiYRUfFxleh8Y1OOYUVE4jNBaCMIl
Mp9yX6pcggk84Mc4CxjsWzlO3qYXiT/mU0v9YAz5dFjRGLjyR1RxO+IGokWX+0CF
CT/gu10=
-----END CERTIFICATE-----
`;
const T_REEL = new Date("2026-11-07T00:55:11.000Z");

describe("horodatage RFC 3161 : requête", () => {
  it("encode une TimeStampReq DER : version 1, SHA-256, empreinte, nonce, certReq", () => {
    const r = construireRequete(EMPREINTE, NONCE);
    expect(r[0]).toBe(0x30);
    expect(r.subarray(2, 5)).toEqual(Buffer.from([0x02, 0x01, 0x01]));
    expect(r.includes(Buffer.from(EMPREINTE, "hex"))).toBe(true);
    expect(r.includes(OID_SHA256)).toBe(true);
    expect(r.subarray(r.length - 3)).toEqual(Buffer.from([0x01, 0x01, 0xff]));
  });

  it("préfixe d'un zéro un nonce dont le bit de poids fort est posé (entier positif)", () => {
    const r = construireRequete(EMPREINTE, Buffer.from("ff00000000000001", "hex"));
    expect(r.includes(Buffer.from("0209 00ff00000000000001".replace(" ", ""), "hex"))).toBe(true);
  });

  it("refuse une empreinte mal formée", () => {
    expect(() => construireRequete("zz", NONCE)).toThrow(ErreurHorodatage);
    expect(() => construireRequete(EMPREINTE.toUpperCase(), NONCE)).toThrow(ErreurHorodatage);
  });
});

describe("horodatage RFC 3161 : réponse", () => {
  it("accepte un jeton accordé qui porte sur notre empreinte et notre nonce", () => {
    const { genTime } = lireReponse(reponse({}), EMPREINTE, NONCE, MAINTENANT);
    expect(genTime.toISOString()).toBe("2026-11-07T10:00:05.000Z");
  });

  it("accepte « accordé avec modifications » (statut 1)", () => {
    expect(() => lireReponse(reponse({ statut: 1 }), EMPREINTE, NONCE, MAINTENANT)).not.toThrow();
  });

  it("refuse un statut de rejet", () => {
    expect(() => lireReponse(reponse({ statut: 2 }), EMPREINTE, NONCE, MAINTENANT)).toThrow(
      /refusé/,
    );
  });

  it("refuse un jeton qui ne porte pas sur notre empreinte", () => {
    expect(() =>
      lireReponse(reponse({ empreinteHex: "cd".repeat(32) }), EMPREINTE, NONCE, MAINTENANT),
    ).toThrow(/empreinte/);
  });

  it("refuse un nonce différent (rejeu d'une ancienne réponse)", () => {
    expect(() =>
      lireReponse(
        reponse({ nonce: Buffer.from("0102030405060709", "hex") }),
        EMPREINTE,
        NONCE,
        MAINTENANT,
      ),
    ).toThrow(/nonce/);
    expect(() => lireReponse(reponse({ sansNonce: true }), EMPREINTE, NONCE, MAINTENANT)).toThrow(
      /nonce/,
    );
  });

  it("refuse un instant hors tolérance d'horloge", () => {
    expect(() =>
      lireReponse(reponse({ genTime: "20261107090000Z" }), EMPREINTE, NONCE, MAINTENANT),
    ).toThrow(/tolérance/);
  });

  it("refuse une réponse tronquée ou vide, sans jamais lever autre chose qu'ErreurHorodatage", () => {
    const bon = reponse({});
    for (const mauvais of [
      Buffer.alloc(0),
      bon.subarray(0, 20),
      Buffer.from([0x30, 0x84, 1, 2, 3]),
    ]) {
      expect(() => lireReponse(mauvais, EMPREINTE, NONCE, MAINTENANT)).toThrow(ErreurHorodatage);
    }
  });

  it("lit les fractions de seconde du genTime", () => {
    expect(lireGeneralizedTime("20261107100005.25Z").toISOString()).toBe(
      "2026-11-07T10:00:05.250Z",
    );
    expect(() => lireGeneralizedTime("2026-11-07")).toThrow(ErreurHorodatage);
  });
});

describe("horodatage RFC 3161 : demande", () => {
  const demande = (fetcher: (u: string, i: RequestInit) => Promise<Response>, ancres = [CA_PEM]) =>
    demanderJeton({
      empreinteHex: HELLO,
      url: "https://tsa.exemple.test/tsr",
      maintenant: T_REEL,
      fetcher,
      nonce: NONCE_REEL,
      ancresPem: ancres,
    });

  it("POST la requête et rend le jeton brut vérifié, avec l'autorité", async () => {
    const fetcher = vi.fn(async (_u: string, init: RequestInit) => {
      expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
        "application/timestamp-query",
      );
      expect(init.method).toBe("POST");
      return new Response(new Uint8Array(REELLE), { status: 200 });
    });
    const r = await demande(fetcher);
    expect(r.autorite).toBe("https://tsa.exemple.test/tsr");
    expect(r.jeton.equals(REELLE)).toBe(true);
    expect(r.genTime.toISOString()).toBe("2026-11-07T00:55:11.000Z");
  });

  it("autorité injoignable ou en erreur : lève, sans détail réseau", async () => {
    await expect(
      demande(async () => {
        throw new Error("ECONNREFUSED 10.0.0.1:443");
      }),
    ).rejects.toThrow(/injoignable/);
    await expect(demande(async () => new Response("no", { status: 503 }))).rejects.toThrow(
      /HTTP 503/,
    );
  });

  it("un jeton dont la signature CMS ne se vérifie pas n'est JAMAIS « obtenu »", async () => {
    // Structure valide (empreinte, nonce, instant), mais aucune signature : refusé.
    await expect(
      demanderJeton({
        empreinteHex: EMPREINTE,
        url: "https://tsa.exemple.test/tsr",
        maintenant: MAINTENANT,
        fetcher: async () => new Response(new Uint8Array(reponse({})), { status: 200 }),
        nonce: NONCE,
        ancresPem: [CA_PEM],
      }),
    ).rejects.toThrow(ErreurHorodatage);
  });

  it("sans ancre de confiance, rien n'est accepté", async () => {
    await expect(
      demande(async () => new Response(new Uint8Array(REELLE), { status: 200 }), []),
    ).rejects.toThrow(/ancre/);
  });

  it("lit la réponse en flux et s'arrête au plafond, sans tout charger", async () => {
    let lus = 0;
    const flux = new ReadableStream<Uint8Array>({
      pull(controller) {
        lus++;
        controller.enqueue(new Uint8Array(16 * 1024));
        if (lus > 1000) controller.close();
      },
    });
    await expect(demande(async () => new Response(flux, { status: 200 }))).rejects.toThrow(
      /taille/,
    );
    expect(lus).toBeLessThan(10);
  });

  it("refuse d'emblée une réponse qui annonce une taille au-delà du plafond", async () => {
    await expect(
      demande(
        async () =>
          new Response(new Uint8Array(REELLE), {
            status: 200,
            headers: { "content-length": String(10 * 1024 * 1024) },
          }),
      ),
    ).rejects.toThrow(/taille/);
  });
});

describe("horodatage RFC 3161 : signature CMS et chaîne", () => {
  const ok = () => verifierJeton(REELLE, [CA_PEM], T_REEL);

  it("accepte le jeton réel : signature, usage timeStamping, chaîne jusqu'à l'ancre", () => {
    expect(ok).not.toThrow();
  });

  it("refuse si une ancre autre que l'émetteur est seule configurée", () => {
    expect(() => verifierJeton(REELLE, [AUTRE_PEM], T_REEL)).toThrow(/ancre|chaîne/);
    expect(() => verifierJeton(REELLE, [], T_REEL)).toThrow(/ancre/);
    expect(() => verifierJeton(REELLE, ["pas un pem"], T_REEL)).toThrow(ErreurHorodatage);
  });

  it("refuse un jeton dont le contenu horodaté a été altéré", () => {
    const altere = Buffer.from(REELLE);
    const pos = altere.indexOf(Buffer.from("20261107005511Z", "ascii"));
    expect(pos).toBeGreaterThan(0);
    altere[pos + 13] = "2".charCodeAt(0); // 005511Z → 005512Z
    expect(() => verifierJeton(altere, [CA_PEM], T_REEL)).toThrow(/signature|empreinte/);
  });

  it("refuse un jeton dont la signature a été altérée", () => {
    const altere = Buffer.from(REELLE);
    altere[altere.length - 5] = (altere[altere.length - 5] ?? 0) ^ 0xff;
    expect(() => verifierJeton(altere, [CA_PEM], T_REEL)).toThrow(/signature/);
  });

  it("refuse un certificat expiré ou pas encore valide à l'instant attesté", () => {
    expect(() => verifierJeton(REELLE, [CA_PEM], new Date("2026-11-20T00:00:00Z"))).toThrow(
      /validité/,
    );
    expect(() => verifierJeton(REELLE, [CA_PEM], new Date("2026-11-01T00:00:00Z"))).toThrow(
      /validité/,
    );
  });

  it("exige l'usage étendu timeStamping sur le certificat signataire", () => {
    expect(usageHorodatagePermis(new X509Certificate(CA_PEM))).toBe(true);
    expect(usageHorodatagePermis(new X509Certificate(AUTRE_PEM))).toBe(false);
  });
});

describe("horodatage RFC 3161 : réponse réelle", () => {
  it("lit le genTime d'une vraie réponse", () => {
    const { genTime } = lireReponse(
      REELLE,
      HELLO,
      NONCE_REEL,
      new Date("2026-11-07T00:55:11.000Z"),
    );
    expect(genTime.toISOString()).toBe("2026-11-07T00:55:11.000Z");
  });

  it("refuse la même réponse pour une autre empreinte ou un autre nonce", () => {
    const t = new Date("2026-11-07T00:55:11.000Z");
    expect(() => lireReponse(REELLE, "00".repeat(32), NONCE_REEL, t)).toThrow(/empreinte/);
    expect(() => lireReponse(REELLE, HELLO, Buffer.from("0000000000000001", "hex"), t)).toThrow(
      /nonce/,
    );
  });
});

describe("horodatage RFC 3161 : configuration", () => {
  const BASE = { HORODATAGE_TSA_URL: "https://autre.test/tsr", HORODATAGE_TSA_CA_PEM: CA_PEM };

  it("aucune autorité par défaut : sans URL posée, l'horodatage est coupé", () => {
    expect(configurationTsa({}).url).toBeNull();
    expect(configurationTsa({ HORODATAGE_TSA_CA_PEM: CA_PEM }).url).toBeNull();
    expect(configurationTsa({ HORODATAGE_TSA_URL: "  " }).url).toBeNull();
  });

  it("URL https + ancre : active ; coupure explicite prioritaire", () => {
    const c = configurationTsa(BASE);
    expect(c.url).toBe("https://autre.test/tsr");
    expect(c.ancresPem).toHaveLength(1);
    expect(configurationTsa({ ...BASE, HORODATAGE_DESACTIVE: "true" }).url).toBeNull();
  });

  it("sans ancre de confiance, rien n'est demandé (un jeton ne pourrait pas se vérifier)", () => {
    expect(configurationTsa({ HORODATAGE_TSA_URL: "https://autre.test/tsr" }).url).toBeNull();
  });

  it("http refusé en production, toléré hors production", () => {
    const http = { ...BASE, HORODATAGE_TSA_URL: "http://autre.test/tsr" };
    expect(configurationTsa({ ...http, NODE_ENV: "production" }).url).toBeNull();
    expect(configurationTsa({ ...http, NODE_ENV: "development" }).url).toBe(
      "http://autre.test/tsr",
    );
  });

  it("ignore un schéma exotique ou une valeur illisible, sans repli sur une autorité", () => {
    expect(configurationTsa({ ...BASE, HORODATAGE_TSA_URL: "file:///etc/passwd" }).url).toBeNull();
    expect(configurationTsa({ ...BASE, HORODATAGE_TSA_URL: "pas une url" }).url).toBeNull();
  });

  it("accepte plusieurs ancres, et des retours à la ligne écrits « \\n » dans la variable", () => {
    const deux = `${CA_PEM}\n${AUTRE_PEM}`;
    expect(configurationTsa({ ...BASE, HORODATAGE_TSA_CA_PEM: deux }).ancresPem).toHaveLength(2);
    const echappe = CA_PEM.replace(/\n/g, "\\n");
    expect(configurationTsa({ ...BASE, HORODATAGE_TSA_CA_PEM: echappe }).ancresPem).toHaveLength(1);
  });
});
