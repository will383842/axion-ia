// @vitest-environment node
/**
 * Sorties de la base d'audit : vue client, PDF client, Markdown, JSON, fiche par personne.
 * Société et personnes FICTIVES, écrites à la main.
 */
import React from "react";
import { describe, expect, it } from "vitest";

import { BaseAuditSchema, SECTIONS_ANALYSE, VERSION_BASE_AUDIT } from "../base-audit-schema";
import type { BaseAudit } from "../base-audit-schema";
import { motsInterditsDans } from "../mots-interdits";
import { baseEnJson, baseEnMarkdown } from "../sorties/base-markdown";
import { ficheEnMarkdown } from "../sorties/fiche-personne-markdown";
import { filtrerPourClient, nomsConnus } from "../sorties/filtre-client";
import { genererPdfClient, MENTION_IA, RapportClientPdf } from "../sorties/pdf-client";
import { collectPdfTextNormalized } from "@/server/qualiopi/documents/collect-pdf-text";

const Q = (personne: string) =>
  ({ type: "questionnaire", reference: "Réponse", personne }) as const;
const REG = {
  type: "registre",
  reference: "Annuaire des entreprises",
  url: "https://exemple.fr/a",
} as const;

function exemple(): BaseAudit {
  const vide = { resume: "", elements: [] as unknown[] };
  const brute = {
    version: VERSION_BASE_AUDIT,
    meta: {
      clientId: "22222222-2222-4222-8222-222222222222",
      raisonSociale: "Ateliers Bois-Joli SARL",
      generePar: "test",
      genereLe: "2026-11-02T10:00:00Z",
      questionnaires: ["q1"],
      complet: true,
      limites: ["Note interne : la gérante semble réticente"],
      reponseDirection: { fournieParUnDirigeant: "oui", repondant: "Gérante", remarque: "" },
    },
    besoins_declares: [
      {
        id: "B1",
        categorie: "douleur",
        enonce: "Les devis prennent trop de temps",
        citations: [
          { texte: "Je passe mes soirées sur les devis", auteur: "Gérante" },
          {
            texte: "Odile Fontbrune refait chaque devis à la main",
            auteur: "Collaborateur — Atelier",
          },
        ],
        nbPersonnes: 2,
        intensite: "fort",
        divergence: "La gérante minimise, l'atelier non",
      },
    ],
    equipe_analyse: [],
    ...Object.fromEntries(SECTIONS_ANALYSE.map((k) => [k, vide])),
    activite_offre: {
      resume: "Résumé interne sûr de lui",
      elements: [
        {
          libelle: "Activité",
          valeur: "Fabrication de meubles sur mesure",
          provenance: "declare",
          confiance: "etabli",
          sources: [Q("Gérante")],
        },
        {
          libelle: "Export",
          valeur: "Vend peut-être en Belgique",
          provenance: "trouve",
          confiance: "hypothese",
          sources: [REG],
        },
        {
          libelle: "Équipe",
          valeur: "Odile Fontbrune encadre l'atelier",
          provenance: "declare",
          confiance: "probable",
          sources: [Q("Gérante")],
        },
      ],
    },
    evolution_financiere: {
      exercices: [
        {
          annee: 2023,
          chiffreAffairesEur: 900000,
          resultatNetEur: 40000,
          effectif: "8",
          confiance: "etabli",
          sources: [REG],
        },
        {
          annee: 2024,
          chiffreAffairesEur: 1000000,
          resultatNetEur: 52000,
          effectif: "9",
          confiance: "etabli",
          sources: [REG],
        },
      ],
      tendance: "croissance",
      tauxAnnuelMoyenPct: 11.1,
      lecture: "Activité en progression régulière.",
      limites: [],
    },
    pistes: [
      {
        id: "P1",
        titre: "Automatiser les devis",
        description: "Générer un devis depuis la demande",
        besoinsServis: ["B1"],
        horsDemande: false,
        gain: "fort",
        effort: "moyen",
        rang: 1,
        sources: [REG],
      },
      {
        id: "P2",
        titre: "Veille tarifaire",
        description: "Suivre les prix des fournisseurs",
        besoinsServis: [],
        horsDemande: true,
        gain: "moyen",
        effort: "faible",
        rang: null,
        sources: [],
      },
    ],
    contradictions: [
      { sujet: "Nombre de salariés", versionA: "8", versionB: "12", sources: [Q("Gérante")] },
    ],
    questions_jour_j: [
      {
        question: "Comment sont chiffrés les devis aujourd'hui ?",
        pourquoi: "Odile Fontbrune est évasive",
        besoinId: "B1",
      },
    ],
    propositions_fiche: [],
    couverture: {
      personnesAvecReponse: 2,
      reponsesDonnees: 12,
      questionsSansReponse: 3,
      personnesAttenduesSansReponse: ["Hugo Valmorel"],
      alertes: [],
    },
    fiches_personnes: [
      {
        personne: "main",
        identite: { nom: "Solène Marchaudon", fonction: "Gérante", service: "Direction" },
        statut: "a_repondu",
        demandes: [{ enonce: "Gagner du temps", citation: "Je veux souffler", besoinId: "B1" }],
        douleurs: [
          {
            enonce: "Devis refaits plusieurs fois",
            citation: "Je recommence tout",
            tempsParSemaine: "6 h",
            besoinId: "B1",
          },
        ],
        taches: [
          {
            libelle: "Saisie des devis",
            frequence: "quotidienne",
            duree: "1 h",
            repetitive: true,
            ressaisie: true,
            outil: "Tableur",
          },
        ],
        outils: ["Tableur"],
        reserves: [
          {
            enonce: "Pas de changement d'outil de compta",
            citation: "On ne touche pas à la compta",
          },
        ],
        aVerifierSurPlace: [
          { question: "Qui valide les devis ?", pourquoi: "Flou dans les réponses" },
        ],
      },
      {
        personne: "emp:ab12",
        identite: { nom: "Odile Fontbrune", fonction: "Cheffe d'atelier", service: "Atelier" },
        statut: "a_repondu",
        demandes: [],
        douleurs: [
          {
            enonce: "Plans ressaisis à la main",
            citation: "Je ressaisis tout",
            tempsParSemaine: "4 h",
          },
        ],
        taches: [],
        outils: [],
        reserves: [],
        aVerifierSurPlace: [],
      },
      {
        personne: "attendu:Hugo Valmorel",
        identite: { nom: "Hugo Valmorel", fonction: "Commercial", service: "Vente" },
        statut: "n_a_pas_repondu",
        demandes: [],
        douleurs: [],
        taches: [],
        outils: [],
        reserves: [],
        aVerifierSurPlace: [
          { question: "Comment suit-il les relances ?", pourquoi: "Aucune réponse reçue" },
        ],
      },
    ],
    annexe_reponses: [
      {
        personne: "main",
        mode: "main",
        service: "Direction",
        statut: "recue",
        versionsRecues: 1,
        recuLe: "2026-10-30",
        aVerifier: false,
        reponses: [
          { cle: "q1", question: "Votre priorité ?", rubrique: "Vision", reponse: "Les devis" },
        ],
        nonRepondues: [{ cle: "q2", question: "Budget ?", rubrique: null, essentielle: true }],
      },
      {
        personne: "emp:ab12",
        mode: "emp",
        service: "Atelier",
        statut: "recue",
        versionsRecues: 1,
        recuLe: "2026-10-31",
        aVerifier: true,
        reponses: [],
        nonRepondues: [],
      },
    ],
    sources: [REG, Q("Gérante")],
  };
  return BaseAuditSchema.parse(brute);
}

