// @vitest-environment node
// G3 — validation PURE du contenu d'un guide fabriqué : bornes, empreinte, mots interdits.
import { describe, it, expect } from "vitest";
import {
  INTERDITS_CARACTERES,
  contientCaractereInterdit,
  titreGuideFabrique,
  validerContenu,
  empreinteTexte,
  jsonCanoniqueGuide,
  pagesDuPdf,
  type ContenuGuide,
} from "../fabrique-pdf";
import { motInterditDans, REGLES_MOTS_INTERDITS } from "../mots-interdits-guide";
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

describe("empreinte du texte (identique au Studio)", () => {
  const contenu = vecteur.contenu as Pick<ContenuGuide, "titre" | "sections">;
  it("vecteur fixe du Studio : JSON canonique identique", () => {
    expect(jsonCanoniqueGuide(contenu)).toBe(vecteur.jsonCanonique);
  });
  it("vecteur fixe du Studio : même empreinte SHA-256 (64 hex minuscules)", () => {
    expect(empreinteTexte(contenu)).toBe(vecteur.empreinte);
    expect(vecteur.empreinte).toMatch(/^[0-9a-f]{64}$/);
  });
  it("l'ordre des clés d'entrée ne change rien", () => {
    const melange = {
      sections: contenu.sections.map((s) => ({
        puces: s.puces,
        paragraphes: s.paragraphes,
        titre: s.titre,
      })),
      titre: contenu.titre,
    };
    expect(empreinteTexte(melange)).toBe(vecteur.empreinte);
  });
  it("NFC et NFD donnent la même empreinte", () => {
    const nfd = JSON.parse(JSON.stringify(contenu).normalize("NFD")) as typeof contenu;
    expect(empreinteTexte(nfd)).toBe(vecteur.empreinte);
  });
  it("code et version ne font pas partie de l'empreinte (comme au Studio)", () => {
    expect(empreinteTexte({ code: "gde-essai-01", version: 7, ...contenu } as ContenuGuide)).toBe(
      vecteur.empreinte,
    );
  });
  it("l'ordre des paragraphes, lui, compte", () => {
    const inverse = {
      ...contenu,
      sections: contenu.sections.map((s, i) =>
        i === 0 ? { ...s, paragraphes: [...s.paragraphes].reverse() } : s,
      ),
    };
    expect(empreinteTexte(inverse)).not.toBe(vecteur.empreinte);
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
    for (const t of ["a\u0000b", "a\u202Eb", "a\u200Bb", "a\u0007b"]) {
      expect(
        erreur(validerContenu(corps({ sections: [{ ...section(), paragraphes: [t] }] }))),
      ).toBe("corps_invalide");
    }
  });
  it("titre invalide (contrôle)", () => {
    expect(erreur(validerContenu(corps({ titre: "Mon\u202Eguide" })))).toBe("titre_invalide");
  });
  it("empreinte fausse → empreinte_differente", () => {
    expect(erreur(validerContenu(corps({ sha256Texte: "0".repeat(64) })))).toBe(
      "empreinte_differente",
    );
  });
});

