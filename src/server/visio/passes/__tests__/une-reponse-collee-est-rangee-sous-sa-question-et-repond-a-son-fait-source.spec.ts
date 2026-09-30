/**
 * ⛔ UNE RÉPONSE COLLÉE EST RANGÉE SOUS SA QUESTION ET RÉPOND À SON FAIT
 * SOURCE (PR 7, `lire_reponses`).
 *
 *   1. La citation doit se lire MOT POUR MOT dans la réponse de CETTE
 *      question : une citation prise sous une autre question est rejetée —
 *      un fait n'est jamais rangé sous la mauvaise question.
 *   2. Un nombre ou une date n'est gardé que s'il se lit dans la citation :
 *      G4 lui-même (`verifierValeurs`), pas une copie qui divergerait
 *      (« douze personnes » se lit ; la date est recalculée depuis la
 *      citation, au jour de la réponse).
 *   3. À la VALIDATION du fait (jamais avant), la question ouverte d'origine
 *      passe « répondue » et pointe le fait qui y répond.
 *
 * Mutation qui rougit : chercher la citation dans TOUTES les réponses ; lire
 * les nombres par `/\d+/` au lieu de G4 (« douze » tombe) ; ou
 * passer la question source « répondue » dès l'écriture du fait proposé.
 * Contre-témoin : la bonne citation, sous la bonne question, est rangée.
 * Angle mort : une réponse collée sous la mauvaise question PAR WILL est rangée
 * sous celle-là — le code ne peut pas le deviner.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { validerFaitDeReponse } from "../../gestes-suivi";
import { verifierLecture, type QuestionAvecReponse } from "../lire-reponses";

const RECUE_LE = new Date("2026-10-01T09:00:00Z");

const questions: QuestionAvecReponse[] = [
  {
    id: "qq-1",
    ordre: 1,
    texte: "Combien de personnes ?",
    reponse: "Nous serons 14 personnes.",
    typeVise: "nb_participants",
    cleVisee: null,
  },
  {
    id: "qq-2",
    ordre: 2,
    texte: "Qui décide ?",
    reponse: "C'est la directrice commerciale qui signe.",
    typeVise: "decideur",
    cleVisee: null,
  },
];

describe("⛔ une réponse collée est rangée sous sa question", () => {
  it("une citation prise sous une autre question est rejetée", () => {
    const b = verifierLecture(
      {
        reponses: [
          {
            question_id: "Q1",
            reponse_citee: "la directrice commerciale qui signe",
            valeur_texte: null,
            valeur_nombre: null,
            valeur_date: null,
            confiance: "haute",
          },
        ],
        questions_sans_reponse: [],
      },
      questions,
      RECUE_LE,
    );
    expect(b.faits).toHaveLength(0);
    expect(b.rejetees).toBe(1);
  });

  it("contre-témoin : la bonne citation sous la bonne question, nombre prouvé", () => {
    const b = verifierLecture(
      {
        reponses: [
          {
            question_id: "Q1",
            reponse_citee: "Nous serons 14 personnes",
            valeur_texte: "14 personnes",
            valeur_nombre: 14,
            valeur_date: null,
            confiance: "haute",
          },
          {
            question_id: "Q2",
            reponse_citee: "la directrice commerciale qui signe",
            valeur_texte: "la directrice commerciale",
            valeur_nombre: 3,
            valeur_date: null,
            confiance: "haute",
          },
        ],
        questions_sans_reponse: [],
      },
      questions,
      RECUE_LE,
    );
    expect(b.faits.map((f) => [f.questionId, f.type])).toEqual([
      ["qq-1", "nb_participants"],
      ["qq-2", "decideur"],
    ]);
    expect(b.faits[0]?.quantite).toBe(14);
    // 3 ne se lit pas dans la citation : pas de valeur inventée.
    expect(b.faits[1]?.quantite).toBeNull();
  });
});

describe("⛔ les valeurs d'une réponse passent par G4 lui-même", () => {
  const q: QuestionAvecReponse[] = [
    {
      id: "qq-3",
      ordre: 1,
      texte: "Combien de personnes, et pour quand ?",
      reponse: "Nous serons douze personnes, avant le 15 décembre.",
      typeVise: "nb_participants",
      cleVisee: null,
    },
  ];
  const lire = (valeur_nombre: number | null, valeur_date: string | null) =>
    verifierLecture(
      {
        reponses: [
          {
            question_id: "Q1",
            reponse_citee: "Nous serons douze personnes, avant le 15 décembre",
            valeur_texte: null,
            valeur_nombre,
            valeur_date,
            confiance: "haute",
          },
        ],
        questions_sans_reponse: [],
      },
      q,
      RECUE_LE,
    ).faits[0];

  it("un nombre écrit en lettres se lit, comme dans G4", () => {
    expect(lire(12, null)?.quantite).toBe(12);
  });

  it("la date recalculée depuis la citation est gardée", () => {
    expect(lire(null, "2026-12-15")?.dateCible).toBe("2026-12-15");
  });

  it("une date qui ne coïncide pas avec la citation est écartée", () => {
    expect(lire(null, "2027-12-15")?.dateCible).toBeNull();
    expect(lire(null, "2026-12-16")?.dateCible).toBeNull();
  });

  it("la passe ne réécrit pas G4 à côté", () => {
    const src = readFileSync(
      join(process.cwd(), "src/server/visio/passes/lire-reponses.ts"),
      "utf8",
    );
    expect(src).toMatch(/from "\.\.\/verification\/g04-valeurs"/);
    expect(src).not.toMatch(/const MOIS\b|function sansAccents|\/\d\+\/g/);
  });
});

// ── 3. La question source passe « répondue » à la validation ────────────────

function fausseBase() {
  const faits = new Map<string, Record<string, unknown>>([
    ["source", { id: "source", statut: "valide", suivi: "ouvert", source: "transcription" }],
    [
      "reponse",
      {
        id: "reponse",
        statut: "propose",
        source: "questionnaire_cadrage",
        questionnaireQuestion: { faitSourceId: "source" },
      },
    ],
  ]);
  const evenements: Array<Record<string, unknown>> = [];
  const fait = {
    findUnique: async ({ where }: { where: { id: string } }) => faits.get(where.id) ?? null,
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const l = faits.get(where.id);
      if (l) Object.assign(l, data);
      return l;
    },
  };
  const faitEvenement = {
    create: async ({ data }: { data: Record<string, unknown> }) => evenements.push(data),
  };
  const db = {
    fait,
    faitEvenement,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ fait, faitEvenement }),
  };
  return { db, faits, evenements };
}

describe("⛔ … et répond à son fait source, à la validation seulement", () => {
  it("valider la réponse passe la question d'origine « répondue »", async () => {
    const { db, faits, evenements } = fausseBase();
    expect(faits.get("source")?.["suivi"]).toBe("ouvert");
    await validerFaitDeReponse(db as never, { faitId: "reponse", parAdminId: "admin-fictif" });
    expect(faits.get("reponse")?.["statut"]).toBe("valide");
    expect(faits.get("source")).toMatchObject({ suivi: "repondu", resoluParFaitId: "reponse" });
    expect(evenements.map((e) => e["action"])).toEqual(["valide", "suivi_change"]);
  });
});
