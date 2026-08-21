/**
 * 🔴 `D5-5-02` — l'export RGPD art. 15 rendait du CHIFFRÉ.
 *
 * `contactName`, `contactEmail` et `contactPhone` reçoivent des valeurs
 * chiffrées (`enc:v1:iv:ct:tag`, AES-256-GCM) dès que `PII_ENCRYPTION_KEY` est
 * active — le schéma Prisma le dit en toutes lettres. Elles partaient telles
 * quelles dans la réponse.
 *
 * La personne qui exerçait son droit d'accès recevait donc, à la place de son
 * nom et de son adresse, une centaine de caractères de charabia.
 *
 * 🔑 Un export illisible n'est pas un export : l'art. 12.1 exige une
 * communication « sous une forme concise, transparente, compréhensible ».
 *
 * ## Ce que ce fichier garde
 *
 * 1. `decryptPiiObject` rend bien le clair (aller-retour réel, avec clé) ;
 * 2. il est TOLÉRANT aux valeurs déjà en clair — c'est ce qui permet de le
 *    brancher sans migration de données ;
 * 3. la ROUTE l'appelle avant de répondre. Sans ce troisième cas, un refactor
 *    qui retirerait l'appel ne ferait rougir personne : les deux premiers
 *    testent la fonction, pas son branchement.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { encryptPii, decryptPiiObject } from "@/lib/pii-crypto";

/** 32 octets en hexadécimal — le format qu'exige `getKey`. */
const CLE = "a".repeat(64);
const ORIGINE = process.env["PII_ENCRYPTION_KEY"];

beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE;
});

afterEach(() => {
  if (ORIGINE === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = ORIGINE;
});

describe("🔴 D5-5-02 — l'export art. 15 doit être LISIBLE", () => {
  it("🔴 rend le nom et l'adresse en clair, pas `enc:v1:…`", () => {
    const chiffre = {
      id: "s-1",
      contactName: encryptPii("Alice Martin"),
      contactEmail: encryptPii("alice@example.com"),
      contactPhone: encryptPii("+33612345678"),
    };
    // Témoin de la mise en scène : sans lui, une clé mal posée rendrait le
    // « chiffré » identique au clair, et le cas passerait sans rien prouver.
    expect(chiffre.contactName, "la valeur de test n'est pas chiffrée").toMatch(/^enc:v1:/);

    const lisible = decryptPiiObject(chiffre);
    expect(lisible.contactName).toBe("Alice Martin");
    expect(lisible.contactEmail).toBe("alice@example.com");
    expect(lisible.contactPhone).toBe("+33612345678");
  });

  it("laisse intactes les valeurs DÉJÀ en clair", () => {
    // Les enregistrements antérieurs au chiffrement. C'est cette tolérance qui
    // permet de brancher la fonction sans migration de données — et si elle
    // manquait, l'export casserait sur l'historique au lieu de le rendre.
    const clair = { id: "s-2", contactName: "Bob Durand", contactEmail: "bob@example.com" };
    expect(decryptPiiObject(clair)).toEqual(clair);
  });

  it("ne touche pas aux champs qu'on ne lui a pas confiés", () => {
    const o = { id: "s-3", companyName: "ACME", contactName: encryptPii("Alice") };
    const r = decryptPiiObject(o);
    expect(r.id).toBe("s-3");
    expect(r.companyName).toBe("ACME");
  });

  it("🔴 la ROUTE déchiffre avant de répondre", () => {
    // Le cas qui garde le CONSTAT, et non la fonction. Les deux précédents
    // passeraient encore si l'appel disparaissait de la route — c'était
    // précisément la situation d'origine : `decryptPiiObject` existait dans
    // `lib/pii-crypto.ts` et n'était utilisé par PERSONNE.
    const source = readFileSync(
      join(process.cwd(), "src", "app", "api", "gdpr-export", "route.ts"),
      "utf8",
    );
    // Commentaires dépouillés : ce fichier-ci comme la route parlent
    // abondamment de `decryptPiiObject` en prose, et un test statique qui
    // trouverait ses propres explications serait un faux positif.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ""))
      .replace(/^[ \t]*\/\/.*$/gm, "");

    expect(code, "la route n'importe plus le déchiffreur").toContain("decryptPiiObject");
    // L'appel, pas seulement l'import : un import mort passerait le test
    // précédent — c'est le défaut que `assertion-flag-surfaces.spec.ts` a déjà
    // payé dans ce dépôt.
    expect(code, "l'import est là mais la fonction n'est pas appelée").toMatch(
      /decryptPiiObject\s*\(/,
    );
  });
});
