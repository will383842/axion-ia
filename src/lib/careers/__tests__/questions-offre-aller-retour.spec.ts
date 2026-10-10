// L13 (paquet 4a) — les questions d'une offre sans JSON.
//
// 🔴 La promesse : pour les MÊMES questions, l'éditeur produit le MÊME JSON que
// l'ancien champ. Prouvé par aller-retour sur les offres d'exemple du dépôt
// (amorçage recrutement, offres vidéo freelance des tests de tri par prix) et
// sur une offre « monteur » qui porte toutes les clés que l'éditeur ne montre
// pas (`court`, `ligne`, `groupe`, `attendus`, `labelEn`).

import { describe, expect, it } from "vitest";

import { OFFRES_DEMO_RECRUTEMENT } from "../../../../prisma/seeds/recrutement";
import { parseScreeningQuestions } from "../screening-answers";
import {
  ajouterQuestion,
  clesConservees,
  deplacerQuestion,
  ecrireQuestions,
  lireQuestions,
  modifierQuestion,
  supprimerQuestion,
  typeInconnu,
  type QuestionStockee,
} from "../questions-offre";

/** Offres vidéo freelance — les questions des tests de tri par prix. */
const OFFRES_VIDEO: QuestionStockee[][] = [
  [
    { id: "demi_journee", labelFr: "Prix demi-journée", type: "price", required: true },
    { id: "journee", labelFr: "Prix journée", type: "price", required: true },
    { id: "materiel", labelFr: "Matériel image", type: "short", required: true },
  ],
  [
    { id: "prix_horizontal", labelFr: "Prix horizontal", type: "price" },
    { id: "prix_vertical", labelFr: "Prix vertical", type: "price", required: true },
    { id: "liens", labelFr: "Liens d'exemples" },
  ],
];

/** Une offre « monteur » complète : toutes les clés que l'éditeur ne montre pas. */
const MONTEUR: QuestionStockee[] = [
  {
    id: "prix_30s",
    labelFr: "Votre prix pour une vidéo verticale de 30 secondes",
    labelEn: "Your price for a 30-second vertical video",
    type: "price",
    required: true,
    court: "30 s",
    groupe: "Vos prix",
    attendus: ["hook dès la 1re seconde", "sous-titres"],
  },
  { id: "materiel", labelFr: "Logiciel de montage", type: "short", ligne: "Matériel" },
  { id: "liens", labelFr: "2 ou 3 liens vers vos montages", required: false, ligne: "Exemples" },
];

const FIXTURES: Array<[string, QuestionStockee[]]> = [
  ...OFFRES_DEMO_RECRUTEMENT.filter((o) => o.questions.length > 0).map(
    (o) =>
      [`amorçage « ${o.cle} »`, o.questions as unknown as QuestionStockee[]] as [
        string,
        QuestionStockee[],
      ],
  ),
  ["vidéaste freelance tournage", OFFRES_VIDEO[0]!],
  ["monteur vidéo freelance (tests de tri)", OFFRES_VIDEO[1]!],
  ["monteur vidéo complet", MONTEUR],
];

describe("aller-retour : le JSON produit est IDENTIQUE à l'ancien", () => {
  it("les fixtures couvrent bien l'amorçage (au moins trois offres avec questions)", () => {
    expect(FIXTURES.filter(([n]) => n.startsWith("amorçage")).length).toBeGreaterThanOrEqual(3);
  });

  it.each(FIXTURES)("%s : lu puis réécrit, octet pour octet", (_nom, questions) => {
    // La page d'édition sert le champ par `JSON.stringify` (fmtJson).
    const ancien = JSON.stringify(questions);
    const lu = lireQuestions(ancien);
    expect(lu.ok).toBe(true);
    if (!lu.ok) return;
    expect(ecrireQuestions(lu.questions)).toBe(ancien);
  });

  it.each(FIXTURES)("%s : une édition qui ne change rien ne change rien", (_nom, questions) => {
    const ancien = JSON.stringify(questions);
    const lu = lireQuestions(ancien);
    if (!lu.ok) throw new Error("illisible");
    let q = lu.questions;
    q = modifierQuestion(q, 0, { champ: "labelFr", valeur: q[0]!.labelFr ?? "" });
    q = modifierQuestion(q, 0, { champ: "type", valeur: q[0]!.type ?? "" });
    q = modifierQuestion(q, 0, { champ: "required", valeur: q[0]!.required === true });
    if (q.length > 1) q = deplacerQuestion(deplacerQuestion(q, 0, 1), 1, -1);
    expect(ecrireQuestions(q)).toBe(ancien);
  });

  it("les clés que l'éditeur ne montre pas traversent une vraie modification", () => {
    const q = modifierQuestion(MONTEUR, 0, { champ: "labelFr", valeur: "Prix 30 s" });
    expect(q[0]).toEqual({ ...MONTEUR[0], labelFr: "Prix 30 s" });
    expect(Object.keys(q[0]!)).toEqual(Object.keys(MONTEUR[0]!));
    expect(clesConservees(q[0]!)).toEqual(["labelEn", "court", "groupe", "attendus"]);
  });

  it("le formulaire public lit ce que l'éditeur écrit (même validation qu'avant)", () => {
    let q = ajouterQuestion([]);
    q = modifierQuestion(q, 0, { champ: "labelFr", valeur: "Votre prix journée" });
    q = modifierQuestion(q, 0, { champ: "type", valeur: "price" });
    q = modifierQuestion(q, 0, { champ: "required", valeur: true });
    const texte = ecrireQuestions(q);
    expect(JSON.parse(texte)).toEqual([
      { id: q[0]!.id, labelFr: "Votre prix journée", required: true, type: "price" },
    ]);
    expect(parseScreeningQuestions(JSON.parse(texte))).toHaveLength(1);
  });
});

