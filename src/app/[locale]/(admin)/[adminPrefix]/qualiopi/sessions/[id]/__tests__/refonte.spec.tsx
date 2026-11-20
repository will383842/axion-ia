// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

// La page est un composant serveur lié à Prisma : on garde sa STRUCTURE par lecture du source
// (même procédé que le test de `qualiopi/emails`), les composants ui ayant leurs propres tests.
const CHEMIN = "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]/page.tsx";
const SRC = readFileSync(CHEMIN, "utf8");

describe("fiche d'une session : refonte visuelle", () => {
  it("pose la peau dossier sur la racine de la page", () => {
    expect(SRC).toContain('<div className="admin-ton-dossier">');
  });

  it("chaque bloc de la fiche est un AdminBloc dans sa section ancrée, plus de titre maison", () => {
    for (const id of [
      "infos",
      "checklist",
      "cycle-de-vie",
      "dates",
      "lieu",
      "formateur",
      "inter-entreprises",
      "sous-pages",
      "stagiaires",
      "documents",
      "questionnaires",
      "cloture",
    ]) {
      expect(SRC).toMatch(
        new RegExp(
          `<section id="${id}" className=\\{\`\\$\\{CLASSE_ANCRE_SECTION\\}\`\\}>\\s*<AdminBloc\\b`,
        ),
      );
    }
    expect(SRC).not.toContain("sectionHeadCls");
    expect((SRC.match(/<AdminBloc\b/g) ?? []).length).toBe(
      (SRC.match(/<\/AdminBloc>/g) ?? []).length,
    );
  });

  it("informations générales en liste de définitions ; historique du verrou en tableau", () => {
    expect(SRC).toContain("<dl ");
    expect(SRC).toContain(
      '<th\n                        key={c}\n                        scope="col"',
    );
    expect(SRC).toContain("overflow-x-auto");
  });

  it("état vide du verrou et explications repliées en composants partagés", () => {
    expect(SRC).toContain('<AdminEmptyState variant="inline" title="Dossier jamais rouvert." />');
    expect(SRC).toMatch(/<AdminBlocRepliable\s+titre="À quoi sert le dossier d'audit"/);
  });

  it("actions et composants métier inchangés", () => {
    for (const a of [
      "enrollAction={enrollTraineeAction}",
      "genererAction={genererSortiesAction}",
      "signerAction={contresignerLettreMissionAction}",
      "envoyerAction={envoyerQuestionnaireAction}",
      "<SessionLifecycleButtons",
      "<DocumentsSection",
      "<QuestionnairesSection",
      "<AncresHubSession",
      "<OngletsPhase",
    ]) {
      expect(SRC).toContain(a);
    }
  });

  it("garde de vocabulaire : titres de blocs ajoutés sans mot réservé", () => {
    const INTERDIT = /qualiopi|opco|financement|prise en charge|certification|cpf/i;
    const titres = [...SRC.matchAll(/(?:titre|title)=(?:\{?"([^"]*)"|\{`([^`]*)`)/g)].map(
      (m) => m[1] ?? m[2] ?? "",
    );
    expect(titres.length).toBeGreaterThan(10);
    expect(titres.filter((t) => INTERDIT.test(t))).toEqual([]);
  });
});
