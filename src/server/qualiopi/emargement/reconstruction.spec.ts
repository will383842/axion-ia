/**
 * Tests — reconstruction.ts
 *
 * Ce fichier existe pour prouver UNE chose : qu'une chaîne de signatures telle
 * qu'elle vit EN COLONNES est réellement vérifiable. Les tests de `hash.ts`
 * partaient de tuples construits à la main — ils validaient l'algorithme, pas la
 * capacité de la base à le nourrir. Un modèle auquel il manque une colonne du
 * snapshot les passe tous, et rend pourtant `verifierChaine` inopérant.
 *
 * Le scénario est donc de bout en bout : on FABRIQUE des lignes comme le
 * service les écrira, puis on vérifie qu'une altération est détectée.
 */

import { describe, it, expect } from "vitest";
import { calculerSelfHash, verifierChaine, HASH_VERSION_COURANTE } from "./hash";
import type { TupleSignatureV1 } from "./hash";
import { tupleDepuisLigne, maillonDepuisLigne, type LigneSignature } from "./reconstruction";

/** Ligne telle que la base la rendra, chaînée sur `prevHash`. */
function ligne(overrides: Partial<LigneSignature> = {}): LigneSignature {
  const base: LigneSignature = {
    id: "sig-1",
    contexteType: "collectif",
    creneauId: "cre-1",
    coachingId: null,
    date: new Date("2026-06-10T00:00:00.000Z"),
    demiJournee: "matin",
    heureDebut: "09:00",
    heureFin: "12:30",
    formationIntitule: "Déployer l'IA en entreprise",
    modulesSnapshot: ["Module 1 — Cadrage", "Module 2 — Cas d'usage"],
    formateurNom: "Williams Jullin",
    signataireNom: "Alice Dupont",
    signataireEmail: "alice@example.test",
    methode: "canvas",
    signatureSha256: "a".repeat(64),
    signeAt: new Date("2026-06-10T10:13:42.123Z"),
    ipHash: "b".repeat(16),
    userAgentSha256: "c".repeat(64),
    mentionVersion: "v1",
    prevHash: null,
    selfHash: "",
    hashVersion: HASH_VERSION_COURANTE,
    ...overrides,
  };
  // Le `selfHash` est celui que le service calculera : on le dérive du tuple
  // reconstruit, sinon le test validerait une valeur inventée.
  const tuple = tupleDepuisLigne(base);
  return { ...base, selfHash: tuple === null ? "" : calculerSelfHash(tuple) };
}

/** Chaîne de N lignes d'un même inscrit, correctement scellées. */
function chaine(n: number): LigneSignature[] {
  const lignes: LigneSignature[] = [];
  let prevHash: string | null = null;
  for (let i = 0; i < n; i++) {
    const l = ligne({
      id: `sig-${i + 1}`,
      creneauId: `cre-${i + 1}`,
      demiJournee: i % 2 === 0 ? "matin" : "apres_midi",
      signeAt: new Date(Date.UTC(2026, 5, 10, 10, i, 0, 0)),
      prevHash,
    });
    lignes.push(l);
    prevHash = l.selfHash;
  }
  return lignes;
}

describe("tupleDepuisLigne", () => {
  it("reconstruit TOUS les champs du tuple — plus aucun `tuple_irrecalculable`", () => {
    const tuple = tupleDepuisLigne(ligne());
    expect(tuple).not.toBeNull();
    // Les champs qui n'existaient pas en colonnes avant cette tranche, et dont
    // l'absence rendait la chaîne invérifiable.
    expect(tuple?.heureDebut).toBe("09:00");
    expect(tuple?.heureFin).toBe("12:30");
    expect(tuple?.formationIntitule).toBe("Déployer l'IA en entreprise");
    expect(tuple?.modules).toEqual(["Module 1 — Cadrage", "Module 2 — Cas d'usage"]);
    expect(tuple?.formateurNom).toBe("Williams Jullin");
    expect(tuple?.date).toBe("2026-06-10");
    expect(tuple?.demiJournee).toBe("matin");
  });

  it("extrait le jour civil en UTC — une colonne DATE est rendue à minuit UTC", () => {
    // En formatage local, un serveur à l'ouest de Greenwich daterait ce créneau
    // du 9 juin. Un jour d'écart dans un tuple haché est une empreinte
    // définitivement fausse.
    expect(tupleDepuisLigne(ligne())?.date).toBe("2026-06-10");
  });

  it("conserve la milliseconde de `signeAt`", () => {
    expect(tupleDepuisLigne(ligne())?.signeAtIso).toBe("2026-06-10T10:13:42.123Z");
  });

  it("retourne null sur une version de tuple inconnue", () => {
    expect(tupleDepuisLigne(ligne({ hashVersion: 99 }))).toBeNull();
  });

  it.each([
    ["un objet", { a: 1 }],
    ["une chaîne", "Module 1"],
    ["un tableau non homogène", ["Module 1", 42]],
  ])("retourne null si `modulesSnapshot` est %s", (_, valeur) => {
    expect(tupleDepuisLigne(ligne({ modulesSnapshot: valeur }))).toBeNull();
  });
});