describe("mots interdits (3e contrôle) : liste identique à celle du Studio", () => {
  it("fixture = liste du code (ids, motifs, exemples, ordre)", () => {
    expect(mots.version).toBe(3);
    expect(REGLES_MOTS_INTERDITS).toEqual(mots.regles);
  });
  it("règles non vides, ids uniques", () => {
    const ids = mots.regles.map((r) => r.id);
    expect(ids.length).toBeGreaterThan(10);
    expect(new Set(ids).size).toBe(ids.length);
  });
  for (const r of mots.regles) {
    for (const ex of r.exemples) {
      it(`refuse « ${ex} » (${r.id})`, () => {
        // un exemple peut enfreindre une règle placée AVANT la sienne : on exige un refus, et la sienne seule si elle est première
        expect(motInterditDans(ex)).not.toBeNull();
        const v = validerContenu(corps({ sections: [{ ...section(), paragraphes: [ex] }] }));
        expect(v.ok).toBe(false);
        if (!v.ok) {
          expect(v.erreur).toBe("texte_refuse");
          expect(Object.keys(v.plus ?? {})).toEqual(["regle"]); // la règle, jamais l'extrait
        }
      });
    }
  }
  it("chaque règle est atteinte par ses exemples, dans l'ordre de la liste", () => {
    for (const r of mots.regles) {
      const premiere = motInterditDans(r.exemples);
      expect(mots.regles.map((x) => x.id).indexOf(premiere as string)).toBeLessThanOrEqual(
        mots.regles.findIndex((x) => x.id === r.id),
      );
    }
  });
  it("acceptations du Studio : « 1080 x 1920 », « x64 », « Max 3 », texte ordinaire", () => {
    for (const t of [
      "Format 1080 x 1920",
      "Version x64",
      "Max 3 posts",
      "Un guide simple, à suivre pas à pas.",
    ])
      expect(motInterditDans(t)).toBeNull();
  });
  it("chaque texte est contrôlé séparément (rien ne s'enjambe)", () => {
    expect(motInterditDans(["Aucun gain", "garanti"])).toBe("garanti");
    expect(motInterditDans(["Aucun gain", "garantie"])).not.toBe("aucun-gain-garanti");
    expect(motInterditDans(["Un", "abonn"])).toBe("abonne");
  });
  it("normalisation : majuscules, accents, apostrophe typographique", () => {
    expect(motInterditDans("GRENOBLE")).toBe("grenoble");
    expect(motInterditDans("Je t\u2019explique")).toBe("tutoiement");
    expect(motInterditDans("R\u00E9abonnement")).toBe("abonne");
  });
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

// Source de `INTERDITS_CARACTERES` du Studio (guide-contenu.ts, branche master), recopiée mot pour mot.
const SOURCE_STUDIO = String.raw`[\u0000-\u001F\u007F-\u009F\u00AD\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u2028-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\u{E0000}-\u{E0FFF}]|\p{Default_Ignorable_Code_Point}`;

describe("filtre de caractères : identique à celui du Studio", () => {
  it("même source et même drapeau que le Studio", () => {
    expect(INTERDITS_CARACTERES.source).toBe(SOURCE_STUDIO);
    expect(INTERDITS_CARACTERES.flags).toBe("u");
  });
  const refuses: Array<[string, string]> = [
    ["trait d'union conditionnel", "abon\u00ADnement"],
    ["joint de mot", "Gre\u2060noble"],
    ["sélecteur de variation", "Qualio\uFE0Fpi"],
    ["étiquette U+E0041", "garan\u{E0041}ti"],
    ["tabulation", "a\u0009b"],
    ["saut de ligne", "a\u000Ab"],
    ["demi-caractère isolé", "a\uD800b"],
  ];
  for (const [nom, t] of refuses) {
    it(`refuse : ${nom}`, () => {
      const c = {
        code: "gde-essai-01",
        version: 1,
        sha256Texte: "0".repeat(64),
        titre: "Guide",
        sections: [section()],
      };
      for (const champ of ["titre", "section", "paragraphe", "puce"]) {
        const sections: ReturnType<typeof section>[] = [section()];
        let titre = "Guide";
        if (champ === "titre") titre = t;
        if (champ === "section") sections[0] = { ...section(), titre: t };
        if (champ === "paragraphe") sections[0] = { ...section(), paragraphes: [t] };
        if (champ === "puce") sections[0] = { ...section(), puces: [t] };
        const v = validerContenu({ ...c, titre, sections });
        expect(v.ok).toBe(false);
        expect(erreur(v)).toBe(champ === "titre" ? "titre_invalide" : "corps_invalide");
      }
      expect(titreGuideFabrique(t)).toBeNull();
    });
  }
  it("contientCaractereInterdit : texte ordinaire accepté", () => {
    expect(contientCaractereInterdit("Le plan d'été — édition 2026")).toBe(false);
  });
});

describe("titre du guide fabriqué : schéma du Studio (1 à 120, sans trim)", () => {
  it("1 ou 2 caractères acceptés, 121 refusé, vide refusé, non-chaîne refusé", () => {
    for (const t of ["a", "ab", "a".repeat(120)]) {
      expect(erreur(validerContenu(corps({ titre: t })))).toBeNull();
    }
    expect(titreGuideFabrique("a".repeat(121))).toBeNull();
    expect(titreGuideFabrique("")).toBeNull();
    expect(titreGuideFabrique(7)).toBeNull();
  });
  it("espaces de bord conservés : même empreinte que le Studio, pas de 422", () => {
    const titre = "  Mon guide  ";
    const v = validerContenu(corps({ titre }));
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.contenu.titre).toBe(titre);
      expect(v.sha256Texte).toBe(empreinteTexte({ titre, sections: [section()] }));
    }
  });
  it("vecteur EMPREINTE du Studio inchangé", () => {
    expect(vecteur.empreinte).toBe(
      "9c545807feb53583e1e672a2ad7efc0df971e9338955ddb9f8d4a5407c33b67c",
    );
    expect(empreinteTexte(vecteur.contenu as Pick<ContenuGuide, "titre" | "sections">)).toBe(
      vecteur.empreinte,
    );
  });
});
