import { describe, expect, it } from "vitest";
import {
  collectAnswers,
  labeledAnswers,
  missingRequired,
  normaliserMontant,
  parseScreeningQuestions,
  prixInvalides,
} from "../screening-answers";

const QUESTIONS = parseScreeningQuestions([
  { id: "prix_court", labelFr: "Prix vidéo verticale", required: true },
  { id: "liens", labelFr: "Liens d'exemples", required: false },
  { labelFr: "sans id — ignorée" },
  null,
]);

function form(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("questions propres à l'offre", () => {
  it("ignore les éléments sans id et un JSON qui n'est pas une liste", () => {
    expect(QUESTIONS.map((q) => q.id)).toEqual(["prix_court", "liens"]);
    expect(parseScreeningQuestions({ id: "x" })).toEqual([]);
    expect(parseScreeningQuestions(null)).toEqual([]);
  });

  it("une question obligatoire vide ou blanche est manquante", () => {
    const answers = collectAnswers(form({ answer_prix_court: "   ", answer_liens: "https://x" }));
    expect(missingRequired(QUESTIONS, answers).map((q) => q.id)).toEqual(["prix_court"]);
  });

  it("une question obligatoire remplie ne manque plus, la facultative peut rester vide", () => {
    const answers = collectAnswers(form({ answer_prix_court: "45 € HT" }));
    expect(missingRequired(QUESTIONS, answers)).toEqual([]);
  });

  it("les réponses partent avec leur libellé, dans l'ordre des questions, tronquées", () => {
    const answers = collectAnswers(
      form({ answer_liens: "https://a", answer_prix_court: "x".repeat(500), autre: "ignoré" }),
    );
    const out = labeledAnswers(QUESTIONS, answers, 10);
    expect(out).toEqual([
      { label: "Prix vidéo verticale", value: `${"x".repeat(10)}…` },
      { label: "Liens d'exemples", value: "https://a" },
    ]);
  });
});

describe("prix : UN montant, jamais une fourchette (demande Will 2026-09-26)", () => {
  const Q = parseScreeningQuestions([
    { id: "journee", labelFr: "Prix journée", required: true, type: "price" },
    { id: "materiel", labelFr: "Matériel", type: "short" },
  ]);

  it.each([
    ["250", "250"],
    ["250 €", "250"],
    ["250€", "250"],
    ["1 200", "1200"],
    ["1 200 euros", "1200"],
    ["49,90", "49,90"],
    ["80.5", "80.5"],
  ])("accepte « %s »", (saisie, attendu) => {
    expect(normaliserMontant(saisie)).toBe(attendu);
  });

  it.each([
    "200-300",
    "200 à 300",
    "200/300",
    "à partir de 200",
    "entre 200 et 300",
    "200 ou 250",
    "sur devis",
    "",
  ])("refuse « %s »", (saisie) => {
    expect(normaliserMontant(saisie)).toBeNull();
  });

  it("une fourchette dans un champ prix est signalée ; le texte libre ne l'est jamais", () => {
    expect(
      prixInvalides(Q, { journee: "200 à 300", materiel: "Sony FX3 et 2 à 3 micros" }).map(
        (q) => q.id,
      ),
    ).toEqual(["journee"]);
    expect(prixInvalides(Q, { journee: "250", materiel: "Sony FX3" })).toEqual([]);
  });

  it("Telegram lit un prix « 250 € », quelle que soit la saisie", () => {
    expect(labeledAnswers(Q, { journee: "1 200 euros" })).toEqual([
      { label: "Prix", value: "1200 €" },
    ]);
  });
});

describe("réponses regroupées en lignes Telegram (plafond de 10 lignes)", () => {
  const Q = parseScreeningQuestions([
    { id: "demi", type: "price", court: "demi-journée", labelFr: "Prix demi-journée" },
    { id: "jour", type: "price", court: "journée", labelFr: "Prix journée" },
    { id: "cam", type: "short", ligne: "Matériel", court: "image", labelFr: "Caméra ?" },
    { id: "son", type: "short", ligne: "Matériel", court: "son/lumière", labelFr: "Son ?" },
    { id: "liens", ligne: "Exemples", labelFr: "Liens" },
    { id: "libre", labelFr: "Question libre" },
  ]);

  it("tous les prix sur UNE ligne, les groupes sur la leur, dans l'ordre des questions", () => {
    const out = labeledAnswers(Q, {
      demi: "180",
      jour: "320 €",
      cam: "iPhone 15 Pro",
      son: "Rode GO II",
      liens: "https://a.fr\nhttps://b.fr",
      libre: "oui",
    });
    expect(out).toEqual([
      { label: "Prix", value: "demi-journée 180 € · journée 320 €" },
      { label: "Matériel", value: "image iPhone 15 Pro · son/lumière Rode GO II" },
      { label: "Exemples", value: "https://a.fr · https://b.fr" },
      { label: "Question libre", value: "oui" },
    ]);
  });

  it("une réponse sur plusieurs lignes ne crée jamais de ligne de plus", () => {
    const out = labeledAnswers(Q, { liens: "a\n\nb\n c" });
    expect(out[0]?.value).toBe("a · b · c");
  });
});
