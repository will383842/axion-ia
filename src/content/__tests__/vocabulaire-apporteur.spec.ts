/**
 * vocabulaire-apporteur.spec.ts — JUR-T03 (chantier Axion Partners) : ce que les pages de
 * recrutement des apporteurs ont le droit de dire.
 *
 * REQ-JUR-001, REQ-JUR-002, REQ-JUR-024 :
 *   1. le déclencheur d'une commission est l'ENCAISSEMENT, jamais « la vente signée » ni
 *      « dès la signature » — c'est ce que le contrat d'apporteur écrit ;
 *   2. le financement ne s'affirme pas sans la certification (`src/server/qualiopi/config/
 *      financing.ts`, point 1 de son contrat légal), et certaines formules sont interdites
 *      MÊME certifié, quel que soit le drapeau : « prise en charge à 100 % », « financé par
 *      Qualiopi », « sans avance de frais » et leurs périphrases ; « Qualiopi » nu ; le CPF ;
 *   3. les mots-clés de financement (« OPCO », « financement formation ») ne sont émis QUE si
 *      la certification est obtenue ; « CPF », jamais.
 *
 * Chaque famille a son TÉMOIN : un texte fautif injecté la fait rougir, et elle est nommée.
 * Le dépôt réel sort sans faute, avec le compte des fichiers lus : « 0 fichier » n'est pas un vert.
 *
 * Hors périmètre, délibérément : le mot « commercial ». Il désigne ici les apporteurs (routes
 * `/devenir-commercial-ia`, `COMMERCIAL_COMMISSIONS`), décision de Williams du 2026-09-29.
 */
import { describe, expect, it } from "vitest";

import { buildCommercialKeywords } from "@/content/recrutement/commercial-offer";

import {
  fautesDeVocabulaire,
  lireSurfacesApporteur,
  type FamilleVocabulaire,
} from "../../../scripts/gates/vocab-public";

const temoin = (texte: string) =>
  fautesDeVocabulaire([{ chemin: "src/content/recrutement/temoin.ts", texte }]).map(
    (f) => f.famille,
  );

describe("REQ-JUR-001, REQ-JUR-002, REQ-JUR-024 — les pages apporteurs, telles qu'elles sont", () => {
  it("le dépôt réel est sans faute, sur un périmètre NON vide", () => {
    const surfaces = lireSurfacesApporteur();
    expect(surfaces.length).toBeGreaterThan(10);
    expect(fautesDeVocabulaire(surfaces)).toEqual([]);
  });
});

describe("REQ-JUR-002 — le déclencheur est l'encaissement", () => {
  it.each([
    "déclenche vos commissions sur chaque vente signée",
    "Toute vente signée sur une de vos entreprises",
    "commission due dès la signature du devis",
  ])("TÉMOIN — « %s » est refusé", (texte) => {
    expect(temoin(texte)).toContain<FamilleVocabulaire>("declencheur_hors_encaissement");
  });

  it("contre-témoin : « à l'encaissement de chaque facture » passe", () => {
    expect(temoin("votre commission est versée à l'encaissement de chaque facture")).toEqual([]);
  });
});