const NOMS = ["Solène", "Marchaudon", "Odile", "Fontbrune", "Hugo", "Valmorel"];

describe("filtre client", () => {
  const vue = filtrerPourClient(exemple());
  const json = JSON.stringify(vue);

  it("ne contient aucun nom de personne ni auteur de citation", () => {
    for (const n of NOMS) expect(json).not.toContain(n);
    expect(json).not.toContain("Collaborateur");
    expect(json).not.toContain("attendu:");
    expect(nomsConnus(exemple())).toContain("Fontbrune");
  });

  it("écarte la citation qui nomme quelqu'un et garde les autres, sans auteur", () => {
    expect(vue.besoins[0]!.motsDesEquipes).toEqual(["Je passe mes soirées sur les devis"]);
  });

  it("ne montre aucune hypothèse, contradiction, doute, note interne ni annexe", () => {
    expect(json).not.toContain("Belgique");
    expect(json).not.toContain("Nombre de salariés");
    expect(json).not.toContain("réticente");
    expect(json).not.toContain("minimise");
    expect(json).not.toContain("Résumé interne");
    expect(json).not.toContain("Votre priorité");
    expect(json).not.toContain("Pourquoi");
    expect(json).not.toContain("évasive");
    expect(Object.keys(vue)).not.toContain("annexe_reponses");
  });

  it("garde les éléments probables, avec le nom retiré", () => {
    const valeurs = vue.comprehension.flatMap((s) => s.elements.map((e) => e.valeur));
    expect(valeurs).toContain("Fabrication de meubles sur mesure");
    expect(valeurs).toContain("un collaborateur encadre l'atelier");
  });

  it("présente les difficultés par service, sans temps individuel", () => {
    const services = vue.difficultesParService.map((d) => d.service);
    expect(services).toEqual(["Atelier", "Direction"]);
    expect(json).not.toContain("6 h");
    expect(json).not.toContain("4 h");
  });

  it("classe les pistes, rappelle le besoin servi, et isole les pistes hors demande", () => {
    expect(vue.pistes).toHaveLength(1);
    expect(vue.pistes[0]!.besoinsServis[0]!.enonce).toBe("Les devis prennent trop de temps");
    expect(vue.pistesHorsDemande.map((p) => p.id)).toEqual(["P2"]);
    expect(JSON.stringify(vue.pistesHorsDemande)).not.toContain("rang");
  });

  it("ne cite que les sources trouvées (pas les questionnaires)", () => {
    expect(vue.sources).toEqual([
      { reference: "Annuaire des entreprises", url: "https://exemple.fr/a" },
    ]);
  });

  it("ne modifie pas la base", () => {
    const b = exemple();
    const avant = JSON.stringify(b);
    filtrerPourClient(b);
    expect(JSON.stringify(b)).toBe(avant);
  });
});

