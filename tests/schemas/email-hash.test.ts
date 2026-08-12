// Index de recherche des e-mails chiffrés (RGPD art. 15 et 17).
//
// ── Ce que ce fichier protège ─────────────────────────────────────────────
// Le 2026-08-12, l'export et l'effacement RGPD étaient MUETS en production :
// ils cherchaient `contactEmail = "jean@exemple.fr"` sur une colonne chiffrée
// en AES-GCM avec un vecteur d'initialisation aléatoire. Aucune correspondance
// possible — et les deux répondaient « succès ».
//
// La propriété qui rend la recherche possible est le DÉTERMINISME : la même
// adresse doit toujours produire la même empreinte, quelles que soient la
// casse et les espaces. Si quelqu'un modifie la normalisation ou le domaine de
// séparation sans refaire tourner le remplissage rétroactif, la recherche
// redevient muette — silencieusement. Ces tests le disent.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { hashEmailForLookup, normalizeEmail } from "@/lib/security/email-hash";

const CLE = "a".repeat(64);

// `vi.stubEnv` plutôt qu'une écriture directe : `NODE_ENV` est en lecture seule
// dans les types Node, et `unstubAllEnvs` restitue l'état d'origine même si un
// test échoue en cours de route.
beforeEach(() => {
  vi.stubEnv("PII_ENCRYPTION_KEY", CLE);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("normalizeEmail", () => {
  it("met en minuscules et retire les espaces de bord", () => {
    expect(normalizeEmail("  Jean.Dupont@Exemple.FR  ")).toBe("jean.dupont@exemple.fr");
  });

  it("ne touche pas à un e-mail déjà normalisé", () => {
    expect(normalizeEmail("jean@exemple.fr")).toBe("jean@exemple.fr");
  });
});

describe("hashEmailForLookup", () => {
  it("est DÉTERMINISTE — c'est toute la raison d'être de cette colonne", () => {
    const a = hashEmailForLookup("jean@exemple.fr");
    const b = hashEmailForLookup("jean@exemple.fr");
    expect(a).toBe(b);
    expect(a).not.toBeNull();
  });

  it("ignore la casse et les espaces, comme la colonne citext", () => {
    // Sans cela, un visiteur qui tape « Jean@Exemple.FR » à la demande
    // d'effacement ne retrouverait pas la ligne écrite en « jean@exemple.fr ».
    const reference = hashEmailForLookup("jean@exemple.fr");
    expect(hashEmailForLookup("JEAN@EXEMPLE.FR")).toBe(reference);
    expect(hashEmailForLookup("  Jean@Exemple.fr ")).toBe(reference);
  });

  it("distingue deux adresses différentes", () => {
    expect(hashEmailForLookup("jean@exemple.fr")).not.toBe(hashEmailForLookup("paul@exemple.fr"));
  });

  it("rend 64 caractères hexadécimaux — SHA-256 entier, jamais tronqué", () => {
    // `hashIp` tronque à 64 bits car une collision y est sans conséquence. Ici
    // une collision livrerait les données d'une personne à une autre lors d'un
    // export RGPD : on garde les 256 bits.
    const h = hashEmailForLookup("jean@exemple.fr");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ne rend jamais l'adresse en clair, même partiellement", () => {
    const h = hashEmailForLookup("jean@exemple.fr") ?? "";
    expect(h).not.toContain("jean");
    expect(h).not.toContain("exemple");
    expect(h).not.toContain("@");
  });

  it("dépend de la clé — un dump de base sans le secret est inexploitable", () => {
    const avec = hashEmailForLookup("jean@exemple.fr");
    vi.stubEnv("PII_ENCRYPTION_KEY", "b".repeat(64));
    expect(hashEmailForLookup("jean@exemple.fr")).not.toBe(avec);
  });

  it("rend null sur une entrée vide plutôt qu'une empreinte de chaîne vide", () => {
    // Une empreinte de "" correspondrait à TOUTES les lignes sans e-mail.
    expect(hashEmailForLookup("")).toBeNull();
    expect(hashEmailForLookup("   ")).toBeNull();
    expect(hashEmailForLookup(null)).toBeNull();
    expect(hashEmailForLookup(undefined)).toBeNull();
  });

  it("refuse de calculer en production sans clé, au lieu de produire du faux", () => {
    // Une empreinte calculée avec la clé de développement serait
    // silencieusement incompatible avec les lignes existantes : la recherche
    // redeviendrait muette, exactement le défaut d'origine.
    vi.stubEnv("PII_ENCRYPTION_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => hashEmailForLookup("jean@exemple.fr")).toThrow(/PII_ENCRYPTION_KEY/);
  });

  it("tolère l'absence de clé hors production, pour ne pas casser le développement", () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", "");
    vi.stubEnv("NODE_ENV", "test");
    expect(hashEmailForLookup("jean@exemple.fr")).toMatch(/^[0-9a-f]{64}$/);
  });
});
