import { describe, it, expect } from "vitest";
import { mapEnToFr } from "./en-to-fr-redirect";

// Audit GSC 5xx 2026-05-18 — lock du mapping EN→FR pour les routes parameterized
// où FR ≠ EN. Sans mapping explicite, le fallback `/en → /fr` envoie vers une
// URL FR inexistante (catchall soft 404). Ce test verrouille les mappings de
// toutes les URLs observées dans GSC + le full surface des slugs déclarés
// dans `src/i18n/routing.ts`.
describe("mapEnToFr", () => {
  describe("audit — sous-routes FR ≠ EN", () => {
    it("/en/audit/strategic-pme → /fr/audit/strategique-pme", () => {
      expect(mapEnToFr("/en/audit/strategic-pme")).toBe("/fr/audit/strategique-pme");
    });
    it("/en/audit/strategic-eti → /fr/audit/strategique-eti", () => {
      expect(mapEnToFr("/en/audit/strategic-eti")).toBe("/fr/audit/strategique-eti");
    });
    it("/en/audit/targeted → /fr/audit/cible", () => {
      expect(mapEnToFr("/en/audit/targeted")).toBe("/fr/audit/cible");
    });
    it("/en/audit/request → /fr/audit/demande", () => {
      expect(mapEnToFr("/en/audit/request")).toBe("/fr/audit/demande");
    });
    it("/en/audit/flash → /fr/audit/flash (slug identique, fallback)", () => {
      expect(mapEnToFr("/en/audit/flash")).toBe("/fr/audit/flash");
    });
  });

  describe("interventions — formations collectives (4 paliers)", () => {
    it("/en/interventions/team-trainings → /fr/interventions/collectives", () => {
      expect(mapEnToFr("/en/interventions/team-trainings")).toBe("/fr/interventions/collectives");
    });
    it("/en/interventions/team-trainings/4h → /fr/interventions/collectives/4h", () => {
      expect(mapEnToFr("/en/interventions/team-trainings/4h")).toBe(
        "/fr/interventions/collectives/4h",
      );
    });
    it("/en/interventions/team-trainings/1-day → /fr/interventions/collectives/1-jour", () => {
      expect(mapEnToFr("/en/interventions/team-trainings/1-day")).toBe(
        "/fr/interventions/collectives/1-jour",
      );
    });
    it("/en/interventions/team-trainings/2-days → /fr/interventions/collectives/2-jours", () => {
      expect(mapEnToFr("/en/interventions/team-trainings/2-days")).toBe(
        "/fr/interventions/collectives/2-jours",
      );
    });
    it("/en/interventions/team-trainings/3-days-plus → /fr/interventions/collectives/3-jours-plus", () => {
      expect(mapEnToFr("/en/interventions/team-trainings/3-days-plus")).toBe(
        "/fr/interventions/collectives/3-jours-plus",
      );
    });
  });

  describe("interventions — coaching individuel + autres slugs FR ≠ EN", () => {
    it("/en/interventions/discovery-coaching → /fr/interventions/coaching-decouverte", () => {
      expect(mapEnToFr("/en/interventions/discovery-coaching")).toBe(
        "/fr/interventions/coaching-decouverte",
      );
    });
    it("/en/interventions/advanced-coaching → /fr/interventions/coaching-avance", () => {
      expect(mapEnToFr("/en/interventions/advanced-coaching")).toBe(
        "/fr/interventions/coaching-avance",
      );
    });
    it("/en/interventions/individual → /fr/interventions/individuel", () => {
      expect(mapEnToFr("/en/interventions/individual")).toBe("/fr/interventions/individuel");
    });
    it("/en/interventions/essential → /fr/interventions/essentielle", () => {
      expect(mapEnToFr("/en/interventions/essential")).toBe("/fr/interventions/essentielle");
    });
    it("/en/interventions/deep-dive → /fr/interventions/approfondie", () => {
      expect(mapEnToFr("/en/interventions/deep-dive")).toBe("/fr/interventions/approfondie");
    });
    it("/en/interventions/executives → /fr/interventions/dirigeants", () => {
      expect(mapEnToFr("/en/interventions/executives")).toBe("/fr/interventions/dirigeants");
    });
    it("/en/interventions/executive-productivity → /fr/interventions/dirigeant-productivite", () => {
      expect(mapEnToFr("/en/interventions/executive-productivity")).toBe(
        "/fr/interventions/dirigeant-productivite",
      );
    });
    it("/en/interventions/executive-strategic-vision → /fr/interventions/dirigeant-vision-strategique", () => {
      expect(mapEnToFr("/en/interventions/executive-strategic-vision")).toBe(
        "/fr/interventions/dirigeant-vision-strategique",
      );
    });
    it("/en/interventions/claude-executive → /fr/interventions/claude-dirigeant", () => {
      expect(mapEnToFr("/en/interventions/claude-executive")).toBe(
        "/fr/interventions/claude-dirigeant",
      );
    });
    it("/en/interventions/claude-implementation-individual → /fr/interventions/claude-implementation-individuel", () => {
      expect(mapEnToFr("/en/interventions/claude-implementation-individual")).toBe(
        "/fr/interventions/claude-implementation-individuel",
      );
    });
    it("/en/interventions/save-time → /fr/interventions/gagner-du-temps", () => {
      expect(mapEnToFr("/en/interventions/save-time")).toBe("/fr/interventions/gagner-du-temps");
    });
    it("/en/interventions/ai-express-kickoff → /fr/interventions/demarrage-ia-express", () => {
      expect(mapEnToFr("/en/interventions/ai-express-kickoff")).toBe(
        "/fr/interventions/demarrage-ia-express",
      );
    });
    it("/en/interventions/targeted-ai-workshop → /fr/interventions/atelier-ia-cible", () => {
      expect(mapEnToFr("/en/interventions/targeted-ai-workshop")).toBe(
        "/fr/interventions/atelier-ia-cible",
      );
    });
    it("/en/interventions/request → /fr/interventions/demande", () => {
      expect(mapEnToFr("/en/interventions/request")).toBe("/fr/interventions/demande");
    });
  });

  describe("implementation — slugs FR ≠ EN", () => {
    it("/en/implementation/custom-ai → /fr/implementation/ia-custom", () => {
      expect(mapEnToFr("/en/implementation/custom-ai")).toBe("/fr/implementation/ia-custom");
    });
    it("/en/implementation/processes → /fr/implementation/processus", () => {
      expect(mapEnToFr("/en/implementation/processes")).toBe("/fr/implementation/processus");
    });
    it("/en/implementation/structuring → /fr/implementation/structuration", () => {
      expect(mapEnToFr("/en/implementation/structuring")).toBe("/fr/implementation/structuration");
    });
    it("/en/implementation/by-technology → /fr/implementation/par-techno", () => {
      expect(mapEnToFr("/en/implementation/by-technology")).toBe("/fr/implementation/par-techno");
    });
    it("/en/implementation/by-function/sales → /fr/implementation/par-fonction/sales", () => {
      expect(mapEnToFr("/en/implementation/by-function/sales")).toBe(
        "/fr/implementation/par-fonction/sales",
      );
    });
    it("/en/implementation/chatbot → /fr/implementation/chatbot (identique, fallback)", () => {
      expect(mapEnToFr("/en/implementation/chatbot")).toBe("/fr/implementation/chatbot");
    });
  });

  describe("case-studies — sous-route /industry/ vs /secteur/", () => {
    it("/en/case-studies → /fr/cas-concrets", () => {
      expect(mapEnToFr("/en/case-studies")).toBe("/fr/cas-concrets");
    });
    it("/en/case-studies/juridique → /fr/cas-concrets/juridique", () => {
      expect(mapEnToFr("/en/case-studies/juridique")).toBe("/fr/cas-concrets/juridique");
    });
    // GSC 5xx 2026-05-18 — bug observé : /en/case-studies/industry/juridique
    // matchait `/en/case-studies/` (prefix court) → /fr/cas-concrets/industry/juridique
    // qui n'existe pas (catchall soft 404). Mapping `/en/case-studies/industry/`
    // doit matcher AVANT `/en/case-studies/` (longest-first).
    it("/en/case-studies/industry/juridique → /fr/cas-concrets/secteur/juridique", () => {
      expect(mapEnToFr("/en/case-studies/industry/juridique")).toBe(
        "/fr/cas-concrets/secteur/juridique",
      );
    });
  });

  describe("help — sous-route /category/ vs /categorie/", () => {
    it("/en/help → /fr/centre-aide", () => {
      expect(mapEnToFr("/en/help")).toBe("/fr/centre-aide");
    });
    it("/en/help/perimetre-audit-ia → /fr/centre-aide/perimetre-audit-ia", () => {
      expect(mapEnToFr("/en/help/perimetre-audit-ia")).toBe("/fr/centre-aide/perimetre-audit-ia");
    });
    it("/en/help/category/audit → /fr/centre-aide/categorie/audit", () => {
      expect(mapEnToFr("/en/help/category/audit")).toBe("/fr/centre-aide/categorie/audit");
    });
  });

  describe("autres routes FR ≠ EN", () => {
    it("/en/about → /fr/a-propos", () => {
      expect(mapEnToFr("/en/about")).toBe("/fr/a-propos");
    });
    it("/en/travel-policy → /fr/politique-deplacement", () => {
      expect(mapEnToFr("/en/travel-policy")).toBe("/fr/politique-deplacement");
    });
    it("/en/locations/normandie → /fr/implantations/normandie", () => {
      expect(mapEnToFr("/en/locations/normandie")).toBe("/fr/implantations/normandie");
    });
    it("/en/gallery → /fr/galerie", () => {
      expect(mapEnToFr("/en/gallery")).toBe("/fr/galerie");
    });
  });

  describe("fallback — slugs identiques FR/EN (swap préfixe seulement)", () => {
    it("/en/blog → /fr/blog", () => {
      expect(mapEnToFr("/en/blog")).toBe("/fr/blog");
    });
    it("/en/blog/tag/methodologie → /fr/blog/tag/methodologie", () => {
      expect(mapEnToFr("/en/blog/tag/methodologie")).toBe("/fr/blog/tag/methodologie");
    });
    it("/en/contact → /fr/contact", () => {
      expect(mapEnToFr("/en/contact")).toBe("/fr/contact");
    });
    it("/en → /fr", () => {
      expect(mapEnToFr("/en")).toBe("/fr");
    });
  });
});
