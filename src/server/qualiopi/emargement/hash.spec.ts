/**
 * Tests — hash.ts
 *
 * Deux propriétés à protéger :
 *   · le hash change dès que N'IMPORTE QUEL champ probant change ;
 *   · la vérification de chaîne détecte modification, insertion et suppression.
 */

import { describe, it, expect } from "vitest";
import {
  calculerSelfHash,
  tupleCanonique,
  verifierChaine,
  HASH_VERSION_COURANTE,
  type TupleSignatureV1,
  type MaillonChaine,
} from "./hash";

function tuple(overrides: Partial<TupleSignatureV1> = {}): TupleSignatureV1 {
  return {
    contexteType: "collectif",
    enrollmentId: "22222222-2222-4222-8222-222222222222",
    creneauId: "11111111-1111-4111-8111-111111111111",
    coachingId: null,
    date: "2026-06-10",
    demiJournee: "matin",
    heureDebut: "09:00",
    heureFin: "12:30",
    formationIntitule: "Bien démarrer avec l'IA",
    modules: ["Module 1 — Fondamentaux", "Module 2 — Prompts"],
    formateurNom: "Williams Jullin",
    signataireNom: "Alice Dupont",
    signataireEmail: "alice@example.com",
    methode: "canvas",
    signatureSha256: "a".repeat(64),
    signeAtIso: "2026-06-10T10:15:30.123Z",
    ipHash: "0123456789abcdef",
    userAgentSha256: "b".repeat(64),
    mentionVersion: "v1",
    prevHash: null,
    ...overrides,
  };
}

describe("VECTEUR D'OR — la forme canonique est figée", () => {
  // 🔴 Le test le plus important du module, et il manquait.
  //
  // Sans lui, QUATRE mutations changeant la forme canonique passaient les 88
  // tests : renommer la clé `signeAt` en `signeAtIso`, hacher en `latin1` au
  // lieu d'`utf8`, formater la date en heure locale, accepter un `prevHash` nul
  // en milieu de chaîne. Chacune rend DÉFINITIVEMENT fausses toutes les
  // empreintes déjà en base — sur une table append-only conservée 5 ans.
  //
  // Ces deux littéraux sont donc un contrat. S'ils changent, ce n'est jamais un
  // test à mettre à jour : c'est `HASH_VERSION_COURANTE` à incrémenter, avec un
  // chemin de recalcul pour l'historique.
  // Littéral gabarit : la chaîne contient des apostrophes ET des guillemets.
  const CANONIQUE_ATTENDUE = `{"coachingId":null,"contexteType":"collectif","creneauId":"11111111-1111-4111-8111-111111111111","date":"2026-06-10","demiJournee":"matin","enrollmentId":"22222222-2222-4222-8222-222222222222","formateurNom":"Williams Jullin","formationIntitule":"Bien démarrer avec l'IA","heureDebut":"09:00","heureFin":"12:30","ipHash":"0123456789abcdef","mentionVersion":"v1","methode":"canvas","modules":["Module 1 — Fondamentaux","Module 2 — Prompts"],"prevHash":null,"signataireEmail":"alice@example.com","signataireNom":"Alice Dupont","signatureSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","signeAt":"2026-06-10T10:15:30.123Z","userAgentSha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","v":1}`;
  const HASH_ATTENDU = "1a0ff9e7d1293de4c563d9218f2e884aa9e37c515081866d75a241eb207dcaf5";

  it("produit EXACTEMENT cette chaîne canonique", () => {
    expect(tupleCanonique(tuple())).toBe(CANONIQUE_ATTENDUE);
  });

  it("produit EXACTEMENT cette empreinte", () => {
    expect(calculerSelfHash(tuple())).toBe(HASH_ATTENDU);
  });

  it("les clés sont triées par point de code, pas par locale", () => {
    // `localeCompare` placerait « é » avant « z ». La RFC 8785 impose l'ordre
    // des points de code UTF-16, celui de `Array.prototype.sort()` par défaut.
    const clefs = [...tupleCanonique(tuple()).matchAll(/"([a-zA-Z]+)":/g)].map((m) => m[1]);
    expect(clefs).toEqual([...clefs].sort());
  });
});

