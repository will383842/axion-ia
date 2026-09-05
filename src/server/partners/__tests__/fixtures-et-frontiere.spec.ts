/**
 * Le CLIQUET du canal Partners, et les contre-témoins de la frontière.
 *
 * REQ-QA-007 (fixtures générées, transcription tenue), REQ-INT-029 (la frontière),
 * REQ-INT-032 / REQ-CPL-015 (l'arbitrage `parrainCodeCapture`).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * CE QUE CE FICHIER EMPÊCHE, ET QU'AUCUN AUTRE TEST N'EMPÊCHE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `payloads.spec.ts` vérifie que CHAQUE constructeur fait ce qu'on lui demande. Il ne
 * peut rien dire de ce qui MANQUE : le jour où Partners republie un huitième type, tous
 * ses cas restent verts, et le type n'a simplement aucun producteur. Une absence ne
 * casse jamais un test qui ne la cherche pas — c'est le mode d'échec le plus silencieux
 * qui soit, et c'est celui d'un contrat qui s'étend.
 *
 * Le cliquet est donc NOMINATIF : il énumère les types depuis le contrat COPIÉ (jamais
 * une liste retapée ici) et exige, pour chacun, une fixture produite par le producteur
 * réel. Ajouter un type sans l'émettre rougit. Retirer un producteur rougit.
 */
import { describe, expect, it } from "vitest";

import { HORS_CONTRAT_V1, SCHEMA_VERSION, TYPES_EVENEMENT } from "../contrat";
import { empreinteContratPublie } from "../contrat/empreinte";
import fixtures from "../contrat/fixtures.v1.json";
import {
  EXEMPTIONS_NOMMEES,
  FRONTIERE_INTERDITE,
  champsInterditsSelonFrontiere,
} from "../frontiere";

type Evenement = Record<string, unknown>;
const EVENEMENTS = fixtures.evenements as unknown as Evenement[];
const HORS = fixtures.horsContratV1 as unknown as Evenement[];

