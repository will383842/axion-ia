// @vitest-environment node
/**
 * Documents HTML INTERNES : échappement, synthèse, fiche des automatisations, schéma.
 * Société et personnes FICTIVES.
 */
import { describe, expect, it } from "vitest";

import type { Automatisation, BaseAudit } from "../base-audit-schema";
import { BaseAuditSchema } from "../base-audit-schema";
import { motsInterditsDans } from "../mots-interdits";
import {
  automatisationsHtml,
  libelleConsole,
  NOTE_NON_CHIFFRE,
} from "../sorties/html/automatisations";
import { echapper, html, pageInterne } from "../sorties/html/echapper";
import { heuresParSemaine, libelleHeures } from "../sorties/html/heures";
import { schemaHtml } from "../sorties/html/schema";
import { couper, schemaSvg } from "../sorties/html/schema-svg";
import { logicielsGeneraux, syntheseHtml } from "../sorties/html/synthese";
import { automatisationExemple, baseValide, baseValideV2 } from "./base.fixture";

/** Ajoute deux personnes (une répondante partielle, une absente) à une base de référence. */
function avecPersonnes(b: BaseAudit): BaseAudit {
  const c = structuredClone(b);
  c.fiches_personnes = [
    {
      personne: "emp:ab12",
      identite: { nom: "Camille Exemple", fonction: "Gestionnaire", service: "Gestion" },
      statut: "a_repondu",
      demandes: [{ enonce: "Un seul endroit pour les devis", citation: "Tout au même endroit" }],
      douleurs: [
        {
          enonce: "Ressaisie des devis",
          citation: "Je retape tout deux fois",
          tempsParSemaine: "3 h",
        },
      ],
      taches: [
        {
          libelle: "Saisie des devis",
          frequence: "chaque jour",
          duree: "30 min",
          repetitive: true,
          ressaisie: true,
          outil: "EXCEL",
        },
        {
          libelle: "Envoi des relances",
          frequence: null,
          duree: null,
          repetitive: null,
          ressaisie: null,
          outil: "Gmail",
        },
      ],
      outils: ["Excel", "Éléphant"],
      reserves: [
        { enonce: "Garder la main sur l'envoi", citation: "Je veux relire avant l'envoi" },
      ],
      aVerifierSurPlace: [],
    },
    {
      personne: "attendu:Alex Inventé",
      identite: { nom: "Alex Inventé", fonction: "Comptable", service: null },
      statut: "n_a_pas_repondu",
      demandes: [],
      douleurs: [],
      taches: [],
      outils: [],
      reserves: [],
      aVerifierSurPlace: [
        { question: "Quel logiciel de compta ?", pourquoi: "Aucune réponse reçue" },
      ],
    },
  ];
  c.annexe_reponses = [
    {
      personne: "emp:ab12",
      mode: "emp",
      service: "Gestion",
      statut: "recue",
      versionsRecues: 1,
      recuLe: "2026-11-01T10:00:00Z",
      aVerifier: false,
      reponses: [{ cle: "q1", question: "Votre rôle ?", rubrique: null, reponse: "Gestion" }],
      nonRepondues: [
        {
          cle: "q8",
          question: "Question secondaire sans réponse",
          rubrique: null,
          essentielle: false,
        },
        {
          cle: "q9",
          question: "Question essentielle sans réponse",
          rubrique: null,
          essentielle: true,
        },
      ],
    },
  ];
  c.couverture.personnesAttenduesSansReponse = ["Alex Inventé"];
  return c;
}

