/**
 * Tests — seance-signature-hash.ts (AFEST 1-to-1).
 *
 * Même exigence que les deux chaînes du chemin collectif : sans vecteur d'or ni
 * matrice de falsification, une mutation qui change la forme canonique passe
 * sous les tests fonctionnels sans rien casser de visible — et n'est découverte
 * qu'au contrôle, quand plus rien n'est corrigeable.
 *
 * Deux cas ici ne sont pas du remplissage :
 *   · le ROUND-TRIP « 23:30 heure de Paris », où le jour civil de Paris et le
 *     jour UTC diffèrent ;
 *   · la NON-inclusion d'`ipHash` / `userAgentSha256` dans le tuple, qui est ce
 *     qui rend un effacement RGPD compatible avec des empreintes valides.
 */

import { describe, it, expect } from "vitest";
import { verifierChaine } from "@/server/qualiopi/emargement/hash";
import { parisDateISO } from "@/server/qualiopi/presence/time";
import {
  tupleSeanceCanonique,
  calculerSelfHashSeance,
  tupleSeanceDepuisLigne,
  maillonSeanceDepuisLigne,
  versionSeanceRecalculable,
  HASH_VERSION_SEANCE,
  type TupleSeanceSignatureV1,
  type LigneSeanceSignature,
} from "./seance-signature-hash";
import {
  COLONNES_SCELLEES_SEANCE,
  jourCivilSeance,
  dateSeanceDepuisJourParis,
} from "./seance-reconstruction";

const COACHING = "11111111-1111-4111-8111-111111111111";
const SEANCE = "22222222-2222-4222-8222-222222222222";

function tuple(over: Partial<TupleSeanceSignatureV1> = {}): TupleSeanceSignatureV1 {
  return {
    contexteType: "afest_seance",
    coachingId: COACHING,
    compteRenduSeanceId: SEANCE,
    role: "beneficiaire",
    seanceDate: "2026-06-10",
    heureDebut: "09:00",
    heureFin: "11:30",
    formationIntitule: "Accompagnement IA individuel",
    modules: ["Cartographie de l'activité", "Mise en situation"],
    formateurNom: "Williams Jullin",
    signataireNom: "Camille Durand",
    signataireEmail: "camille.durand@example.test",
    methode: "trace",
    mentionVersion: "afest-v1",
    signatureSha256: "a".repeat(64),
    signeAtIso: "2026-06-10T09:35:12.345Z",
    prevHash: null,
    ...over,
  };
}

function ligne(over: Partial<LigneSeanceSignature> = {}): LigneSeanceSignature {
  return {
    id: "99999999-9999-4999-8999-999999999999",
    coachingId: COACHING,
    compteRenduSeanceId: SEANCE,
    role: "beneficiaire",
    seanceDate: new Date("2026-06-10T00:00:00.000Z"),
    heureDebut: "09:00",
    heureFin: "11:30",
    formationIntitule: "Accompagnement IA individuel",
    modulesSnapshot: ["Cartographie de l'activité", "Mise en situation"],
    formateurNom: "Williams Jullin",
    signataireNom: "Camille Durand",
    signataireEmail: "camille.durand@example.test",
    methode: "trace",
    mentionVersion: "afest-v1",
    signatureSha256: "a".repeat(64),
    signeAt: new Date("2026-06-10T09:35:12.345Z"),
    prevHash: null,
    selfHash: "",
    hashVersion: HASH_VERSION_SEANCE,
    ...over,
  };
}

/** Scelle une ligne : calcule son `selfHash` réel depuis son propre tuple. */
function scellee(over: Partial<LigneSeanceSignature> = {}): LigneSeanceSignature {
  const l = ligne(over);
  const t = tupleSeanceDepuisLigne(l);
  if (t === null) throw new Error("ligne de test non recalculable");
  return { ...l, selfHash: calculerSelfHashSeance(t, l.hashVersion) };
}

