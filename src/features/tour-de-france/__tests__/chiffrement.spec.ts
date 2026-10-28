import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  encryptPii: vi.fn((v: string, _options?: unknown) => `enc:${v}`),
  decryptPii: vi.fn((v: string, _options?: unknown) => v.replace(/^enc:/, "")),
}));
vi.mock("@/lib/pii-crypto", () => ({ encryptPii: m.encryptPii, decryptPii: m.decryptPii }));

import {
  LIBELLE_CLE_DOMAINE,
  LIBELLE_CLE_PERSONNE,
  LIBELLE_CLE_TELEPHONE,
  VALEUR_ILLISIBLE,
  chiffrerChamp,
  dechiffrerChamp,
  empreinteTour,
  lireChamp,
} from "../chiffrement";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("chiffrement : clé exigée et donnée authentifiée liée au champ", () => {
  it("chiffre et déchiffre avec la clé exigée et `tour_demandes:<champ>`", () => {
    chiffrerChamp("telephone", "0612345678");
    expect(m.encryptPii).toHaveBeenCalledWith("0612345678", {
      cleExigee: true,
      aad: "tour_demandes:telephone",
    });
    expect(dechiffrerChamp("nom", "enc:Alice")).toBe("Alice");
    expect(m.decryptPii).toHaveBeenCalledWith("enc:Alice", {
      cleExigee: true,
      aad: "tour_demandes:nom",
    });
  });

  it("`lireChamp` ne lève jamais : une valeur illisible vaut « illisible »", () => {
    m.decryptPii.mockImplementationOnce(() => {
      throw new Error("donnée altérée");
    });
    expect(lireChamp("email", "enc:x")).toBe(VALEUR_ILLISIBLE);
    expect(lireChamp("email", "enc:x@exemple.fr")).toBe("x@exemple.fr");
  });

  it("`dechiffrerChamp` lève, lui, quand la valeur est illisible (l'appelant décide)", () => {
    m.decryptPii.mockImplementationOnce(() => {
      throw new Error("donnée altérée");
    });
    expect(() => dechiffrerChamp("email", "enc:x")).toThrow("donnée altérée");
  });
});

describe("chiffrement : empreintes de comptage (HMAC)", () => {
  it("est déterministe, en hexadécimal sur 64 caractères", () => {
    const a = empreinteTour(LIBELLE_CLE_PERSONNE, "alice@societe-exemple.fr");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(empreinteTour(LIBELLE_CLE_PERSONNE, "alice@societe-exemple.fr")).toBe(a);
  });

  it("sépare les domaines : même valeur, trois libellés, trois empreintes", () => {
    const valeur = "612345678";
    const trois = [LIBELLE_CLE_PERSONNE, LIBELLE_CLE_DOMAINE, LIBELLE_CLE_TELEPHONE].map((l) =>
      empreinteTour(l, valeur),
    );
    expect(new Set(trois).size).toBe(3);
  });

  it("dépend de la clé du serveur", () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", "a".repeat(64));
    const a = empreinteTour(LIBELLE_CLE_TELEPHONE, "612345678");
    vi.stubEnv("PII_ENCRYPTION_KEY", "b".repeat(64));
    const b = empreinteTour(LIBELLE_CLE_TELEPHONE, "612345678");
    expect(a).not.toBe(b);
  });

  it("LÈVE en production sans clé (jamais une empreinte avec la clé de développement)", () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => empreinteTour(LIBELLE_CLE_PERSONNE, "x")).toThrow("PII_ENCRYPTION_KEY");
  });
});
