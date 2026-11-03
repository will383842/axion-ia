import { describe, expect, it } from "vitest";

import type { ReponseLisible } from "../../questionnaire-preaudit/donnees";
import { lireLaCharge } from "../../questionnaire-preaudit/lecture";
import { HTML_SYNTHETIQUE } from "../../questionnaire-preaudit/__tests__/squelette.fixture";
import { collecterReponses, type QuestionnaireACollecter } from "../collecte";

const CODE_DIRIGEANT = "CODEDIRIGEANT-0123456789";
const CODE_COLLAB = "collab-abcdefghijklmnopqrstuvwxyz1234";

function reponse(
  mode: "main" | "emp" | "it",
  charge: Record<string, unknown>,
  opt: {
    membre?: string | null;
    jour?: number;
    ecarteLe?: Date | null;
    illisible?: boolean;
  } = {},
): ReponseLisible {
  const json = JSON.stringify({
    schema: 4,
    mode,
    consentements: { traitement: true },
    ...charge,
  });
  const membre = opt.membre === undefined ? null : opt.membre;
  const illisible = opt.illisible === true;
  const ecarteLe = opt.ecarteLe ?? null;
  return {
    id: `r-${mode}-${opt.jour ?? 1}-${membre ?? "x"}`,
    mode,
    membre,
    recuLe: new Date(Date.UTC(2026, 9, opt.jour ?? 1)),
    lignes: [],
    illisible,
    ecarteLe,
    infosEmail: null,
    lecture:
      illisible || ecarteLe !== null ? null : lireLaCharge(json, (m) => m === CODE_DIRIGEANT),
  };
}

function questionnaire(
  reponses: ReponseLisible[],
  html: string | null = HTML_SYNTHETIQUE,
): QuestionnaireACollecter {
  return {
    id: "q1",
    ref: "refpreaudit1",
    envoyeLe: new Date(Date.UTC(2026, 9, 1)),
    closLe: null,
    html,
    reponses,
  };
}

