/**
 * La page « financement OPCO / France Travail » est retirée (décision du 18/11/2026) :
 * - la route n'existe plus et redirige en 301 vers /fr/formations ;
 * - aucun lien interne ne pointe vers elle ;
 * - la déduction de la Journée IA est écrite sur la Journée IA, jamais sur les formations.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DEDUCTION_JOURNEE_IA, remplacerJetons } from "@/content/journee-ia-commun";
import { CONTENU } from "@/app/[locale]/journee-ia/contenu";

const RACINE = join(__dirname, "..", "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");

describe("page financement retirée", () => {
  it("le dossier de la page n'existe plus", () => {
    expect(existsSync(join(RACINE, "src/app/[locale]/financement-opco-france-travail"))).toBe(
      false,
    );
  });

  it("une redirection permanente mène vers /fr/formations", () => {
    expect(lire("next.config.ts")).toMatch(
      /source: "\/:locale\(fr\|en\)\/financement-opco-france-travail",\s*destination: "\/fr\/formations",\s*permanent: true/,
    );
  });

  it.each([
    "src/components/nav/Footer.tsx",
    "src/components/formations/FormationDetailPage.tsx",
    "src/components/sections/FounderProfile.tsx",
    "src/i18n/routing.ts",
    "src/app/sitemap.ts",
    "src/lib/seo/page-images.ts",
  ])("%s ne lie plus la page", (f) => {
    expect(lire(f)).not.toContain('"/financement-opco-france-travail"');
  });
});

describe("aucun chemin vers la page dans le code ni dans les fichiers publics", () => {
  it("ni lien, ni llms.txt, ni flux, ni JSON-LD ne cite l'adresse entre guillemets", () => {
    let sortie = "";
    try {
      sortie = execFileSync(
        "git",
        [
          "grep",
          "-n",
          "-E",
          "[\"'`](/(fr|en))?/financement-opco-france-travail",
          "--",
          "src",
          "public",
        ],
        { cwd: RACINE, encoding: "utf8" },
      );
    } catch (e) {
      if ((e as { status?: number }).status !== 1) throw e;
      sortie = ""; // code 1 : aucune occurrence
    }
    expect(sortie.trim()).toBe("");
  });
});

describe("déduction de la Journée IA", () => {
  const phrase =
    "Si vous nous confiez ensuite la mise en place d’une automatisation ou d’une intégration dans les 60 jours, les 1 490 € HT de la Journée IA sont déduits de votre devis.";
  const norm = (t: string) => t.replace(/[\u202f\u00a0]/g, " ");

  it("la phrase est exacte une fois le prix résolu", () => {
    expect(norm(remplacerJetons(DEDUCTION_JOURNEE_IA))).toBe(phrase);
  });

  it("elle figure dans la page et dans la FAQ prix", () => {
    expect(norm(remplacerJetons(CONTENU.prix.deduction))).toBe(phrase);
    const faq = CONTENU.faq.find((q) => q.id === "faq-prix");
    expect(norm(remplacerJetons(faq!.reponse))).toContain(phrase);
  });

  it("elle n'apparaît dans aucun fichier des formations", () => {
    expect(lire("src/components/formations/FormationDetailPage.tsx")).not.toContain("déduits");
    expect(lire("src/content/formations/conditions-tarifaires.ts")).not.toContain("déduits");
  });
});