describe("verifierChaine sur des lignes de base", () => {
  it("valide une chaîne intacte de 4 signatures", () => {
    const res = verifierChaine(chaine(4).map(maillonDepuisLigne));
    expect(res.valide).toBe(true);
    expect(res.anomalies).toEqual([]);
    expect(res.nbVerifies).toBe(4);
  });

  it.each([
    ["l'horaire de fin", { heureFin: "17:00" }],
    ["l'intitulé de la formation", { formationIntitule: "Autre formation" }],
    ["le nom du formateur", { formateurNom: "Quelqu'un d'autre" }],
    ["les modules", { modulesSnapshot: ["Module 1 — Cadrage"] }],
    ["le nom du signataire", { signataireNom: "Bob Martin" }],
    ["l'empreinte de l'image", { signatureSha256: "f".repeat(64) }],
  ])("détecte qu'on a modifié %s après signature", (_, patch) => {
    const lignes = chaine(3);
    // On altère le contenu SANS toucher au `selfHash` : c'est exactement ce que
    // ferait un UPDATE en base, à la main ou par un écran mal gardé.
    lignes[1] = { ...(lignes[1] as LigneSignature), ...patch } as LigneSignature;

    const res = verifierChaine(lignes.map(maillonDepuisLigne));
    expect(res.valide).toBe(false);
    expect(res.anomalies.map((a) => a.type)).toContain("empreinte_invalide");
  });

  it("détecte la SUPPRESSION d'un maillon au milieu de la chaîne", () => {
    const lignes = chaine(4);
    const ampute = [lignes[0], lignes[2], lignes[3]] as LigneSignature[];

    const res = verifierChaine(ampute.map(maillonDepuisLigne));
    expect(res.valide).toBe(false);
    expect(res.anomalies.map((a) => a.type)).toContain("rupture_chainage");
  });

  it("détecte la suppression de la PREMIÈRE signature", () => {
    const res = verifierChaine(chaine(3).slice(1).map(maillonDepuisLigne));
    expect(res.anomalies.map((a) => a.type)).toContain("premier_maillon_chaine");
  });

  it("détecte une INSERTION a posteriori", () => {
    const lignes = chaine(3);
    // Une ligne fabriquée après coup ne peut pas connaître le `selfHash` de
    // celle qu'elle prétend suivre : c'est tout l'intérêt du chaînage.
    const intruse = ligne({ id: "sig-intruse", creneauId: "cre-x", prevHash: "0".repeat(64) });
    const res = verifierChaine(
      [lignes[0], intruse, lignes[1], lignes[2]].map((l) =>
        maillonDepuisLigne(l as LigneSignature),
      ),
    );
    expect(res.valide).toBe(false);
    expect(res.anomalies.map((a) => a.type)).toContain("rupture_chainage");
  });

  it("signale une ligne irrecalculable sans faire échouer la vérification entière", () => {
    // ⚠️ `verifierChaine` ne LÈVE jamais : une chaîne abîmée est un résultat à
    // présenter, pas une panne. La faire échouer bruyamment empêcherait
    // précisément d'afficher l'anomalie à qui doit la constater.
    const lignes = chaine(3);
    lignes[1] = { ...(lignes[1] as LigneSignature), modulesSnapshot: "cassé" };

    const res = verifierChaine(lignes.map(maillonDepuisLigne));
    expect(res.nbVerifies).toBe(3);
    expect(res.anomalies.map((a) => a.type)).toContain("tuple_irrecalculable");
  });
});