describe("gestes de l'éditeur", () => {
  const trois: QuestionStockee[] = [
    { id: "a", labelFr: "A" },
    { id: "b", labelFr: "B" },
    { id: "c", labelFr: "C" },
  ];

  it("ajouter : un identifiant libre, jamais un doublon, les existants intacts", () => {
    const q = ajouterQuestion([{ id: "q2", labelFr: "x" }]);
    expect(q).toHaveLength(2);
    expect(q[0]).toEqual({ id: "q2", labelFr: "x" });
    expect(q[1]!.id).not.toBe("q2");
    expect(q[1]!.id).toMatch(/^q[a-z0-9]+$/);
  });

  // 🔴 Relecture 2026-10-09 : les réponses reçues sont indexées par identifiant.
  // Un identifiant de question supprimée réattribué à la suivante rattacherait
  // ces réponses à la MAUVAISE question. Un identifiant n'est JAMAIS réutilisé.
  it("🔴 l'identifiant d'une question supprimée n'est jamais réattribué", () => {
    const deux = ajouterQuestion(ajouterQuestion([]));
    const supprimee = deux[1]!.id;
    const apres = ajouterQuestion(supprimerQuestion(deux, 1));
    expect(apres.map((x) => x.id)).not.toContain(supprimee);

    // Même scénario sur des identifiants posés à la main (q1, q2, q3).
    const anciens: QuestionStockee[] = [{ id: "q1" }, { id: "q2" }, { id: "q3" }];
    const ajoutee = ajouterQuestion(supprimerQuestion(anciens, 2)).at(-1)!;
    expect(["q1", "q2", "q3"]).not.toContain(ajoutee.id);
  });

  it("🔴 cent ajouts → cent identifiants distincts", () => {
    let q: QuestionStockee[] = [];
    for (let i = 0; i < 100; i++) q = ajouterQuestion(q);
    expect(new Set(q.map((x) => x.id)).size).toBe(100);
  });

  it("supprimer et réordonner", () => {
    expect(supprimerQuestion(trois, 1).map((x) => x.id)).toEqual(["a", "c"]);
    expect(deplacerQuestion(trois, 2, -1).map((x) => x.id)).toEqual(["a", "c", "b"]);
    expect(deplacerQuestion(trois, 0, -1).map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(deplacerQuestion(trois, 2, 1).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("type « texte libre » retire la clé ; décocher « obligatoire » ne l'ajoute pas", () => {
    const q = modifierQuestion([{ id: "a", type: "short" }], 0, { champ: "type", valeur: "" });
    expect(q[0]).toEqual({ id: "a" });
    expect(modifierQuestion(q, 0, { champ: "required", valeur: false })[0]).toEqual({ id: "a" });
    expect(
      modifierQuestion([{ id: "a", required: true }], 0, { champ: "required", valeur: false })[0],
    ).toEqual({ id: "a", required: false });
  });

  // 🔴 Relecture 2026-10-09 : « aucune question » doit pouvoir s'enregistrer.
  // Un champ vide n'écrit rien (l'action l'ignore) ; `[]` s'écrit, et se lit.
  it("liste vide → `[]`, qui s'enregistre et que le formulaire public lit", () => {
    expect(ecrireQuestions([])).toBe("[]");
    expect(lireQuestions("[]")).toEqual({ ok: true, questions: [] });
    expect(lireQuestions("")).toEqual({ ok: true, questions: [] });
    expect(parseScreeningQuestions(JSON.parse(ecrireQuestions([])))).toEqual([]);
  });

  it("refuse d'ouvrir ce qu'il ne comprendrait qu'en le perdant", () => {
    expect(lireQuestions("{").ok).toBe(false);
    expect(lireQuestions('{"id":"a"}').ok).toBe(false);
    expect(lireQuestions('[{"labelFr":"sans id"}]').ok).toBe(false);
    expect(lireQuestions("[1]").ok).toBe(false);
  });

  it("un type posé à la main et inconnu est signalé, et conservé", () => {
    const q: QuestionStockee = { id: "a", type: "choix" as never };
    expect(typeInconnu(q)).toBe("choix");
    expect(ecrireQuestions(modifierQuestion([q], 0, { champ: "labelFr", valeur: "x" }))).toBe(
      '[{"id":"a","type":"choix","labelFr":"x"}]',
    );
  });
});
