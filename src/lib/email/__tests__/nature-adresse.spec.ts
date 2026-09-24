// @vitest-environment node
//
// La liste FERMÉE des webmails grand public (amendement de Will du 24/09).
// Testée par DOMAINE seulement : aucune adresse, même fictive, sur un domaine
// de messagerie réel (dépôt public).
//
// ⚖️ Le sens de l'erreur tolérable : une adresse perso prise pour une pro serait
// inscrite sans son accord. Le doute penche vers « perso ».

import { describe, expect, it } from "vitest";

import {
  DOMAINES_WEBMAIL,
  FAMILLES_WEBMAIL,
  natureAdresse,
  natureDuDomaine,
} from "../nature-adresse";

describe("natureDuDomaine", () => {
  it("les domaines de l'amendement sont tous « perso »", () => {
    const amendement = [
      "gmail.com",
      "googlemail.com",
      "hotmail.fr",
      "hotmail.com",
      "outlook.fr",
      "outlook.com",
      "live.fr",
      "live.com",
      "msn.com",
      "yahoo.fr",
      "yahoo.com",
      "icloud.com",
      "me.com",
      "orange.fr",
      "wanadoo.fr",
      "free.fr",
      "sfr.fr",
      "laposte.net",
      "gmx.fr",
      "gmx.de",
      "proton.me",
      "protonmail.com",
      "aol.com",
    ];
    for (const d of amendement) expect(natureDuDomaine(d), d).toBe("perso");
  });

  it("les familles valent sur une extension à deux labels (`co.uk`, `com.br`)", () => {
    expect(natureDuDomaine("hotmail.co.uk")).toBe("perso");
    expect(natureDuDomaine("yahoo.com.br")).toBe("perso");
  });

  it("un domaine d'organisation est « pro »", () => {
    expect(natureDuDomaine("example.invalid")).toBe("pro");
    expect(natureDuDomaine("axion-ia.com")).toBe("pro");
  });

  it("🔴 un sous-domaine d'organisation qui commence par un nom de famille reste « pro »", () => {
    // `outlook.<organisation>.com` n'est pas Outlook grand public.
    expect(natureDuDomaine("outlook.example-organisation.com")).toBe("pro");
    expect(natureDuDomaine("live.example-organisation.fr")).toBe("pro");
  });

  it("dans le doute (domaine vide ou sans point), « perso » : on demande l'accord", () => {
    expect(natureDuDomaine("")).toBe("perso");
    expect(natureDuDomaine("localhost")).toBe("perso");
  });

  it("la liste est en minuscules et sans doublon avec les familles", () => {
    for (const d of DOMAINES_WEBMAIL) {
      expect(d).toBe(d.toLowerCase());
      expect(FAMILLES_WEBMAIL.has(d.split(".")[0] ?? "")).toBe(false);
    }
  });
});

describe("natureAdresse", () => {
  it("lit le domaine après le DERNIER @, sans tenir compte de la casse ni des espaces", () => {
    expect(natureAdresse("  jeanne@EXAMPLE.invalid ")).toBe("pro");
    expect(natureAdresse("sans-arobase")).toBe("perso");
  });
});
