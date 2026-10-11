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
 * automatiquement : le bloc du worker a été retiré, et la notice l'a dit.
 *
 * Le 2026-10-11, il a tranché de nouveau : « on garde les CV et données
 * 2 ans », puis effacement automatique. Le worker efface donc les candidatures
 * 24 mois après le dernier échange (jamais une personne recrutée), et la
 * notice l'annonce. Ce fichier existe pour que les deux ne se séparent plus :
 * le dépôt a deux précédents documentés où le code a changé et le texte publié
 * est resté.
 *
 * ## Ce qu'il vérifie
 *
 * ✅ La notice (FR et EN) annonce deux ans après le dernier échange, puis un
 *    effacement automatique ; l'effacement anticipé sur demande ; l'exception
 *    des personnes recrutées.
 * ✅ Le worker fait ce que la notice annonce — les deux moitiés sont COUPLÉES :
 *    retirer l'effacement ou changer sa durée sans changer la notice rougit.
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

  it("🔴 la notice annonce ce que le code fait : deux ans après le dernier échange, puis effacement automatique", () => {
    // Décision du responsable de traitement, 2026-10-11 — voir
    // `les-candidatures-s-effacent-a-2-ans.spec.ts`.
    expect(FR()).toMatch(
      /conservé deux ans après notre dernier échange, puis effacé automatiquement/,
    );
    expect(EN()).toMatch(/kept for two years after our last exchange, then deleted automatically/);
    // L'ancienne promesse inverse ne doit pas survivre à côté de la nouvelle.
    expect(FR()).not.toMatch(/n'est pas supprimé automatiquement/);
    expect(EN()).not.toMatch(/it is not deleted automatically/);
  });

  it("🔴 l'effacement anticipé sur demande et l'exception des personnes recrutées sont dits", () => {
    expect(FR()).toMatch(/demander son effacement plus tôt/);
    expect(FR()).toMatch(/dossier du personnel et n'est pas concerné par cet effacement/);
    expect(EN()).toMatch(/ask for it to be erased earlier/);
    expect(EN()).toMatch(/personnel file and is not covered by this deletion/);
  });

  it("🔴 les deux moitiés sont couplées : la durée annoncée est celle du worker", () => {
    // 🔑 Une garde qui ne testerait que la notice laisserait passer un code qui
    // n'efface rien, ou qui efface à une autre échéance ; une garde qui ne
    // testerait que le code laisserait passer une notice qui annonce autre chose.
    expect(
      workerSupprimeDesCandidatures(),
      "la notice annonce un effacement automatique que le worker ne fait pas.",
    ).toBe(true);
    expect(codeDuWorker(), "la notice dit « deux ans » : le worker doit dire 24 mois").toMatch(
      /CANDIDATURES_MOIS = 24;/,
    );
    // Le point de départ est le dernier échange, pas le seul dépôt.
    expect(codeDuWorker()).toMatch(/lastActivityAt/);
    // 🛑 Et les personnes recrutées sont épargnées, comme la notice le dit.
    expect(codeDuWorker()).toMatch(/notIn:\s*\[\s*"hired"/);
  });

  it("le vivier reste décrit, avec son consentement", () => {
    // Témoin inverse : la réécriture de la conservation ne doit pas emporter le
    // paragraphe du vivier, qui repose sur un consentement distinct.
    expect(FR()).toMatch(/Conservation en vivier/);
    expect(FR()).toMatch(/la case est décochée par défaut/);
    expect(EN()).toMatch(/Talent-pool retention/);
  });
});
