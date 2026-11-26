import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Le choix « Journée IA » du formulaire de contact : premier, visible, sans décalage. */
const lire = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const form = lire("src", "components", "forms", "UnifiedContactForm.tsx");

describe("UnifiedContactForm — pastille « Journée IA »", () => {
  it("porte son libellé court FR/EN, son emoji et son accent terracotta", () => {
    expect(form).toContain('journee_ia: "Journée IA"');
    expect(form).toContain('journee_ia: "AI Day"');
    expect(form).toContain('journee_ia: "🗓️"');
    expect(form).toContain('journee_ia: "terracotta"');
  });

  it("rend les pastilles du groupe projet dans l'ordre du schéma (journee_ia en tête)", () => {
    expect(form).toContain("TYPE_GROUPS.projet.map((opt) => renderPill(opt, false))");
  });

  it("le badge « Nouveau » est dans le flux, statique et masqué aux lecteurs d'écran", () => {
    const i = form.indexOf('data-testid="badge-nouveau"');
    const bloc = form.slice(i - 120, i + 300);
    expect(bloc).toContain('aria-hidden="true"');
    expect(bloc).not.toMatch(/absolute|animate-|transition/);
  });

  it("n'annonce ni prix, ni déplacement, ni ville, ni garantie de gain", () => {
    const i = form.indexOf('journee_ia: "Votre entreprise');
    const ph = form.slice(i, i + 120);
    expect(ph).not.toMatch(/€|déplacement|Grenoble|garanti/i);
  });

  it("le deep-link ?type=journee_ia est reconnu (mécanisme ?type= existant)", () => {
    expect(form).toContain('sp.get("type")');
    expect(form).toContain("UNIFIED_CONTACT_TYPES.includes(urlType as UnifiedContactType)");
  });

  it("la page /journee-ia envoie « Déjà décidé » vers /contact?type=journee_ia", () => {
    const page = lire("src", "app", "[locale]", "journee-ia", "page.tsx");
    expect(page).toContain("/contact?depuis=${depuis}&type=journee_ia");
  });
});

describe("parité des listes en dur (console, fiche, devis)", () => {
  it.each([
    ["src/features/dossier-client/fiche-demande.ts"],
    ["src/features/admin-submissions/type-labels.ts"],
    ["src/app/[locale]/(admin)/[adminPrefix]/submissions/SubmissionFilters.tsx"],
    ["src/server/qualiopi/devis/assistant/sources.ts"],
  ])("%s connaît journee_ia", (chemin) => {
    expect(lire(...chemin.split("/"))).toContain("journee_ia");
  });
});