describe("calculerSelfHash", () => {
  it("produit un SHA-256 hex de 64 caractères", () => {
    expect(calculerSelfHash(tuple())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("est déterministe", () => {
    expect(calculerSelfHash(tuple())).toBe(calculerSelfHash(tuple()));
  });

  it("ne dépend pas de l'ordre de construction de l'objet", () => {
    const t = tuple();
    // Même contenu, clés réinsérées dans un autre ordre.
    const melange = Object.fromEntries(Object.entries(t).reverse()) as unknown as TupleSignatureV1;
    expect(calculerSelfHash(melange)).toBe(calculerSelfHash(t));
  });

  describe("sensibilité — chaque champ probant DOIT changer l'empreinte", () => {
    const base = calculerSelfHash(tuple());
    const variantes: Array<[string, Partial<TupleSignatureV1>]> = [
      ["identité du signataire", { signataireNom: "Alice Dupond" }],
      ["email du signataire", { signataireEmail: "autre@example.com" }],
      ["horaire de début", { heureDebut: "09:01" }],
      ["horaire de fin", { heureFin: "12:31" }],
      ["date", { date: "2026-06-11" }],
      ["demi-journée", { demiJournee: "apres_midi" }],
      ["intitulé de formation", { formationIntitule: "Autre formation" }],
      ["modules", { modules: ["Module 1 — Fondamentaux"] }],
      ["ORDRE des modules", { modules: ["Module 2 — Prompts", "Module 1 — Fondamentaux"] }],
      ["nom du formateur", { formateurNom: "Autre Formateur" }],
      ["méthode", { methode: "papier_scanne" }],
      ["empreinte de l'image", { signatureSha256: "c".repeat(64) }],
      ["horodatage à la milliseconde", { signeAtIso: "2026-06-10T10:15:30.124Z" }],
      ["hash d'IP", { ipHash: "ffffffffffffffff" }],
      ["hash de user-agent", { userAgentSha256: "d".repeat(64) }],
      ["version de mention", { mentionVersion: "v2" }],
      ["maillon précédent", { prevHash: "e".repeat(64) }],
      ["créneau", { creneauId: "22222222-2222-4222-8222-222222222222" }],
      ["contexte", { contexteType: "afest_1to1" }],
    ];

    for (const [libelle, patch] of variantes) {
      it(`changer ${libelle} change l'empreinte`, () => {
        expect(calculerSelfHash(tuple(patch))).not.toBe(base);
      });
    }

    it("toutes les variantes produisent des empreintes DISTINCTES entre elles", () => {
      // Écarte une implémentation qui ignorerait plusieurs champs à la fois.
      const hashes = new Set(variantes.map(([, p]) => calculerSelfHash(tuple(p))));
      expect(hashes.size).toBe(variantes.length);
    });
  });

  it("distingue une signature sans image d'une signature dont l'image est vide", () => {
    expect(calculerSelfHash(tuple({ signatureSha256: null }))).not.toBe(
      calculerSelfHash(tuple({ signatureSha256: "" })),
    );
  });

  it("le tuple canonique porte la version — un changement de forme sera détectable", () => {
    expect(tupleCanonique(tuple())).toContain(`"v":${HASH_VERSION_COURANTE}`);
  });
});

describe("verifierChaine", () => {
  /** Construit une chaîne saine de n maillons. */
  /** Tuple du i-ème maillon de `chaineSaine`, reconstruit à l'identique. */
  function tupleDuMaillon(i: number): TupleSignatureV1 {
    let prev: string | null = null;
    for (let k = 0; k < i; k++) {
      prev = calculerSelfHash(
        tuple({
          prevHash: prev,
          signeAtIso: `2026-06-10T1${k}:00:00.000Z`,
          creneauId: `1111111${k}-1111-4111-8111-111111111111`,
        }),
      );
    }
    return tuple({
      prevHash: prev,
      signeAtIso: `2026-06-10T1${i}:00:00.000Z`,
      creneauId: `1111111${i}-1111-4111-8111-111111111111`,
    });
  }

  function chaineSaine(n: number): MaillonChaine[] {
    const maillons: MaillonChaine[] = [];
    let prev: string | null = null;
    for (let i = 0; i < n; i++) {
      const t = tuple({
        prevHash: prev,
        signeAtIso: `2026-06-10T1${i}:00:00.000Z`,
        creneauId: `1111111${i}-1111-4111-8111-111111111111`,
      });
      const self = calculerSelfHash(t);
      maillons.push({
        id: `sig-${i}`,
        prevHash: prev,
        selfHash: self,
        hashVersion: 1,
        recalculer: () => calculerSelfHash(t),
      });
      prev = self;
    }
    return maillons;
  }

  it("valide une chaîne saine", () => {
    const r = verifierChaine(chaineSaine(4));
    expect(r.valide).toBe(true);
    expect(r.anomalies).toEqual([]);
    expect(r.nbVerifies).toBe(4);
  });

  it("valide une chaîne vide et une chaîne d'un seul maillon", () => {
    expect(verifierChaine([]).valide).toBe(true);
    expect(verifierChaine(chaineSaine(1)).valide).toBe(true);
  });

  it("détecte une donnée MODIFIÉE après signature", () => {
    const c = chaineSaine(3);
    // L'heure de fin est repoussée : on facture une demi-journée plus longue.
    // On altère le CONTENU sans toucher au `selfHash` déjà stocké : c'est
    // exactement ce que ferait un UPDATE en base.
    const altere = tuple({ ...tupleDuMaillon(1), heureFin: "13:30" });
    c[1] = { ...c[1]!, recalculer: () => calculerSelfHash(altere) };
    const r = verifierChaine(c);
    expect(r.valide).toBe(false);
    expect(r.anomalies.some((a) => a.type === "empreinte_invalide" && a.id === "sig-1")).toBe(true);
  });

  it("détecte une signature SUPPRIMÉE au milieu", () => {
    const c = chaineSaine(4);
    c.splice(2, 1);
    const r = verifierChaine(c);
    expect(r.valide).toBe(false);
    expect(r.anomalies.some((a) => a.type === "rupture_chainage")).toBe(true);
  });

  it("détecte une signature SUPPRIMÉE en tête de chaîne", () => {
    const c = chaineSaine(3);
    c.shift();
    const r = verifierChaine(c);
    expect(r.valide).toBe(false);
    expect(r.anomalies[0]?.type).toBe("premier_maillon_chaine");
  });

  it("détecte une signature INSÉRÉE après coup", () => {
    const c = chaineSaine(3);
    const intrus = tuple({ signataireNom: "Intrus", prevHash: c[0]!.selfHash });
    c.splice(1, 0, {
      id: "sig-intrus",
      prevHash: c[0]!.selfHash,
      selfHash: calculerSelfHash(intrus),
      hashVersion: 1,
      recalculer: () => calculerSelfHash(intrus),
    });
    const r = verifierChaine(c);
    // Le maillon suivant pointe toujours sur l'ancien précédent → rupture.
    expect(r.valide).toBe(false);
    expect(r.anomalies.some((a) => a.type === "rupture_chainage")).toBe(true);
  });

  it("signale une version de tuple qu'on ne sait plus recalculer", () => {
    const c = chaineSaine(1);
    c[0] = { ...c[0]!, hashVersion: 99 };
    const r = verifierChaine(c);
    expect(r.valide).toBe(false);
    expect(r.anomalies[0]?.type).toBe("version_inconnue");
  });

  it("signale un tuple non reconstructible sans le confondre avec une fraude", () => {
    const c = chaineSaine(1);
    c[0] = { ...c[0]!, recalculer: () => null };
    const r = verifierChaine(c);
    expect(r.anomalies[0]?.type).toBe("tuple_irrecalculable");
  });

  it("NE LÈVE JAMAIS — une chaîne corrompue est un résultat, pas une panne", () => {
    const pourri: MaillonChaine[] = [
      { id: "x", prevHash: "zzz", selfHash: "", hashVersion: 0, recalculer: () => null },
    ];
    expect(() => verifierChaine(pourri)).not.toThrow();
    expect(verifierChaine(pourri).valide).toBe(false);
  });
});