describe("RM-03 / REQ-GOV-020 — la fixture DÉCLARE d'où elle vient", () => {
  it("porte un `Source:` qui nomme son producteur et sa méthode", () => {
    expect(fixtures.Source).toContain("scripts/partners/fixtures.ts");
    expect(fixtures.Source).toContain("INT-T01b");
    // Une fixture éditée à la main est le défaut que RM-03 existe pour empêcher : le
    // fichier le dit lui-même, à qui l'ouvre.
    expect(fixtures.Source).toContain("ne pas éditer à la main");
  });

  it("🔴 épingle l'EMPREINTE du contrat sur lequel elle a été produite", () => {
    // C'est ce qui fait de la fixture une transcription datée plutôt qu'un fichier
    // ancien. Le jour où Partners republie son schéma, l'empreinte copiée change, ce cas
    // rougit, et il faut REGÉNÉRER — pas rééditer. Sans ce lien, une fixture produite
    // sous la v1 resterait verte sous la v2 en décrivant un contrat qui n'existe plus.
    expect(fixtures.Source).toContain(empreinteContratPublie());
    expect(fixtures.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe("LE CLIQUET — aucun type du contrat ne reste sans producteur", () => {
  it("chacun des types du contrat v1 a au moins une fixture RÉELLE", () => {
    const produits = new Set(EVENEMENTS.map((e) => String(e["event_type"])));
    for (const type of TYPES_EVENEMENT) {
      expect(
        produits.has(type),
        `« ${type} » est au contrat v1 mais AUCUNE fixture ne le produit. Un type publié sans ` +
          "producteur est un canal muet que rien ne signale : écrire son constructeur dans " +
          "`payloads.ts` et son fait dans `scripts/partners/fixtures.ts`.",
      ).toBe(true);
    }
  });

  it("chacun des quatre types HORS contrat v1 est produit lui aussi", () => {
    // Ils sont construits et testés SANS être émis : la bascule vers la `schema_version`
    // 2 est en lockstep entre les deux dépôts. Les produire dès maintenant est le seul
    // ordre possible — le jour où Partners republie, il ne reste qu'à les déplacer.
    const produits = new Set(HORS.map((e) => String(e["event_type"])));
    for (const type of HORS_CONTRAT_V1) {
      expect(
        produits.has(type),
        `« ${type} » est recensé hors contrat mais rien ne le produit.`,
      ).toBe(true);
    }
  });

  it("aucune fixture ne porte un type que le contrat ne connaît pas", () => {
    const connus = new Set<string>([...TYPES_EVENEMENT, ...HORS_CONTRAT_V1]);
    for (const e of [...EVENEMENTS, ...HORS]) {
      expect(connus.has(String(e["event_type"])), `type inconnu : ${String(e["event_type"])}`).toBe(
        true,
      );
    }
  });

  it("🔴 aucune enveloppe ne porte `emitted_at` : il dépend de l'HORLOGE, pas du fait", () => {
    // Le garder rendrait le fichier différent à chaque génération, donc la garde
    // `--verifier` rouge en permanence, donc débranchée dans la semaine.
    for (const e of EVENEMENTS) expect(e).not.toHaveProperty("emitted_at");
  });
});

describe("REQ-INT-005 — le reliquat, vérifié sur les fixtures PRODUITES", () => {
  it("Σ des HT dérivés = factureMontantHtCents, au centime", () => {
    // 100 000 HT encaissés en trois fois : 33 333 + 33 333 + 33 334. Sans l'absorption
    // du reliquat par l'encaissement soldant, il manquerait un centime — sur CHAQUE
    // facture payée en plusieurs fois, indéfiniment, et sans qu'aucune console ne le
    // dise. C'est vérifié ici sur la sortie réelle du producteur, pas sur un exemple.
    const recus = EVENEMENTS.filter((e) => e["event_type"] === "paiement.recu").map(
      (e) => e["payload"] as Record<string, number | boolean>,
    );
    expect(recus.length).toBeGreaterThan(1);

    const total = recus.reduce((a, p) => a + Number(p["amountHtCents"]), 0);
    expect(total).toBe(Number(recus[0]?.["factureMontantHtCents"]));
    expect(recus.filter((p) => p["soldeLaFacture"] === true)).toHaveLength(1);
  });

  it("🔴 REQ-DM-015 (A-2) — le forfait du palier 2 jours est dû UNE fois", () => {
    const devis = EVENEMENTS.find((e) => e["event_type"] === "devis.signe");
    const lignes = (devis?.["payload"] as { lignes: Record<string, unknown>[] }).lignes;
    const ligne = lignes[0];
    expect(ligne?.["jours"]).toBe(2);
    // `commissionId` doit rester LISIBLE dans la fixture : REQ-INT-006 exige qu'il
    // appartienne aux identifiants de `COMMERCIAL_COMMISSIONS`, et Partners ne peut pas
    // le vérifier sur une valeur pseudonymisée. La pseudonymisation l'avait écrasé une
    // fois (cf. `CLES_NON_PSEUDONYMISEES` dans le script) — ce cas l'épingle.
    expect(ligne?.["commissionId"]).toBe("com-formation-2j");
    // 500 € la journée × 2 journées = 1 000 € = 100 000 centimes. UNE fois. La formule
    // fautive (`flatEur × jours × 100`) rendrait 200 000.
    expect((ligne?.["commission"] as Record<string, unknown>)["montantCents"]).toBe(100_000);
  });
});

describe("REQ-INT-029 — la frontière tient sur les fixtures, ET elle sait rougir", () => {
  it("les trois familles sont celles de l'exigence, dans son ordre", () => {
    expect(FRONTIERE_INTERDITE.map((f) => f.famille)).toEqual([
      "montant_avant_signature",
      "identite_autre_apporteur",
      "coordonnees_du_contact",
    ]);
  });

  it("aucun champ interdit ne franchit la frontière, sur AUCUNE fixture", () => {
    for (const e of [...EVENEMENTS, ...HORS]) {
      const type = String(e["event_type"]);
      expect(champsInterditsSelonFrontiere(type, e["payload"]), `${type} / payload`).toEqual([]);
      expect(
        champsInterditsSelonFrontiere(type, e["subject_ref"]),
        `${type} / subject_ref`,
      ).toEqual([]);
    }
  });

  it("🔴 LE CONTRE-TÉMOIN — un détecteur qui rend toujours [] passerait le cas ci-dessus", () => {
    // Sans ce cas, « aucun champ interdit » ne mesurerait rien du tout.
    expect(champsInterditsSelonFrontiere("client.cree", { montantHtCents: 1 })).not.toEqual([]);
    expect(
      champsInterditsSelonFrontiere("facture.emise", { contacts: ["jean@exemple.fr"] }),
    ).not.toEqual([]);
    expect(champsInterditsSelonFrontiere("client.cree", { autreApporteurId: "x" })).not.toEqual([]);
  });

  it("🔴 un montant traverse APRÈS la signature — le témoin POSITIF", () => {
    // Sans lui, on aurait pu couper tous les montants partout et croire la frontière
    // tenue. REQ-INT-005 et REQ-INT-006 EXIGENT que les montants post-signature passent.
    expect(champsInterditsSelonFrontiere("facture.emise", { montantHtCents: 100_000 })).toEqual([]);
    expect(champsInterditsSelonFrontiere("paiement.recu", { amountHtCents: 33_333 })).toEqual([]);
  });

  it("un primitif DANS UN TABLEAU est inspecté — la fuite la plus banale", () => {
    // `contacts: ["jean@exemple.fr"]` passait quand seuls les objets poussaient un nœud.
    expect(
      champsInterditsSelonFrontiere("facture.emise", { liste: ["marc@exemple.fr"] }),
    ).not.toEqual([]);
  });
});

describe("L'ARBITRAGE `parrainCodeCapture` — ses trois bornes, chacune éprouvée", () => {
  it("l'exemption est DÉCLARÉE, nominative, et cite l'exigence qui la porte", () => {
    const e = EXEMPTIONS_NOMMEES.find((x) => x.feuille === "parrainCodeCapture");
    expect(e).toBeDefined();
    expect(e?.type).toBe("candidature.recue");
    expect(e?.exigence).toBe("REQ-INT-032");
  });

  it("BORNE 1 — sur `candidature.recue`, un CODE et un `null` passent", () => {
    expect(
      champsInterditsSelonFrontiere("candidature.recue", { parrainCodeCapture: null }),
    ).toEqual([]);
    expect(
      champsInterditsSelonFrontiere("candidature.recue", { parrainCodeCapture: "AXI-PARR-7781" }),
    ).toEqual([]);
  });

  it("🔴 BORNE 2 — la même clé sur un AUTRE type reste refusée", () => {
    expect(
      champsInterditsSelonFrontiere("client.cree", { parrainCodeCapture: "AXI-PARR-7781" }),
    ).not.toEqual([]);
  });

  it("🔴 BORNE 3 — un NOM ou une ADRESSE glissés dans ce champ ne sont PAS exemptés", () => {
    // L'exemption ne couvre pas un CHAMP, elle couvre une valeur de code. C'est ce qui la
    // distingue d'un trou dans la frontière.
    expect(
      champsInterditsSelonFrontiere("candidature.recue", { parrainCodeCapture: "Jean Dupont" }),
    ).not.toEqual([]);
    expect(
      champsInterditsSelonFrontiere("candidature.recue", { parrainCodeCapture: "jean@exemple.fr" }),
    ).not.toEqual([]);
  });

  it("🔴 BORNE 4 — les voisins lexicaux restent refusés, exemption ou pas", () => {
    for (const cle of ["parrainNom", "parrainEmail", "apporteurId", "filleulId"]) {
      expect(
        champsInterditsSelonFrontiere("candidature.recue", { [cle]: "AXI-PARR-7781" }),
        `« ${cle} » devrait rester interdit`,
      ).not.toEqual([]);
    }
  });
});

describe("REQ-DM-041 — aucune donnée personnelle dans la candidature produite", () => {
  it("ni adresse de courriel, ni ville, ni prose libre", () => {
    const candidature = HORS.find((e) => e["event_type"] === "candidature.recue");
    const serialise = JSON.stringify(candidature);
    expect(serialise).not.toMatch(/@/);
    // Le scénario porte « Grenoble », « 38000 » et un pitch : la liste fermée de
    // `payloads.ts` les retient côté axionia. S'ils apparaissaient, la liste aurait été
    // ouverte sans que personne ne le voie.
    expect(serialise).not.toContain("Grenoble");
    expect(serialise).not.toContain("38000");
    expect(serialise).not.toContain("industrielles");
  });
});