describe("chaque colonne entre RÉELLEMENT dans l'empreinte", () => {
  // 🔴 Le point aveugle des tests précédents. Le helper `ligne()` dérive
  // `selfHash` de `tupleDepuisLigne` : la vérification d'une chaîne intacte
  // passerait donc même si `tupleDepuisLigne` retournait un tuple CONSTANT,
  // ignorant la ligne — tous les hash seraient égaux, et le chaînage
  // « se vérifierait » quand même.
  //
  // Le cas grave est `prevHash` : s'il n'entrait pas dans le tuple, le
  // scellement disparaîtrait. Supprimer la 2ᵉ signature puis réécrire le
  // `prev_hash` de la 3ᵉ redonnerait une chaîne VALIDE — exactement la fraude
  // que D12 prétend rendre détectable. Aucun test ne le couvrait.
  //
  // On compare donc des empreintes calculées directement, sans passer par
  // `verifierChaine`, sinon on retombe dans la tautologie du helper.
  const variations: Array<[string, Partial<LigneSignature>]> = [
    ["prevHash", { prevHash: "9".repeat(64) }],
    ["contexteType", { contexteType: "afest_1to1", creneauId: null, coachingId: "coa-1" }],
    ["creneauId", { creneauId: "cre-autre" }],
    ["date", { date: new Date("2026-06-11T00:00:00.000Z") }],
    ["demiJournee", { demiJournee: "apres_midi" }],
    ["heureDebut", { heureDebut: "08:00" }],
    ["heureFin", { heureFin: "17:00" }],
    ["formationIntitule", { formationIntitule: "Autre intitulé" }],
    ["modulesSnapshot", { modulesSnapshot: ["Module 1 — Cadrage"] }],
    ["formateurNom", { formateurNom: "Autre formateur" }],
    ["signataireNom", { signataireNom: "Bob Martin" }],
    ["signataireEmail", { signataireEmail: "bob@example.test" }],
    ["methode", { methode: "confirmation_accessible" }],
    ["signatureSha256", { signatureSha256: "f".repeat(64) }],
    ["signeAt", { signeAt: new Date("2026-06-10T10:13:42.124Z") }],
    ["ipHash", { ipHash: "d".repeat(16) }],
    ["userAgentSha256", { userAgentSha256: "e".repeat(64) }],
    ["mentionVersion", { mentionVersion: "v2" }],
  ];

  const empreinte = (l: LigneSignature): string => {
    const tuple = tupleDepuisLigne(l);
    expect(tuple).not.toBeNull();
    return calculerSelfHash(tuple as TupleSignatureV1);
  };

  it.each(variations)("modifier %s change l'empreinte", (_, patch) => {
    const base = ligne();
    expect(empreinte({ ...base, ...patch } as LigneSignature)).not.toBe(empreinte(base));
  });

  it("couvre toutes les colonnes qui entrent dans le tuple", () => {
    // Garde-fou du garde-fou : ajouter un champ au tuple sans l'ajouter à la
    // liste ci-dessus laisserait un nouveau `prevHash` non couvert.
    const champsDuTuple = Object.keys(tupleDepuisLigne(ligne()) as TupleSignatureV1);
    const couverts = new Set(variations.map(([nom]) => nom));
    // `coachingId` est couvert par la variation `contexteType` (exclusivité).
    couverts.add("coachingId");
    const nonCouverts = champsDuTuple
      .map((c) => (c === "signeAtIso" ? "signeAt" : c === "modules" ? "modulesSnapshot" : c))
      .filter((c) => !couverts.has(c));
    expect(nonCouverts).toEqual([]);
  });
});

describe("invariant « date à minuit UTC »", () => {
  it.each([
    ["une heure", new Date("2026-06-10T01:00:00.000Z")],
    ["des minutes", new Date("2026-06-10T00:30:00.000Z")],
    ["des millisecondes", new Date("2026-06-10T00:00:00.001Z")],
  ])("retourne null si la date porte %s", (_, date) => {
    // Une date non alignée signale que l'invariant d'écriture a été rompu :
    // recalculer une empreinte dessus ne produirait aucune information fiable.
    expect(tupleDepuisLigne(ligne({ date }))).toBeNull();
  });

  it("accepte minuit UTC pile", () => {
    expect(tupleDepuisLigne(ligne({ date: new Date("2026-06-10T00:00:00.000Z") }))).not.toBeNull();
  });
});