describe("mots interdits et PDF client", () => {
  const base = exemple();
  const vue = filtrerPourClient(base);

  it("aucun mot interdit dans la vue client", () => {
    expect(motsInterditsDans(JSON.stringify(vue))).toEqual([]);
    expect(motsInterditsDans(collectPdfTextNormalized(<RapportClientPdf vue={vue} />))).toEqual([]);
  });

  it("le détecteur détecte bien les mots interdits (garde-fou du test)", () => {
    expect(motsInterditsDans("Organisme certifié Qualiopi à Grenoble, gain garanti")).toHaveLength(
      4,
    );
  });

  it("l'arbre du PDF porte la mention IA, 'Ce que vous nous avez dit' avant le reste, et aucun nom", () => {
    const t = collectPdfTextNormalized(<RapportClientPdf vue={vue} />);
    expect(t).toContain(MENTION_IA);
    expect(t.indexOf("Ce que vous nous avez dit")).toBeLessThan(
      t.indexOf("Ce que nous avons compris"),
    );
    for (const n of NOMS) expect(t).not.toContain(n);
  });

  it("rend un vrai PDF, sans mot interdit ni nom dans le texte extrait", async () => {
    const buffer = await genererPdfClient(base);
    expect(buffer.byteLength).toBeGreaterThan(2000);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const { extractText, getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(doc, { mergePages: true });
    const extrait = Array.isArray(text) ? text.join(" ") : text;
    expect(extrait).toContain("Rapport");
    expect(motsInterditsDans(extrait)).toEqual([]);
    for (const n of NOMS) expect(extrait).not.toContain(n);
  }, 30_000);
});

describe("Markdown, JSON et fiche", () => {
  const base = exemple();

  it("le Markdown est complet, besoins en premier", () => {
    const md = baseEnMarkdown(base);
    expect(md.indexOf("Ce que le client nous a dit")).toBeLessThan(
      md.indexOf("Analyse par section"),
    );
    for (const x of [
      "Nombre de salariés",
      "Comment sont chiffrés",
      "Fiche d'entretien — Solène Marchaudon",
      "Votre priorité ?",
      "Budget ?",
      "Belgique",
      "Veille tarifaire",
    ]) {
      expect(md).toContain(x);
    }
  });

  it("le JSON est indenté et se relit à l'identique", () => {
    const j = baseEnJson(base);
    expect(j).toContain('\n  "version"');
    expect(JSON.parse(j)).toEqual(base);
  });

  it("la fiche d'une personne a répondu : citations, temps par semaine, questions", () => {
    const md = ficheEnMarkdown(base.fiches_personnes[0]!);
    for (const x of [
      "Solène Marchaudon",
      "> Je veux souffler",
      "6 h",
      "Saisie des devis",
      "Tableur",
      "On ne touche pas à la compta",
      "Qui valide les devis ?",
    ]) {
      expect(md).toContain(x);
    }
    expect(md).not.toContain("n'a pas répondu");
  });

  it("la fiche d'une personne sans réponse porte le bandeau et les questions", () => {
    const md = ficheEnMarkdown(base.fiches_personnes[2]!);
    expect(md).toContain("n'a pas répondu");
    expect(md).toContain("Comment suit-il les relances ?");
  });
});
