/**
 * Tests — le recalcul suit la version DE LA LIGNE, jamais la version courante.
 *
 * ## Pourquoi un fichier à part
 *
 * Ce contrat est invérifiable tant qu'une seule version existe : aujourd'hui
 * `HASH_VERSION_COURANTE === 1` et toutes les lignes sont en 1, donc remplacer
 * `ligne.hashVersion` par `HASH_VERSION_COURANTE` dans `maillonDepuisLigne` ne
 * fait échouer AUCUN test — mutation vérifiée, elle survit aux 122 tests du
 * domaine.
 *
 * Ce qu'elle coûterait le jour où la forme change : `verifierChaine`
 * recalculerait les empreintes de TOUT l'historique avec le nouveau
 * sérialiseur, et rendrait donc `empreinte_invalide` sur chaque signature déjà
 * émise. Soit, dans un dossier d'audit, le verdict « les feuilles ont été
 * modifiées après coup » — sur des pièces parfaitement intactes. C'est
 * exactement le risque que le registre de sérialiseurs existe pour écarter.
 *
 * Le seul moyen de l'épingler dès maintenant est de faire exister une seconde
 * version : `./hash` est donc remplacé ici par un double qui en connaît deux.
 * `vi.mock` étant hissé au fichier, ce doublage vit dans un fichier dédié pour
 * ne contaminer aucune autre suite.
 */

import { describe, it, expect, vi } from "vitest";

/** Empreintes distinctes par version — c'est ce qui rend le test discriminant. */
const calculerSelfHashDouble = vi.fn(
  (_t: unknown, version = 1): string => `hash-v${String(version)}`,
);

vi.mock("./hash", async (importOriginal) => {
  const original = await importOriginal<typeof import("./hash")>();
  return {
    ...original,
    // Un registre à DEUX versions : sans cela, `tupleDepuisLigne` refuserait la
    // ligne v2 avant même d'atteindre le recalcul.
    versionRecalculable: (v: number) => v === 1 || v === 2,
    calculerSelfHash: (t: unknown, version?: number) => calculerSelfHashDouble(t, version),
  };
});

import { maillonDepuisLigne, type LigneSignature } from "./reconstruction";

function ligne(hashVersion: number): LigneSignature {
  return {
    id: "sig-1",
    contexteType: "collectif",
    enrollmentId: "22222222-2222-4222-8222-222222222222",
    coachingId: null,
    creneauId: "11111111-1111-4111-8111-111111111111",
    signataireNom: "Alice Dupont",
    signataireEmail: "alice@example.com",
    date: new Date("2026-06-10T00:00:00.000Z"),
    demiJournee: "matin",
    heureDebut: "09:00",
    heureFin: "12:30",
    formateurNom: "Williams Jullin",
    formationIntitule: "Bien démarrer avec l'IA",
    modulesSnapshot: ["Module 1"],
    methode: "canvas",
    signatureSha256: "a".repeat(64),
    signeAt: new Date("2026-06-10T10:15:30.123Z"),
    ipHash: "0123456789abcdef",
    userAgentSha256: "b".repeat(64),
    mentionVersion: "v1",
    prevHash: null,
    selfHash: "",
    hashVersion,
  };
}

describe("maillonDepuisLigne — recalcul par version", () => {
  it("🔴 recalcule une ligne v1 avec le sérialiseur v1, pas avec la version courante", () => {
    calculerSelfHashDouble.mockClear();
    expect(maillonDepuisLigne(ligne(1)).recalculer()).toBe("hash-v1");
    expect(calculerSelfHashDouble.mock.calls[0]?.[1]).toBe(1);
  });

  it("🔴 recalcule une ligne v2 avec le sérialiseur v2 — c'est ici que le mutant meurt", () => {
    // Forcer `HASH_VERSION_COURANTE` produirait « hash-v1 » : tout l'historique
    // v2 basculerait en `empreinte_invalide` au premier changement de forme.
    calculerSelfHashDouble.mockClear();
    expect(maillonDepuisLigne(ligne(2)).recalculer()).toBe("hash-v2");
    expect(calculerSelfHashDouble.mock.calls[0]?.[1]).toBe(2);
  });

  it("n'appelle pas le sérialiseur quand le tuple n'est pas reconstructible", () => {
    // Version hors registre : la ligne est déclarée irrecalculable AVANT tout
    // hachage — `verifierChaine` en fera une anomalie `tuple_irrecalculable`,
    // jamais une empreinte inventée.
    calculerSelfHashDouble.mockClear();
    expect(maillonDepuisLigne(ligne(99)).recalculer()).toBeNull();
    expect(calculerSelfHashDouble).not.toHaveBeenCalled();
  });
});
