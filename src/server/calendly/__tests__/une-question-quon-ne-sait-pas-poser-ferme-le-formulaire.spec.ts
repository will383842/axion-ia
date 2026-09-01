// @vitest-environment node

/**
 * Verrou — le formulaire ne pose jamais une PARTIE des questions.
 *
 * ## Le défaut que ce fichier interdit
 *
 * Notre formulaire remplace celui de Calendly. Il doit donc poser exactement les
 * mêmes questions — or ces questions vivent chez Calendly, où Will peut en
 * ajouter une en trois clics, sans nous prévenir et sans que rien ne casse.
 *
 * Le réflexe naturel serait de rendre ce qu'on comprend et d'ignorer le reste.
 * Il produit la panne la plus coûteuse du lot : un formulaire qui a l'air
 * complet, une réservation qui aboutit, et une réponse obligatoire vide que
 * personne ne réclame jamais. Will croirait poser la question à tout le monde ;
 * elle ne serait posée qu'aux visiteurs venus par la page Calendly.
 *
 * D'où la règle, verrouillée ici : **une seule question non rendable rend le
 * formulaire entier indisponible**, et le visiteur repart chez Calendly, qui
 * saura la poser. Un formulaire absent se remarque ; un formulaire amputé, non.
 *
 * ## La distinction qui fait tout le fichier
 *
 * « Désactivée » et « non rendable » se ressemblent et n'ont pas la même
 * réponse. Une question désactivée est une décision de Will — Calendly jetterait
 * la réponse, on l'écarte sans rien fermer. Une question d'un type inconnu est
 * une lacune de notre code — on ferme. Les confondre casserait le formulaire à
 * chaque question archivée, ou le laisserait amputé à chaque type nouveau.
 */

import { describe, expect, it } from "vitest";

import { lireLesQuestions, champDeLaPosition, TYPES_RENDUS } from "../questions";

/** Une question telle que l'API la renvoie. */
function q(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Quel est votre besoin ?",
    type: "text",
    position: 0,
    enabled: true,
    required: true,
    answer_choices: [],
    include_other: false,
    ...over,
  };
}

describe("ce qui est rendable est rendu", () => {
  it("🔑 CONTRE-TÉMOIN : un jeu normal passe, sinon tout le reste ment", () => {
    // Sans lui, un `lireLesQuestions` qui refuserait TOUT ferait passer chaque
    // test « refuse » de ce fichier pour la bonne raison apparente.
    const r = lireLesQuestions([
      q({ name: "Votre besoin ?", type: "text", position: 0 }),
      q({ name: "Votre société ?", type: "string", position: 1, required: false }),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0]?.libelle).toBe("Votre besoin ?");
    expect(r.questions[1]?.requise).toBe(false);
  });

  it("les quatre types annoncés sont réellement acceptés", () => {
    // Le tableau `TYPES_RENDUS` est une promesse faite au reste du code. Ce test
    // vérifie qu'elle est tenue par la fonction, et pas seulement écrite.
    for (const type of TYPES_RENDUS) {
      const choix = type === "single_select" ? { answer_choices: ["Oui", "Non"] } : {};
      const r = lireLesQuestions([q({ type, ...choix })]);
      expect(r.ok, `le type « ${type} » est annoncé rendable mais refusé`).toBe(true);
    }
  });

  it("l'ordre suit la position, pas l'ordre d'arrivée", () => {
    // C'est l'ordre que le visiteur voit chez Calendly. Un ordre différent chez
    // nous se remarquerait, et brouillerait une question qui en éclaire une autre.
    const r = lireLesQuestions([q({ name: "C", position: 2 }), q({ name: "A", position: 0 })]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.questions.map((x) => x.libelle)).toEqual(["A", "C"]);
  });

  it("🔑 le nom du champ vient de la POSITION, jamais du libellé", () => {
    // Un `name` d'input dérivé du texte changerait à chaque reformulation. La
    // position est déjà ce que l'API utilise pour apparier les réponses.
    const r = lireLesQuestions([q({ name: "Un libellé qui changera demain", position: 3 })]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.questions[0]?.champ).toBe(champDeLaPosition(3));
    expect(r.questions[0]?.champ).not.toContain("libell");
  });

  it("aucune question du tout n'est un état normal, pas une panne", () => {
    for (const vide of [[], null, undefined]) {
      const r = lireLesQuestions(vide);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.questions).toHaveLength(0);
    }
  });
});

describe("🔴 ce qu'on ne sait pas poser ferme le formulaire", () => {
  it("un type inconnu rend la lecture INCOMPLÈTE", () => {
    const r = lireLesQuestions([
      q(),
      q({ name: "Vos outils ?", type: "multi_select", position: 1 }),
    ]);
    expect(r.ok, "une question non rendable doit fermer le formulaire").toBe(false);
    if (r.ok) return;
    expect(r.typesInconnus).toContain("multi_select");
  });

  it("🔑 elle ne rend PAS les autres questions quand même", () => {
    // Le cœur du sujet. Un résultat qui porterait les questions lisibles ET un
    // avertissement laisserait l'appelant libre d'afficher le formulaire amputé.
    // Le type ne le permet pas : sur `ok: false`, il n'y a pas de `questions`.
    const r = lireLesQuestions([q(), q({ type: "inconnu_de_demain", position: 1 })]);
    expect(r.ok).toBe(false);
    expect(Object.keys(r)).not.toContain("questions");
  });

  it("une position illisible ferme aussi", () => {
    // La position n'est pas décorative : c'est elle que l'API attend dans
    // `questions_and_answers`. Sans elle, la réponse est inappariable.
    for (const position of [undefined, "0", -1, 1.5, null]) {
      const r = lireLesQuestions([q({ position })]);
      expect(r.ok, `position « ${String(position)} » aurait dû fermer le formulaire`).toBe(false);
    }
  });

  it("un menu déroulant sans choix ferme", () => {
    // Le visiteur verrait une liste vide sans pouvoir répondre — à une question
    // peut-être obligatoire.
    const r = lireLesQuestions([q({ type: "single_select", answer_choices: [] })]);
    expect(r.ok).toBe(false);
  });
});

describe("🔑 une question DÉSACTIVÉE n'est pas une question inconnue", () => {
  it("elle est écartée sans fermer le formulaire", () => {
    // La confusion inverse casserait le formulaire à chaque question archivée
    // par Will — c'est-à-dire souvent, et sans qu'il fasse le lien.
    const r = lireLesQuestions([q(), q({ name: "Ancienne", position: 1, enabled: false })]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0]?.libelle).toBe("Quel est votre besoin ?");
  });

  it("🔑 une question désactivée d'un type INCONNU ne ferme pas non plus", () => {
    // L'ordre des deux contrôles compte, et il n'est pas évident : si le type
    // était examiné avant l'activation, une vieille question archivée d'un type
    // exotique fermerait le formulaire pour toujours, sans raison.
    const r = lireLesQuestions([q(), q({ type: "multi_select", position: 1, enabled: false })]);
    expect(r.ok, "l'activation doit être examinée AVANT le type").toBe(true);
  });
});
