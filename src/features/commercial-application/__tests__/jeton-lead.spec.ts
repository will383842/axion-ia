/**
 * Jeton signé du tunnel apporteurs avec vidéo — ce qu'il prouve, et ce qu'il refuse.
 *
 * Il décide QUI peut compléter l'étape 2 : un jeton falsifié, expiré, signé par
 * une autre clé ou tronqué ne doit jamais ouvrir la ligne de quelqu'un.
 */
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { creerJeton, verifierJeton } from "../jeton-lead";
import {
  VALIDITE_JETON_MS,
  VALIDITE_JETON_REPRISE_MS,
} from "@/lib/commercial-application/vsl-apporteur";

const SECRET = "secret-de-test-assez-long-pour-signer";
const ancien = process.env["AUTH_SECRET"];

beforeEach(() => {
  process.env["AUTH_SECRET"] = SECRET;
});
afterEach(() => {
  if (ancien === undefined) delete process.env["AUTH_SECRET"];
  else process.env["AUTH_SECRET"] = ancien;
});

describe("jeton-lead", () => {
  it("un jeton frais se vérifie et rend ce qu'on y a mis", () => {
    const t = creerJeton({ lead: "11111111-1111-4111-8111-111111111111", maintenant: 1_000 });
    const c = verifierJeton(t, 2_000);
    expect(c).toMatchObject({
      lead: "11111111-1111-4111-8111-111111111111",
      genre: "saisie",
      iat: 1_000,
      suspect: false,
    });
  });

  it("vit 24 h, pas une seconde de plus", () => {
    const t = creerJeton({ lead: "x", maintenant: 0 });
    expect(verifierJeton(t, VALIDITE_JETON_MS - 1)).not.toBeNull();
    expect(verifierJeton(t, VALIDITE_JETON_MS + 1)).toBeNull();
  });

  it("le jeton de reprise (e-mails) vit 10 jours : il doit servir au dernier rappel", () => {
    const t = creerJeton({ lead: "x", genre: "reprise", maintenant: 0 });
    expect(verifierJeton(t, 8 * 24 * 3_600_000)).not.toBeNull();
    expect(verifierJeton(t, VALIDITE_JETON_REPRISE_MS + 1)).toBeNull();
  });

  it("refuse un jeton dont on a changé l'identifiant de ligne (jeton d'un autre)", () => {
    const t = creerJeton({ lead: "ligne-de-nadia", maintenant: 1_000 });
    const [corps, sig] = t.split(".") as [string, string];
    const contenu = JSON.parse(Buffer.from(corps, "base64url").toString("utf8")) as {
      lead: string;
    };
    contenu.lead = "ligne-de-quelquun-d-autre";
    const forge = `${Buffer.from(JSON.stringify(contenu)).toString("base64url")}.${sig}`;
    expect(verifierJeton(forge, 2_000)).toBeNull();
  });

  it("refuse un jeton signé avec une autre clé", () => {
    const t = creerJeton({ lead: "x", maintenant: 1_000 });
    process.env["AUTH_SECRET"] = "une-autre-cle-completement-differente";
    expect(verifierJeton(t, 2_000)).toBeNull();
  });

  it("refuse ce qui n'est pas un jeton, sans jamais lever", () => {
    for (const poubelle of ["", "abc", "a.b", "a.b.c", ".", "x".repeat(2000), "{}.{}"]) {
      expect(verifierJeton(poubelle)).toBeNull();
    }
  });

  it("garde le drapeau « suspect » (délai minimal inscrit dans le jeton)", () => {
    const t = creerJeton({ lead: "x", suspect: true, maintenant: 0 });
    expect(verifierJeton(t, 10)?.suspect).toBe(true);
  });

  it("ne porte ni adresse ni téléphone : il circule dans des liens d'e-mail", () => {
    const t = creerJeton({ lead: "11111111-1111-4111-8111-111111111111" });
    const corps = Buffer.from(t.split(".")[0] as string, "base64url").toString("utf8");
    expect(corps).not.toMatch(/@/);
    expect(Object.keys(JSON.parse(corps) as object).sort()).toEqual(
      ["exp", "genre", "iat", "lead", "suspect"].sort(),
    );
  });

  it("en production, sans clé de signature, refuse de signer au lieu d'utiliser le repli", () => {
    delete process.env["AUTH_SECRET"];
    const env = process.env as Record<string, string | undefined>;
    const ancienNodeEnv = env["NODE_ENV"];
    env["NODE_ENV"] = "production";
    try {
      expect(() => creerJeton({ lead: "x" })).toThrow();
    } finally {
      env["NODE_ENV"] = ancienNodeEnv;
    }
  });
});