describe("gabarit HTML", () => {
  it("échappe & < > \" ' pour toute valeur", () => {
    expect(echapper(`<script>alert(1)</script> " ' &`)).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt; &quot; &#39; &amp;",
    );
    const m = html`<p title="${'" onmouseover=alert(1) x="'}">${"<script>alert(1)</script>"}</p>`;
    expect(m.valeur).not.toContain("<script");
    expect(m.valeur).toContain("&quot; onmouseover=");
    expect(m.valeur).not.toMatch(/title="" onmouseover/);
  });

  it("pageInterne : doctype, CSP, bandeau, ni script ni URL externe", () => {
    const p = pageInterne({ titre: "<b>T</b>", corps: html`<p>${"<script>x</script>"}</p>` });
    expect(p.startsWith("<!doctype html>")).toBe(true);
    expect(p).toContain('<html lang="fr">');
    expect(p).toContain(`content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"`);
    expect(p).toContain("INTERNE : ne jamais transmettre au client");
    expect(p).not.toContain("<script");
    expect(p).not.toMatch(/https?:\/\//);
    expect(p).toContain("&lt;b&gt;T&lt;/b&gt;");
  });

  it("un texte piégé dans une base ressort échappé dans les trois documents", () => {
    const b = avecPersonnes(baseValideV2());
    b.besoins_declares[0]!.enonce = '<script>alert(1)</script> " onmouseover="x';
    b.automatisations!.liste[0]!.titre = "<img src=x onerror=alert(1)>";
    for (const doc of [syntheseHtml(b), automatisationsHtml(b)!, schemaHtml(b)!]) {
      expect(doc).not.toContain("<script");
      expect(doc).not.toContain("<img src=x");
      expect(doc).not.toMatch(/https?:\/\//);
    }
  });
});

describe("synthèse", () => {
  const b = avecPersonnes(baseValideV2());
  const doc = syntheseHtml(b);

  it("suit l'ordre prévu, les besoins avant les difficultés", () => {
    const ordre = [
      "Synthèse interne — Entreprise Exemple",
      "Besoins déclarés",
      "Difficultés, personne par personne",
      "Freins, attentes, budget, formation",
      "Logiciels",
      "Limites et alertes",
    ].map((t) => doc.indexOf(t));
    expect(ordre.every((i) => i >= 0)).toBe(true);
    expect([...ordre].sort((x, y) => x - y)).toEqual(ordre);
  });

  it("en-tête : répondants, direction, attendus sans réponse", () => {
    expect(doc).toContain("1 personne(s) ont répondu");
    expect(doc).toContain("Président");
    expect(doc).toContain("Alex Inventé");
  });

  it("personne sans réponse : « N'a pas répondu » et ses questions", () => {
    expect(doc).toContain("N'a pas répondu.");
    expect(doc).toContain("Quel logiciel de compta ?");
  });

  it("réponse partielle : le non-répondu est listé, l'essentiel en tête", () => {
    const i1 = doc.indexOf("Question essentielle sans réponse");
    const i2 = doc.indexOf("Question secondaire sans réponse");
    expect(i1).toBeGreaterThan(0);
    expect(i2).toBeGreaterThan(i1);
  });

  it("un « non » déclaré n'est pas un « non répondu », ni un « ne sait pas »", () => {
    const c = structuredClone(b);
    c.contexte_interne!.formation = {
      etat: "declare",
      elements: [
        {
          enonce: "Non, aucune formation prévue",
          citations: [{ texte: "Non, pas de formation", personne: "main", auteur: "Dirigeante" }],
        },
      ],
    };
    const d = syntheseHtml(c);
    expect(d).toContain("Non, aucune formation prévue");
    // La rubrique formation (déclarée) n'a ni le libellé « non répondu » ni « ne sait pas » : seuls attentes (ne sait pas) et…
    expect(d.match(/Non répondu : aucune réponse reçue/g)).toBeNull();
    expect(d).toContain("la personne ne sait pas");
    // Et l'état « non répondu » a son propre libellé.
    expect(doc).toContain("Non répondu : aucune réponse reçue sur ce point.");
    expect(doc).toContain("la personne ne sait pas");
  });

  it("une base V1 : « non extrait dans cette version, relancer l'analyse »", () => {
    const v1 = syntheseHtml(avecPersonnes(baseValide()));
    expect(v1).toContain("Non extrait dans cette version");
    expect(v1).toContain("relancer l&#39;analyse");
  });

  it("logiciels : union sans doublon (casse et accents), usage tiré des tâches, sans nom de personne", () => {
    const g = logicielsGeneraux(b.fiches_personnes);
    expect(g.map((x) => x.nom).sort()).toEqual(["Excel", "Gmail", "Éléphant"].sort());
    expect(g.find((x) => x.nom === "Excel")!.usages).toContain("Saisie des devis");
    const section = doc.slice(doc.indexOf("Liste générale"));
    expect(section.split("</table>")[0]).not.toContain("Camille");
    expect(doc).toContain("Gestionnaire"); // par poste, jamais par nom
  });

  it("aucun mot interdit", () => {
    expect(motsInterditsDans(doc)).toEqual([]);
  });
});

describe("heures", () => {
  const t = (o: Partial<Parameters<typeof heuresParSemaine>[0][number]>) => ({
    libelle: "x",
    citation: "x",
    occurrences: null,
    periode: null,
    minutesMin: null,
    minutesMax: null,
    ...o,
  });

  it("3 fois par jour × 30 min = 7,5 h par semaine", () => {
    const h = heuresParSemaine([
      t({ occurrences: 3, periode: "jour", minutesMin: 30, minutesMax: 30 }),
    ]);
    expect(h).toBe(7.5);
    expect(libelleHeures(h)).toBe("7,5 h / sem.");
  });

  it("par semaine ×1, par mois ÷ 4,33, arrondi à 0,5", () => {
    expect(heuresParSemaine([t({ occurrences: 2, periode: "semaine", minutesMax: 60 })])).toBe(2);
    expect(heuresParSemaine([t({ occurrences: 4.33, periode: "mois", minutesMax: 60 })])).toBe(1);
    expect(heuresParSemaine([t({ occurrences: 1, periode: "jour", minutesMax: 17 })])).toBe(1.5);
  });

  it("donnée manquante : « Non chiffré »", () => {
    expect(heuresParSemaine([t({ occurrences: 3, periode: "jour" })])).toBeNull();
    expect(heuresParSemaine([t({ minutesMax: 30 })])).toBeNull();
    expect(heuresParSemaine([])).toBeNull();
    expect(libelleHeures(null)).toBe("Non chiffré");
  });
});

describe("fiche des automatisations", () => {
  const b = baseValideV2();
  const doc = automatisationsHtml(b)!;

  it("rend null pour une base V1", () => {
    expect(automatisationsHtml(baseValide())).toBeNull();
    expect(schemaHtml(baseValide())).toBeNull();
  });

  it("classement, note « Non chiffré », une carte par automatisation, prix à fixer par Will", () => {
    expect(doc).toContain("Classement");
    expect(doc).toContain(echapper(NOTE_NON_CHIFFRE));
    expect(doc).toContain("7,5 h / sem.");
    expect(doc).toContain("Non chiffré");
    for (const id of ["A1", "A2", "A3"]) expect(doc).toContain(`<h3>${id} — `);
    expect(doc).toContain("Prix : à fixer par Will.");
    expect(doc).not.toMatch(/\d\s*€/);
    expect(doc.indexOf("Formules")).toBeGreaterThan(doc.indexOf("<h3>A3"));
    expect(doc.indexOf("Questions communes")).toBeGreaterThan(doc.indexOf("Formules"));
  });

  it("console : V1 seulement pour le tri de boîte mail", () => {
    expect(libelleConsole(b.automatisations!.liste[0]!)).toBe("V1");
    expect(libelleConsole(b.automatisations!.liste[1]!)).toBe("V2 ou plus tard");
  });

  it("automatisations null : page « non produite » et limites", () => {
    const c = baseValideV2();
    const n = automatisationsHtml({
      ...c,
      automatisations: null,
      meta: { ...c.meta, limites: ["Étape interrompue"] },
    })!;
    expect(n).toContain("Fiche non produite");
    expect(n).toContain("Étape interrompue");
  });

  it("aucun mot interdit, pas de « vous »", () => {
    expect(motsInterditsDans(doc)).toEqual([]);
  });
});

describe("schéma des dépendances", () => {
  const b = baseValideV2();
  const doc = schemaHtml(b)!;

  it("contient les trois colonnes, les boîtes, une flèche, la légende", () => {
    for (const t of ["Sans prérequis", "Autour de la base unique", "À étudier ensemble"]) {
      expect(doc).toContain(t);
    }
    expect(doc).toContain("<svg");
    expect((doc.match(/marker-end/g) ?? []).length).toBe(1); // A1 → A2
    expect(doc).toContain("★");
    expect(doc).toContain("Légende");
  });

  it("coupe les titres à ~28 caractères", () => {
    expect(couper("x".repeat(60)).length).toBe(28);
    const l: Automatisation[] = [automatisationExemple("A1", { titre: "y".repeat(60) })];
    expect(schemaSvg(l)).not.toContain("y".repeat(40));
  });

  it("maquette marquée « valeurs fictives » avec compteur d'IA, puis formules et « Comment avancer »", () => {
    expect(doc).toContain("valeurs fictives");
    expect(doc).toContain("Compteur d'IA commun");
    expect(doc.indexOf("Formules")).toBeGreaterThan(doc.indexOf("Maquette"));
    expect(doc.indexOf("Comment avancer")).toBeGreaterThan(doc.indexOf("Formules"));
  });

  it("ton interne : aucun « vous / votre / vos » dans tout le document", () => {
    expect(doc).not.toMatch(/\b(vous|votre|vos)\b/i);
    expect(automatisationsHtml(b)).not.toMatch(/\b(vous|votre|vos)\b/i);
  });

  it("aucune URL externe, aucun script", () => {
    expect(doc).not.toMatch(/https?:\/\//);
    expect(doc).not.toContain("<script");
  });

  it("la base V2 de test reste valide", () => {
    expect(BaseAuditSchema.safeParse(b).success).toBe(true);
  });
});