describe("tupleSeanceCanonique", () => {
  it("trie les clés et n'insère aucun espace", () => {
    const canon = tupleSeanceCanonique(tuple());
    expect(canon.startsWith("{")).toBe(true);
    // Aucune espace STRUCTURELLE (les valeurs, elles, en contiennent
    // légitimement : « Cartographie de l'activité »).
    expect(canon).not.toMatch(/[:,{[]\s/);
    const cles = [...canon.matchAll(/"([a-zA-Z]+)":/g)].map((m) => m[1]);
    expect(cles).toStrictEqual([...cles].sort());
  });

  it("est stable — le même tuple produit toujours la même chaîne", () => {
    expect(tupleSeanceCanonique(tuple())).toBe(tupleSeanceCanonique(tuple()));
  });

  it("porte le discriminant `afest_seance`, distinct du contexte collectif", () => {
    expect(tupleSeanceCanonique(tuple())).toContain('"contexteType":"afest_seance"');
    expect(tupleSeanceCanonique(tuple())).not.toContain("afest_1to1");
  });

  it("refuse une version de tuple inconnue plutôt que d'inventer une empreinte", () => {
    expect(() => tupleSeanceCanonique(tuple(), 99)).toThrow(/Version de tuple inconnue/);
  });

  it("ne contient NI durée, NI empreinte d'IP, NI empreinte de navigateur", () => {
    // 🔴 C'est ce qui rend l'effacement RGPD compatible avec des empreintes
    // valides : le collectif a dû corriger l'inverse, qui rendait
    // `empreinte_invalide` sur toutes les pièces d'un stagiaire ayant exercé
    // son article 17. Et `dureeMinutes` est redondante avec les horaires :
    // sceller deux représentations de la même grandeur fige une contradiction.
    const canon = tupleSeanceCanonique(tuple());
    expect(canon).not.toContain("dureeMinutes");
    expect(canon).not.toContain("ipHash");
    expect(canon).not.toContain("userAgentSha256");
  });
});

describe("calculerSelfHashSeance — matrice de falsification", () => {
  const reference = calculerSelfHashSeance(tuple());

  it("produit une empreinte SHA-256 hexadécimale de 64 caractères", () => {
    expect(reference).toMatch(/^[0-9a-f]{64}$/);
  });

  // Chaque champ du tuple doit faire bouger l'empreinte : un champ scellé qui
  // ne changerait rien serait un champ falsifiable sans trace.
  const mutations: Array<[string, Partial<TupleSeanceSignatureV1>]> = [
    ["coachingId", { coachingId: "00000000-0000-4000-8000-000000000000" }],
    ["compteRenduSeanceId", { compteRenduSeanceId: "00000000-0000-4000-8000-000000000000" }],
    ["role", { role: "tuteur" }],
    ["seanceDate", { seanceDate: "2026-06-11" }],
    ["heureDebut", { heureDebut: "09:01" }],
    ["heureFin", { heureFin: "11:31" }],
    ["formationIntitule", { formationIntitule: "Autre parcours" }],
    ["modules", { modules: ["Cartographie de l'activité"] }],
    ["formateurNom", { formateurNom: "Autre Formateur" }],
    ["signataireNom", { signataireNom: "Autre Signataire" }],
    ["signataireEmail", { signataireEmail: null }],
    ["methode", { methode: "confirmation_accessible" }],
    ["mentionVersion", { mentionVersion: "afest-v2" }],
    ["signatureSha256", { signatureSha256: "b".repeat(64) }],
    ["signeAtIso", { signeAtIso: "2026-06-10T09:35:12.346Z" }],
    ["prevHash", { prevHash: "c".repeat(64) }],
  ];

  it.each(mutations)("change quand `%s` change", (_champ, patch) => {
    expect(calculerSelfHashSeance(tuple(patch))).not.toBe(reference);
  });

  it("distingue `signataireEmail: null` d'une chaîne vide", () => {
    expect(calculerSelfHashSeance(tuple({ signataireEmail: null }))).not.toBe(
      calculerSelfHashSeance(tuple({ signataireEmail: "" })),
    );
  });
});

describe("tupleSeanceDepuisLigne", () => {
  it("reconstruit un tuple identique à celui qui a été scellé", () => {
    const l = ligne();
    expect(tupleSeanceDepuisLigne(l)).toStrictEqual(tuple());
  });

  it("refuse une `seanceDate` qui n'est pas à minuit UTC", () => {
    // Une date décalée signale que l'invariant d'écriture a été rompu : mieux
    // vaut « irrecalculable » qu'une empreinte fausse présentée comme juste.
    expect(
      tupleSeanceDepuisLigne(ligne({ seanceDate: new Date("2026-06-10T12:00:00.000Z") })),
    ).toBe(null);
  });

  it("refuse un `modulesSnapshot` qui n'est pas un tableau de chaînes", () => {
    expect(tupleSeanceDepuisLigne(ligne({ modulesSnapshot: { a: 1 } }))).toBe(null);
    expect(tupleSeanceDepuisLigne(ligne({ modulesSnapshot: [1, 2] }))).toBe(null);
    expect(tupleSeanceDepuisLigne(ligne({ modulesSnapshot: null }))).toBe(null);
  });

  it("refuse une version qu'il ne sait plus recalculer", () => {
    expect(versionSeanceRecalculable(HASH_VERSION_SEANCE)).toBe(true);
    expect(versionSeanceRecalculable(99)).toBe(false);
    expect(tupleSeanceDepuisLigne(ligne({ hashVersion: 99 }))).toBe(null);
  });
});

describe("ROUND-TRIP jour civil — séance à 23:30 heure de Paris", () => {
  /**
   * 🔴 Le cas qui casse tout si on l'oublie.
   *
   * Le 10 juin 2026 à 23 h 30 à Paris, c'est le 10 juin à 21 h 30 en UTC : ici
   * les deux jours civils coïncident. Mais le 31 décembre à 23 h 30 à Paris,
   * c'est le 31 décembre 22 h 30 UTC — et le 1ᵉʳ janvier à 00 h 30 à Paris,
   * c'est le 31 décembre 23 h 30 UTC. Écrire `new Date(dateSeance)` brut
   * laisserait PostgreSQL trancher le jour au cast timestamp→date, et
   * l'empreinte serait hachée sur un jour et relue sur l'autre — définitivement
   * fausse, sur une table append-only.
   */
  const instants = [
    new Date("2026-06-10T21:30:00.000Z"), // 10 juin 23:30 Paris (CEST)
    new Date("2026-12-31T23:30:00.000Z"), // 1ᵉʳ janvier 00:30 Paris (CET)
    new Date("2026-01-01T00:30:00.000Z"), // 1ᵉʳ janvier 01:30 Paris (CET)
  ];

  it.each(instants)("hache puis relit le MÊME jour civil de Paris (%s)", (instant) => {
    const jourParis = parisDateISO(instant);
    const colonne = dateSeanceDepuisJourParis(jourParis);

    // L'invariant d'écriture : minuit UTC, sinon la reconstruction refuse.
    expect(colonne.getUTCHours()).toBe(0);
    expect(jourCivilSeance(colonne)).toBe(jourParis);

    const scelle = calculerSelfHashSeance(tuple({ seanceDate: jourParis }));
    const relu = tupleSeanceDepuisLigne(ligne({ seanceDate: colonne }));
    expect(relu).not.toBe(null);
    expect(relu?.seanceDate).toBe(jourParis);
    expect(calculerSelfHashSeance(relu as TupleSeanceSignatureV1)).toBe(scelle);
  });

  it("le 31 décembre à 23:30 Paris n'est PAS le 1ᵉʳ janvier", () => {
    // Contrôle négatif : si `parisDateISO` était remplacé par un formatage UTC,
    // ce test tomberait — et c'est exactement la régression à attraper.
    expect(parisDateISO(new Date("2026-12-31T23:30:00.000Z"))).toBe("2027-01-01");
    expect(parisDateISO(new Date("2026-12-31T22:00:00.000Z"))).toBe("2026-12-31");
  });
});

describe("maillonSeanceDepuisLigne + verifierChaine (réutilisé tel quel)", () => {
  /** Chaîne de 3 séances du même rôle, chaînée dans l'ordre d'insertion. */
  function chaine(): LigneSeanceSignature[] {
    const a = scellee({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", prevHash: null });
    const b = scellee({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      compteRenduSeanceId: "33333333-3333-4333-8333-333333333333",
      prevHash: a.selfHash,
    });
    const c = scellee({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      compteRenduSeanceId: "44444444-4444-4444-8444-444444444444",
      prevHash: b.selfHash,
    });
    return [a, b, c];
  }

  it("valide une chaîne AFEST intacte", () => {
    const res = verifierChaine(chaine().map(maillonSeanceDepuisLigne));
    expect(res.valide).toBe(true);
    expect(res.nbVerifies).toBe(3);
  });

  it("détecte la substitution de l'IMAGE (`empreinte_invalide`)", () => {
    const maillons = chaine();
    const altere = { ...maillons[1]!, signatureSha256: "f".repeat(64) };
    const res = verifierChaine([maillons[0]!, altere, maillons[2]!].map(maillonSeanceDepuisLigne));
    expect(res.valide).toBe(false);
    expect(res.anomalies.map((a) => a.type)).toContain("empreinte_invalide");
  });

  it("détecte un `UPDATE methode` — la NATURE de la preuve est scellée", () => {
    const maillons = chaine();
    const altere = { ...maillons[0]!, methode: "papier_scanne" as const };
    const res = verifierChaine([altere].map(maillonSeanceDepuisLigne));
    expect(res.anomalies.map((a) => a.type)).toContain("empreinte_invalide");
  });

  it("détecte un `UPDATE mention_version` — le texte accepté est scellé", () => {
    const maillons = chaine();
    const altere = { ...maillons[0]!, mentionVersion: "afest-v2" };
    const res = verifierChaine([altere].map(maillonSeanceDepuisLigne));
    expect(res.anomalies.map((a) => a.type)).toContain("empreinte_invalide");
  });

  it("détecte une réattribution de chaîne (`UPDATE coaching_id`)", () => {
    const maillons = chaine();
    const altere = { ...maillons[0]!, coachingId: "55555555-5555-4555-8555-555555555555" };
    const res = verifierChaine([altere].map(maillonSeanceDepuisLigne));
    expect(res.anomalies.map((a) => a.type)).toContain("empreinte_invalide");
  });

  it("détecte la suppression d'un maillon interne (`rupture_chainage`)", () => {
    const [a, , c] = chaine();
    const res = verifierChaine([a!, c!].map(maillonSeanceDepuisLigne));
    expect(res.valide).toBe(false);
    expect(res.anomalies.map((a2) => a2.type)).toContain("rupture_chainage");
  });

  it("détecte la suppression de la TÊTE de chaîne (`premier_maillon_chaine`)", () => {
    const [, b, c] = chaine();
    const res = verifierChaine([b!, c!].map(maillonSeanceDepuisLigne));
    expect(res.anomalies.map((a) => a.type)).toContain("premier_maillon_chaine");
  });

  it("signale `version_inconnue` sans se plaindre du collectif", () => {
    // Le prédicat de version est PROPRE au contexte : la version 1 des séances
    // ne doit pas être comparée à celle des signatures collectives.
    // ⚠️ Ligne construite SANS `scellee` : une version hors registre est par
    // construction non scellable.
    const res = verifierChaine([
      maillonSeanceDepuisLigne(ligne({ hashVersion: 42, selfHash: "0".repeat(64) })),
    ]);
    expect(res.anomalies.map((a) => a.type)).toContain("version_inconnue");
  });

  it("ne LÈVE jamais, même sur une ligne irrecalculable", () => {
    const cassee = ligne({ modulesSnapshot: "pas un tableau", selfHash: "0".repeat(64) });
    expect(() => verifierChaine([maillonSeanceDepuisLigne(cassee)])).not.toThrow();
    expect(verifierChaine([maillonSeanceDepuisLigne(cassee)]).anomalies[0]?.type).toBe(
      "tuple_irrecalculable",
    );
  });
});

describe("COLONNES_SCELLEES_SEANCE", () => {
  it("liste EXACTEMENT les colonnes qui entrent dans le tuple", () => {
    // Le tuple hache `seanceDate`, `signeAt` et `prevHash` sous d'autres noms
    // de clé : la correspondance se fait sur les COLONNES, qui sont ce qu'un
    // UPDATE peut atteindre.
    expect([...COLONNES_SCELLEES_SEANCE].sort()).toStrictEqual(
      [
        "coachingId",
        "compteRenduSeanceId",
        "role",
        "seanceDate",
        "heureDebut",
        "heureFin",
        "formationIntitule",
        "modulesSnapshot",
        "formateurNom",
        "signataireNom",
        "signataireEmail",
        "methode",
        "mentionVersion",
        "signatureSha256",
        "signeAt",
        "prevHash",
      ].sort(),
    );
  });

  it("n'inclut ni `ipHash` ni `userAgentSha256` — effaçables au titre de l'art. 17", () => {
    expect(COLONNES_SCELLEES_SEANCE).not.toContain("ipHash");
    expect(COLONNES_SCELLEES_SEANCE).not.toContain("userAgentSha256");
  });

  it("n'inclut pas `signatureKey` — seule l'IMAGE se détruit, pas la preuve", () => {
    expect(COLONNES_SCELLEES_SEANCE).not.toContain("signatureKey");
  });
});