describe("collecterReponses — annexe intégrale et couverture", () => {
  it("garde chaque réponse mot pour mot, avec la question en français", () => {
    const c = collecterReponses([
      questionnaire([
        reponse("main", { donnees: { a_nom: "Alice Martin", a_plus: "oui, souvent" } }),
      ]),
    ]);
    const p = c.personnes[0]!;
    expect(p.statut).toBe("recue");
    expect(p.champs.map((x) => [x.cle, x.question, x.reponse])).toEqual([
      ["a_nom", "Nom", "Alice Martin"],
      ["a_plus", "Niveau 2 simple", "oui, souvent"],
    ]);
  });

  it("liste ce qui n'a PAS été répondu, avec le caractère essentiel", () => {
    const c = collecterReponses([
      questionnaire([reponse("main", { donnees: { a_nom: "Alice" } })]),
    ]);
    const p = c.personnes[0]!;
    const vides = new Map(p.nonRepondus.map((x) => [x.cle, x.essentielle]));
    expect(vides.has("a_nom")).toBe(false);
    expect(vides.get("a_plus")).toBe(false);
    expect(p.taux).not.toBeNull();
    expect(c.totaux.questionsSansReponse).toBe(p.nonRepondus.length);
    expect(p.nonRepondus.length).toBeGreaterThan(0);
  });

  it("une case pré-remplie jamais touchée n'est pas une réponse de la personne", () => {
    const c = collecterReponses([
      questionnaire([
        reponse("main", {
          donnees: { a_nom: "Pré-rempli par Axion", a_plus: "Vraie réponse" },
          prefill: { confirmes: [], modifies: [], non_verifies: ["a_nom"], vides: [] },
        }),
      ]),
    ]);
    const p = c.personnes[0]!;
    // Elle reste dans l'annexe (rien n'est perdu), marquée « non vérifié »…
    expect(p.champs.find((x) => x.cle === "a_nom")?.prefill).toBe("non_verifie");
    // …mais compte comme non répondue.
    expect(p.nonRepondus.some((x) => x.cle === "a_nom")).toBe(true);
    expect(p.prefill.non_verifie).toBe(1);
  });

  it("prend la dernière version non écartée et compte les renvois", () => {
    const c = collecterReponses([
      questionnaire([
        reponse("main", { donnees: { a_nom: "Ancienne" } }, { jour: 1 }),
        reponse("main", { donnees: { a_nom: "Corrigée" } }, { jour: 3 }),
      ]),
    ]);
    expect(c.personnes).toHaveLength(1);
    expect(c.personnes[0]!.nbVersions).toBe(2);
    expect(c.personnes[0]!.champs[0]!.reponse).toBe("Corrigée");
  });

  it("ne montre jamais un code complet : « …abcd » pour un collaborateur", () => {
    const c = collecterReponses([
      questionnaire([
        reponse("emp", { donnees: { b_1: "Tâche" }, service: "Atelier" }, { membre: CODE_COLLAB }),
      ]),
    ]);
    const p = c.personnes[0]!;
    expect(p.cle).toBe("emp:…1234");
    expect(p.service).toBe("Atelier");
    expect(JSON.stringify(c)).not.toContain(CODE_COLLAB);
  });

  it("distingue le dirigeant authentifié du dirigeant sans code (à vérifier)", () => {
    const authentifie = collecterReponses([
      questionnaire([reponse("main", { membre: CODE_DIRIGEANT, donnees: { a_nom: "A" } })]),
    ]);
    expect(authentifie.personnes[0]!.aVerifier).toBe(false);
    expect(JSON.stringify(authentifie)).not.toContain(CODE_DIRIGEANT);

    const sansCode = collecterReponses([
      questionnaire([reponse("main", { donnees: { a_nom: "A" } })]),
    ]);
    expect(sansCode.personnes[0]!.aVerifier).toBe(true);
    expect(sansCode.alertes.some((a) => a.niveau === "attention")).toBe(true);
  });

  it("une réponse illisible déclenche une alerte rouge, jamais du vide silencieux", () => {
    const c = collecterReponses([questionnaire([reponse("main", {}, { illisible: true })])]);
    expect(c.personnes[0]!.statut).toBe("illisible");
    expect(c.alertes.some((a) => a.niveau === "rouge")).toBe(true);
    expect(c.totaux.personnesAvecReponse).toBe(0);
  });

  it("une réponse écartée n'est jamais lue", () => {
    const c = collecterReponses([
      questionnaire([
        reponse("emp", {}, { membre: CODE_COLLAB, ecarteLe: new Date(Date.UTC(2026, 9, 5)) }),
      ]),
    ]);
    const p = c.personnes[0]!;
    expect(p.statut).toBe("ecartee");
    expect(p.champs).toEqual([]);
    expect(c.totaux.personnesAvecReponse).toBe(0);
  });

  it("sans le HTML du questionnaire : annexe complète, libellés de repli, alerte", () => {
    const c = collecterReponses([
      questionnaire([reponse("main", { donnees: { ent_nom: "Société X", zzz: "libre" } })], null),
    ]);
    const p = c.personnes[0]!;
    expect(p.champs).toHaveLength(2);
    expect(p.champs.find((x) => x.cle === "ent_nom")?.rubrique).toBe("Entreprise");
    expect(p.nonRepondus).toEqual([]);
    expect(p.taux).toBeNull();
    expect(c.alertes.some((a) => a.niveau === "attention")).toBe(true);
    expect(c.questionnaires[0]!.squeletteLu).toBe(false);
  });

  it("suit le questionnaire envoyé à CE client : autre formulaire, autres questions, plus court", () => {
    const HTML_COURT = String.raw`<script>
const LVL1 = new Set(["k_activite", "k_douleur"]);
const SECTIONS = [
  { id: "k", title: "Votre cabinet", only: "main", fields: [
    F("text", "k_activite", "Quelle est votre activité ?"),
    F("text", "k_douleur", "Qu'est-ce qui vous fait perdre du temps ?"),
    F("text", "k_budget", "Quel budget envisagez-vous ?"),
  ]},
];
</script>`;
    const c = collecterReponses([
      questionnaire(
        [
          reponse("main", {
            donnees: { k_activite: "Cabinet de kinésithérapie", k_douleur: "La facturation" },
          }),
        ],
        HTML_COURT,
      ),
    ]);
    const p = c.personnes[0]!;
    expect(p.champs.map((x) => [x.question, x.reponse])).toEqual([
      ["Quelle est votre activité ?", "Cabinet de kinésithérapie"],
      ["Qu'est-ce qui vous fait perdre du temps ?", "La facturation"],
    ]);
    // La question non remplie de CE formulaire est signalée, pas celles de l'ancien.
    expect(p.nonRepondus.map((x) => x.cle)).toEqual(["k_budget"]);
  });

  it("un formulaire que le lecteur ne sait pas analyser : toutes les réponses restent, la couverture est annoncée estimée", () => {
    const c = collecterReponses([
      questionnaire(
        [reponse("main", { donnees: { champ_libre_1: "oui", champ_libre_2: "non" } })],
        "<html><body>formulaire totalement différent, sans F() ni SECTIONS</body></html>",
      ),
    ]);
    expect(c.personnes[0]!.champs).toHaveLength(2);
    expect(c.personnes[0]!.taux).toBeNull();
    expect(c.alertes.some((a) => a.niveau === "attention")).toBe(true);
  });

  it("est générique : un autre secteur, d'autres champs, même résultat", () => {
    const c = collecterReponses([
      questionnaire(
        [
          reponse("main", {
            donnees: { cabinet_specialite: "Kinésithérapie", ent_effectif: "2 à 5" },
          }),
        ],
        null,
      ),
    ]);
    expect(c.personnes[0]!.champs.map((x) => x.reponse)).toEqual(["Kinésithérapie", "2 à 5"]);
  });
});
