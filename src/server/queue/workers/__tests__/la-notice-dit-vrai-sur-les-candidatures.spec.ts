// @vitest-environment node

/**
 * Verrou — la notice publique et le worker de purge doivent dire la MÊME chose
 * des candidatures.
 *
 * ## Le défaut qu'il ferme
 *
 * Jusqu'au 2026-09-03, `src/content/legal.ts` ne mentionnait pas une seule fois
 * les candidatures. La section « Conservation des candidatures » a été écrite ;
 * elle annonçait alors une suppression automatique à 24 mois, que le worker
 * appliquait.
 *
 * Le 2026-10-07, Will a décidé qu'AUCUNE candidature n'est supprimée
 * automatiquement (« non je ne veux surtout pas d'effacement ») : le bloc du
 * worker est retiré, et la notice le dit. Ce fichier existe pour que les deux
 * ne se séparent plus : le dépôt a deux précédents documentés où le code a
 * changé et le texte publié est resté.
 *
 * ## Ce qu'il vérifie
 *
 * ✅ La notice (FR et EN) ne promet plus de suppression automatique ni de
 *    durée en mois pour une candidature.
 * ✅ La notice dit ce qui se passe vraiment : le dossier est conservé, n'est
 *    pas supprimé automatiquement, et son effacement se demande.
 * ✅ Le worker ne supprime aucune candidature — les deux moitiés sont COUPLÉES :
 *    rétablir une purge sans changer la notice rougit, et inversement.
 *
 * ❌ Il ne juge pas la rédaction. C'est une garde de forme, et elle le dit.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LEGAL_PAGES } from "@/content/legal";

const WORKER = join(process.cwd(), "src/server/queue/workers/retention-purge-worker.ts");

function section(locale: "fr" | "en", titre: RegExp): string {
  const page = LEGAL_PAGES.find((p) => p.slug === "politique-confidentialite");
  return page?.[locale].sections.find((s) => titre.test(s.title))?.body ?? "";
}

const FR = () => section("fr", /^Conservation des candidatures$/);
const EN = () => section("en", /^Retention of job applications$/);

/** Le worker, commentaires retirés : sa prose raconte la purge disparue. */
function codeDuWorker(): string {
  return readFileSync(WORKER, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ""))
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

/** Le worker supprime-t-il une candidature ? */
function workerSupprimeDesCandidatures(): boolean {
  return /\.jobApplication\s*\.\s*delete/.test(codeDuWorker());
}

describe("la notice dit vrai sur les candidatures", () => {
  it("la section existe en français ET en anglais — sinon la garde ne garde rien", () => {
    // Témoin de NON-VACUITÉ : une section renommée rendrait une chaîne vide, et
    // tous les « ne contient pas » ci-dessous passeraient au vert.
    expect(FR().length, "section FR « Conservation des candidatures » absente").toBeGreaterThan(
      100,
    );
    expect(EN().length, "section EN « Retention of job applications » absente").toBeGreaterThan(
      100,
    );
  });

  it("🔴 la notice ne promet plus de suppression automatique ni de durée en mois", () => {
    expect(FR()).not.toMatch(/suppression automatique/i);
    expect(FR()).not.toMatch(/Candidature non retenue\s*:\s*\d+\s*mois/);
    expect(EN()).not.toMatch(/automatic deletion/i);
    expect(EN()).not.toMatch(/\d+\s*months/);
  });

  it("🔴 la notice dit ce qui se passe : conservé, pas supprimé automatiquement, effacement sur demande", () => {
    expect(FR()).toMatch(/n'est pas supprimé automatiquement/);
    expect(FR()).toMatch(/demander son effacement/);
    expect(EN()).toMatch(/it is not deleted automatically/);
    expect(EN()).toMatch(/ask for it to be erased/);
  });

  it("🔴 les deux moitiés sont couplées : le worker ne supprime aucune candidature", () => {
    // 🔑 Une garde qui ne testerait que la notice laisserait passer un code qui
    // recommence à effacer ; une garde qui ne testerait que le code laisserait
    // passer une notice qui promet encore une suppression.
    const noticeAnnonceUneSuppression = /suppression automatique/i.test(FR());
    expect(
      workerSupprimeDesCandidatures(),
      "le worker supprime de nouveau des candidatures : c'est interdit par décision " +
        "du responsable de traitement (2026-10-07), et la notice dit le contraire.",
    ).toBe(false);
    expect(noticeAnnonceUneSuppression).toBe(workerSupprimeDesCandidatures());
  });

  it("le vivier reste décrit, avec son consentement", () => {
    // Témoin inverse : la réécriture de la conservation ne doit pas emporter le
    // paragraphe du vivier, qui repose sur un consentement distinct.
    expect(FR()).toMatch(/Conservation en vivier/);
    expect(FR()).toMatch(/la case est décochée par défaut/);
    expect(EN()).toMatch(/Talent-pool retention/);
  });
});
