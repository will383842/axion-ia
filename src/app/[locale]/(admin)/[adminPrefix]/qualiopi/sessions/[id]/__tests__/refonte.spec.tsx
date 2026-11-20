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

  it("informations générales en liste de définitions", () => {
    expect(SRC).toContain("<dl ");
  });

  it("état vide du verrou et explications repliées en composants partagés", () => {
    expect(SRC).toMatch(
      /<AdminEmptyState\s+variant="inline"\s+icon=\{<Lock [^>]*\/>\}\s+title="Dossier jamais rouvert\."/,
    );
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

  describe("niveau visuel v2", () => {
    it("quatre tuiles de chiffres clés, calculées sur les données déjà chargées", () => {
      expect(SRC).toContain('data-testid="tuiles-session"');
      for (const l of [
        "Stagiaires inscrits",
        "Étapes faites",
        "Montant HT",
        "Conflits formateur",
      ]) {
        expect(SRC).toContain(`label="${l}"`);
      }
      expect((SRC.match(/<AdminStatCard\b/g) ?? []).length).toBe(4);
      expect(SRC).toMatch(/tone=\{\s*trainingSession\._count\.enrollments === 0/);
      expect(SRC).toContain('conflitsFormateur.conflits.length === 0 ? "success" : "destructive"');
    });

    it("historique du verrou en cartes à pastille large avec icône, bordure gauche colorée", () => {
      expect(SRC).not.toContain("<table");
      expect(SRC).toMatch(
        /<AdminBadge tone=\{reouv \? "warning" : "success"\} plein compact=\{false\}>/,
      );
      expect(SRC).toContain('<LockOpen size={16} aria-hidden="true" />');
      expect(SRC).toContain("border-l-[color:var(--color-admin-warning)]");
      expect(SRC).toContain("border-l-[color:var(--color-admin-success)]");
    });

    it("motif dans un encadré teinté, préfixe en gras, plus d'italique grise", () => {
      expect(SRC).toContain("<strong>Motif :</strong>");
      expect(SRC).toContain("bg-[color:var(--color-admin-warning-soft)]");
    });

    it("jetons admin seulement : aucune couleur Tailwind par défaut dans les ajouts", () => {
      expect(SRC).not.toMatch(
        /\b(?:bg|text|border)-(?:red|green|amber|yellow|blue|gray|slate)-\d{2,3}\b/,
      );
    });

    it("icônes lucide importées par nom, aucune iframe", () => {
      expect(SRC).toMatch(/import \{[^}]*Users[^}]*\} from "lucide-react"/);
      expect(SRC).not.toContain("<iframe");
    });
  });
});
