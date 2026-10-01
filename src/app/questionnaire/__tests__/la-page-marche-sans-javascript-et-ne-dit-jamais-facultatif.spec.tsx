/**
 * LA PAGE MARCHE SANS JAVASCRIPT, ET NE DIT JAMAIS « FACULTATIF »
 * (questionnaire en ligne, 2026-10-01 ; UX §1.9 et principe « peu contraignant »).
 *
 *   · le formulaire d'un seul tenant (dans `<noscript>`) poste les MÊMES champs
 *     que la version pas à pas : `questionnaireId`, `jeton`, `reponse_<id>` pour
 *     chaque question, `repondant` borné à 80 caractères ;
 *   · l'en-tête dit le nombre de questions et la durée ;
 *   · aucun texte client ne dit « facultatif » ni « obligatoire », aucun
 *     numéro de téléphone, aucune date butoir.
 *
 * Mutation qui rougit : renommer un champ d'un seul des deux formulaires ;
 * remettre « (facultatif) » dans un libellé.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../[id]/[jeton]/actions", () => ({ envoyerReponsesAction: vi.fn() }));

import { QuestionnaireComplet } from "../[id]/[jeton]/QuestionnaireComplet";
import { TEXTES, MESSAGES_ERREUR } from "../[id]/[jeton]/textes";

const QUESTIONS = [
  { id: "11111111-1111-4111-8111-111111111111", titre: "Combien ?", aide: null, puces: [] },
  {
    id: "22222222-2222-4222-8222-222222222222",
    titre: "Quand ?",
    aide: "Une date.",
    puces: ["Mars", "Avril"],
  },
];

describe("la page marche sans JavaScript", () => {
  const html = renderToStaticMarkup(
    <QuestionnaireComplet
      questionnaireId="6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b"
      jeton="j"
      questions={QUESTIONS}
      erreur={null}
    />,
  );

  it("le formulaire sans JavaScript porte tous les champs de l'envoi", () => {
    expect(html).toContain('name="questionnaireId"');
    expect(html).toContain('name="jeton"');
    for (const q of QUESTIONS) expect(html).toContain(`name="reponse_${q.id}"`);
    expect(html).toMatch(/name="repondant"[^>]*maxLength="80"|maxLength="80"[^>]*name="repondant"/);
  });

  it("l'en-tête dit le nombre de questions et la durée", () => {
    expect(html).toContain("2 questions, 1 minute");
  });

  it("la version pas à pas est masquée sans JavaScript (et seulement sans)", () => {
    expect(html).toContain("<noscript><style>.questionnaire-js{display:none}</style></noscript>");
    expect(html).toContain('class="questionnaire-js"');
  });
});

describe("aucun texte client ne dit « facultatif »", () => {
  const textes = [
    ...Object.values(TEXTES).flatMap((v) => (typeof v === "function" ? [String(v(3, 6))] : [v])),
    ...Object.values(MESSAGES_ERREUR),
  ].join(" \n ");

  it("ni « facultatif », ni « obligatoire », ni numéro de téléphone", () => {
    expect(textes.length).toBeGreaterThan(500); // témoin : on a bien lu les textes
    expect(textes).not.toMatch(/facultati|obligatoire/i);
    expect(textes).not.toMatch(/\+?\d[\d .-]{8,}\d/);
  });

  it("les composants de la page n'écrivent pas « facultatif » en dur", () => {
    const dossier = join(process.cwd(), "src/app/questionnaire/[id]/[jeton]");
    for (const f of readdirSync(dossier).filter((n) => n.endsWith(".tsx"))) {
      const source = readFileSync(join(dossier, f), "utf8")
        .split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
        .join("\n");
      expect(source, f).not.toMatch(/facultati/i);
    }
  });
});