describe("REQ-JUR-001 — le financement : formules interdites, drapeau ou non", () => {
  it.each([
    ["prise en charge à 100 %", "financement_inconditionnel"],
    ["la formation peut être financée jusqu'à 100 % par leur OPCO", "financement_inconditionnel"],
    ["financé par Qualiopi", "financement_inconditionnel"],
    ["sans avance de frais", "financement_inconditionnel"],
    ["le dirigeant n'a même pas de trésorerie à sortir", "financement_inconditionnel"],
    ["il n'a parfois même pas à avancer les fonds", "financement_inconditionnel"],
    ["des produits à coût quasi nul pour le client", "financement_inconditionnel"],
    ["des formations Qualiopi", "qualiopi_nu"],
    ["mobilisable via le CPF", "cpf"],
  ] as const)("TÉMOIN — « %s » est refusé (%s)", (texte, famille) => {
    expect(temoin(texte)).toContain<FamilleVocabulaire>(famille);
  });

  it("TÉMOIN — une mention de financement dans un fichier qui ne consulte pas la certification", () => {
    expect(temoin('"Des produits souvent finançables."')).toContain<FamilleVocabulaire>(
      "financement_non_gate",
    );
    // Contre-témoin : le même texte, dans un fichier qui consulte le drapeau.
    expect(
      temoin('const c = isQualiopiCertificationObtenue();\n"Des produits souvent finançables."'),
    ).toEqual([]);
  });

  it("contre-témoin : « Organisme certifié Qualiopi » (gaté par le drapeau ailleurs) n'est pas « Qualiopi » nu", () => {
    expect(temoin('"Organisme certifié Qualiopi"')).toEqual([]);
  });

  it("TÉMOIN — la ligne EXACTE refusée en revue : l'entité JSX `&apos;` ne masque pas la formule", () => {
    const ligne =
      "                <li>Finançable jusqu&apos;à 100 % par l&apos;OPCO de l&apos;entreprise</li>";
    expect(
      temoin(`const certifie = isQualiopiCertificationObtenue();\n${ligne}`),
    ).toContain<FamilleVocabulaire>("financement_inconditionnel");
    expect(temoin("prise&nbsp;en charge à&nbsp;100&nbsp;%")).toContain<FamilleVocabulaire>(
      "financement_inconditionnel",
    );
  });

  it.each([
    ["easy-to-sell funded products", "financement_inconditionnel"],
    ["training can be fully funded", "financement_inconditionnel"],
    ["100 % covered by the OPCO", "financement_inconditionnel"],
    ["funding is available", "financement_non_gate"],
  ] as const)("TÉMOIN — la branche anglaise est lue : « %s » est refusé (%s)", (texte, famille) => {
    expect(temoin(texte)).toContain<FamilleVocabulaire>(famille);
  });

  it.each([
    "le coût réel pour le client est faible, souvent nul",
    "donc le coût réel pour le client est faible, voire nul",
    "L'OPCO paie",
    "Et l’OPCO paie la formation à ta place.",
  ])("TÉMOIN — « %s » est refusé, même certifié", (texte) => {
    expect(
      temoin(`const c = isQualiopiCertificationObtenue();\n"${texte}"`),
    ).toContain<FamilleVocabulaire>("financement_inconditionnel");
  });

  it("TÉMOIN — memo-isere : lire le drapeau une fois n'exempte AUCUNE mention du fichier", () => {
    const texte = 'isQualiopiCertificationObtenue() ? "a" : "b",\n"Formations finançables OPCO",';
    const fautes = fautesDeVocabulaire([
      { chemin: "src/app/[locale]/memo-isere/page.tsx", texte },
    ]).map((f) => f.famille);
    expect(fautes).toContain<FamilleVocabulaire>("financement_non_gate");
    // Contre-témoin : la même ligne, dans une surface ordinaire qui lit le drapeau.
    expect(temoin(texte)).toEqual([]);
  });

  describe("memo-isere, lue ligne à ligne : la mention revient SEULEMENT sous la certification (Williams, 2026-09-29)", () => {
    const MEMO = "src/app/[locale]/memo-isere/page.tsx";
    const juge = (texte: string) =>
      fautesDeVocabulaire([{ chemin: MEMO, texte }]).map((f) => `${f.famille}:${f.extrait}`);
    const DECL = [
      "const X_CERTIFIE: readonly string[] = [",
      '  "Formations pouvant être prises en charge par l\'OPCO, selon ses critères",',
      "];",
    ].join("\n");
    const LIEE = "const certifie = isQualiopiCertificationObtenue();";

    it("contre-témoin : dans une `…_CERTIFIE`, employée sous `certifie ?`, la mention passe", () => {
      expect(juge(`${DECL}\n${LIEE}\n[...(certifie ? X_CERTIFIE : [])]`)).toEqual([]);
    });

    it("TÉMOIN — la même constante employée HORS de la bascule rougit", () => {
      expect(juge(`${DECL}\n${LIEE}\n[...X_CERTIFIE]`)).toContain(
        "financement_non_gate:X_CERTIFIE",
      );
    });

    it.each([
      ["niée : servie HORS certification", "{!certifie ? X_CERTIFIE : null}"],
      ["dans les deux branches : servie TOUJOURS", "{certifie ? X_CERTIFIE : X_CERTIFIE}"],
      ["dans la branche fausse seule", "{certifie ? null : X_CERTIFIE}"],
    ])("TÉMOIN — la constante %s rougit (relecture exactitude)", (_, emploi) => {
      expect(juge(`${DECL}\n${LIEE}\n${emploi}`)).toContain("financement_non_gate:X_CERTIFIE");
    });

    it("TÉMOIN — sans `const certifie = isQualiopiCertificationObtenue()`, la déclaration n'exempte rien", () => {
      expect(juge(`${DECL}\nconst certifie = true;\n[...(certifie ? X_CERTIFIE : [])]`)).toContain(
        "financement_non_gate:OPCO",
      );
    });

    it("TÉMOIN — une formule interdite même certifiée rougit DANS la `…_CERTIFIE`", () => {
      const interdite = DECL.replace("selon ses critères", "le coût est souvent nul");
      expect(juge(`${interdite}\n${LIEE}\n[...(certifie ? X_CERTIFIE : [])]`)).toEqual(
        expect.arrayContaining([expect.stringMatching(/^financement_inconditionnel:/)]),
      );
    });
  });

  it("un commentaire de code n'est pas une page : il n'est pas lu", () => {
    expect(temoin("// sans avance de frais : formule interdite, voir JUR-T03")).toEqual([]);
    expect(temoin(" * « prise en charge à 100 % » est refusé")).toEqual([]);
  });
});

describe("REQ-JUR-024 — les mots-clés de financement suivent la certification", () => {
  it("certification non obtenue : ni OPCO, ni CPF, ni « financement »", () => {
    const kw = buildCommercialKeywords({ financementAffichable: false }).join(" | ");
    expect(kw).not.toMatch(/OPCO|CPF|financ/i);
  });

  it("certification obtenue : OPCO et financement, jamais le CPF", () => {
    const kw = buildCommercialKeywords({ financementAffichable: true });
    expect(kw).toContain("OPCO");
    expect(kw).toContain("financement formation");
    expect(kw.join(" | ")).not.toMatch(/CPF/);
  });
});
