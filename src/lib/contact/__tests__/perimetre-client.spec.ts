// Le périmètre client — table de vérité.
//
// Ce prédicat décide de ce que le cockpit appelle une « demande ». Chaque ligne
// ci-dessous est un cas RÉEL de la table `submissions` : un faux positif gonfle
// l'entonnoir commercial (un candidat apporteur compté comme un prospect), un
// faux négatif fait disparaître un client de l'écran.

import { describe, it, expect } from "vitest";

import { TYPE_GROUPS } from "@/lib/schemas/unified-contact-schema";
import { PERIMETRE_CLIENT, estDemandeClient } from "../perimetre-client";

const APPORTEUR = { unifiedType: "recrutement", subType: "candidature-commerciale" };

describe("estDemandeClient — table de vérité", () => {
  const cas: Array<[string, Parameters<typeof estDemandeClient>[0], boolean]> = [
    ["dossier apporteur", { type: "contact", details: APPORTEUR }, false],
    [
      "dossier apporteur même sous un autre type (la règle apporteur passe AVANT le type)",
      { type: "quote_request", details: APPORTEUR },
      false,
    ],
    [
      "/contact « recrutement » sans subType",
      { type: "contact", details: { unifiedType: "recrutement" } },
      false,
    ],
    ["presse", { type: "contact", details: { unifiedType: "presse" } }, false],
    ["partenariat", { type: "contact", details: { unifiedType: "partenariat" } }, false],
    ["audit (formulaire unifié)", { type: "contact", details: { unifiedType: "audit" } }, true],
    ["devis qualifié", { type: "quote_request", details: {} }, true],
    [
      "rapport du simulateur",
      { type: "contact", details: { unifiedType: "simulateur_roi" } },
      true,
    ],
    ["support client", { type: "contact", details: { unifiedType: "support_client" } }, true],
    [
      "en corbeille, même une demande d'audit",
      { type: "contact", details: { unifiedType: "audit" }, deletedAt: new Date() },
      false,
    ],
    ["/contact sans unifiedType (ancien formulaire)", { type: "contact", details: {} }, false],
    ["/contact sans details du tout", { type: "contact", details: null }, false],
    ["clé `deletedAt` absente et type ≠ contact : gardée", { type: "audit", details: null }, true],
    ["details en tableau (JSON inattendu) sur un contact", { type: "contact", details: [] }, false],
  ];

  for (const [nom, ligne, attendu] of cas) {
    it(`${nom} → ${attendu ? "demande client" : "hors périmètre"}`, () => {
      expect(estDemandeClient(ligne)).toBe(attendu);
    });
  }
});

describe("PERIMETRE_CLIENT", () => {
  it("dérive le groupe « projet » du formulaire unifié, jamais ne le recopie", () => {
    // Un type ajouté au groupe « projet » doit entrer dans le périmètre sans
    // qu'on pense à revenir ici.
    for (const t of TYPE_GROUPS.projet) expect(PERIMETRE_CLIENT).toContain(t);
  });

  it("n'y fait entrer aucun type du groupe « autre » hormis le support client", () => {
    const intrus = TYPE_GROUPS.autre.filter(
      (t) => t !== "support_client" && (PERIMETRE_CLIENT as readonly string[]).includes(t),
    );
    expect(intrus).toEqual([]);
  });
});
