// @vitest-environment node
// G3 — validation PURE du contenu d'un guide fabriqué : bornes, empreinte, mots interdits.
import { describe, it, expect } from "vitest";
import { validerContenu, empreinteTexte, pagesDuPdf, type ContenuGuide } from "../fabrique-pdf";
import { motInterditDans } from "../mots-interdits-guide";
import vecteur from "./fixtures/empreinte-guide.json";
import mots from "./fixtures/mots-interdits-guide.json";

const section = (n = 1) => ({
  titre: `Partie ${n}`,
  paragraphes: ["Un paragraphe simple."],
  puces: [] as string[],
});
function corps(sur: Partial<ContenuGuide> & Record<string, unknown> = {}) {
  const c: ContenuGuide = {
    code: "gde-essai-01",
    version: 1,
    titre: "Mon guide pratique",
    sections: [section()],
    ...sur,
  } as ContenuGuide;
  return {
    ...c,
    sha256Texte: empreinteTexte(c),
    ...(sur.sha256Texte ? { sha256Texte: sur.sha256Texte } : {}),
  };
}
const erreur = (v: ReturnType<typeof validerContenu>) => (v.ok ? null : v.erreur);

describe("empreinte du texte (JSON canonique)", () => {
  it("vecteur de test partagé avec le Studio", () => {
    // Calculé à part, sur la chaîne canonique littérale (clés triées, sans espace, NFC) :
    // {"code":"gde-essai-01","sections":[{"paragraphes":["Un paragraphe é."],"puces":["Une puce"],"titre":"Pourquoi"}],"titre":"Le plan en 3 étapes","version":2}
    expect(empreinteTexte(vecteur.contenu as ContenuGuide)).toBe(
      "5cfe5d16f4d2603a68652753b477b812b0f09d8fa27e184acc4a61892583e6ef",
    );
  });
  it("indépendante de l'ordre des clés et de NFC/NFD", () => {
    const a = empreinteTexte(vecteur.contenu as ContenuGuide);
    const nfd = JSON.parse(JSON.stringify(vecteur.contenu).normalize("NFD")) as ContenuGuide;
    const reordonne = {
      sections: nfd.sections,
      version: nfd.version,
      titre: nfd.titre,
      code: nfd.code,
    } as ContenuGuide;
    expect(empreinteTexte(reordonne)).toBe(a);
  });
});

describe("bornes du corps", () => {
  it("corps valide accepté", () => expect(validerContenu(corps()).ok).toBe(true));
  it("code invalide : guide-ia, adr-…, forme", () => {
    for (const code of ["guide-ia", "adr-essai-01", "gde-X", "gde-"]) {
      expect(erreur(validerContenu({ ...corps(), code }))).toBe("code_invalide");
    }
  });
  it("version 0, 1001, décimale refusées", () => {
    for (const version of [0, 1001, 1.5])
      expect(erreur(validerContenu({ ...corps(), version }))).toBe("corps_invalide");
  });
  it("champ inconnu refusé (strict), y compris un chemin", () => {
    expect(erreur(validerContenu({ ...corps(), cheminPdf: "../x.pdf" }))).toBe("corps_invalide");
    const c = corps();
    expect(erreur(validerContenu({ ...c, sections: [{ ...c.sections[0], extra: 1 }] }))).toBe(
      "corps_invalide",
    );
  });
  it("0 ou 21 sections, 16 paragraphes, 11 puces, titre 121, paragraphe 1501, puce 301", () => {
    expect(erreur(validerContenu(corps({ sections: [] })))).toBe("corps_invalide");
    expect(
      erreur(validerContenu(corps({ sections: Array.from({ length: 21 }, (_, i) => section(i)) }))),
    ).toBe("corps_invalide");
    const s = section();
    const cas: ContenuGuide["sections"][] = [
      [{ ...s, paragraphes: Array(16).fill("a") }],
      [{ ...s, puces: Array(11).fill("a") }],
      [{ ...s, titre: "a".repeat(121) }],
      [{ ...s, paragraphes: ["a".repeat(1501)] }],
      [{ ...s, puces: ["a".repeat(301)] }],
    ];
    for (const sections of cas)
      expect(erreur(validerContenu(corps({ sections })))).toBe("corps_invalide");
  });
  it("plus de 40 000 caractères au total refusé", () => {
    const sections = Array.from({ length: 20 }, (_, i) => ({
      titre: `P${i}`,
      paragraphes: Array(15).fill("a".repeat(1500)),
      puces: [],
    }));
    expect(erreur(validerContenu(corps({ sections })))).toBe("corps_invalide");
  });
  it("caractères de contrôle et bidirectionnels refusés", () => {
    for (const t of ["a\u0000b", "a‮b", "a​b", "a\u0007b"]) {
      expect(
        erreur(validerContenu(corps({ sections: [{ ...section(), paragraphes: [t] }] }))),
      ).toBe("corps_invalide");
    }
  });
  it("titre invalide (trop court, contrôle)", () => {
    expect(erreur(validerContenu(corps({ titre: "ab" })))).toBe("titre_invalide");
    expect(erreur(validerContenu(corps({ titre: "Mon‮guide" })))).toBe("titre_invalide");
  });
  it("empreinte fausse → empreinte_differente", () => {
    expect(erreur(validerContenu(corps({ sha256Texte: "0".repeat(64) })))).toBe(
      "empreinte_differente",
    );
  });
});

describe("mots interdits (3e contrôle)", () => {
  for (const { regle, texte } of mots.refuses) {
    it(`refuse « ${texte} » (${regle})`, () => {
      expect(motInterditDans(texte)).toBe(regle);
      const v = validerContenu(corps({ sections: [{ ...section(), paragraphes: [texte] }] }));
      expect(v.ok).toBe(false);
      if (!v.ok) {
        expect(v.erreur).toBe("texte_refuse");
        expect(v.plus).toEqual({ regle }); // la règle, jamais l'extrait
      }
    });
  }
  for (const texte of mots.acceptes)
    it(`accepte « ${texte} »`, () => expect(motInterditDans(texte)).toBeNull());
  it("le titre et les puces sont contrôlés aussi", () => {
    expect(erreur(validerContenu(corps({ titre: "Guide Grenoble" })))).toBe("texte_refuse");
    expect(
      erreur(validerContenu(corps({ sections: [{ ...section(), puces: ["Qualiopi"] }] }))),
    ).toBe("texte_refuse");
  });
});

describe("pagesDuPdf", () => {
  it("compte /Type /Page et ignore /Pages", () => {
    const pdf = Buffer.from("/Type /Pages /Kids [1 0 R]\n/Type /Page\n/Type /Page\n");
    expect(pagesDuPdf(pdf)).toBe(2);
  });
});
