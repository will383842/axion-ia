// Les candidatures ne partent pas au CRM — garde statique (ADR 0047, révision).
//
// ── Pourquoi une garde, en plus du test de l'action ───────────────────────
// Décision de Will : aucune candidature ne franchit la frontière vers le CRM
// Pro ; le vivier est tenu par la console du site. L'action de candidature à
// une offre appelait `syncCandidateToCrm` ; l'appel est supprimé.
//
// Le test de l'action (`tests/unit/recrutement/la-candidature-a-une-offre-ne-
// part-pas-au-crm.spec.ts`) prouve qu'ELLE n'émet plus. Il ne dit rien des
// fichiers voisins : une relance, une saisie manuelle en console, un bouton
// « transmettre au CRM » rouvrirait le canal sans passer par elle. Cette garde
// ferme les DOSSIERS entiers — le formulaire public et la console des
// candidatures : aucun de leurs modules n'importe `@/server/crm-sync`, imports
// dynamiques compris.
//
// ── Ce qu'elle ne couvre pas, délibérément ────────────────────────────────
// Les fichiers de test : un test peut légitimement simuler le module pour
// prouver qu'il n'est PAS appelé. Et l'opposition au vivier
// (`src/server/vivier/opposition.ts`), qui DOIT continuer d'atteindre les
// fiches déjà parties — elle sert ici de témoin positif.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Le formulaire public de candidature et la console qui lit les candidatures. */
const DOSSIERS = ["src/features/job-application", "src/features/admin-job-applications"];

/**
 * Toute spécification de module qui désigne la synchro CRM : `from "…"`,
 * `import "…"`, `import("…")`, `require("…")`, en alias `@/` comme en relatif.
 * Même motif que la garde du tunnel apporteur.
 */
const IMPORT_CRM =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["'`][^"'`]*server\/crm-sync(?:\/[^"'`]*)?["'`]/;

function estUnTest(relatif: string): boolean {
  return (
    relatif.split(/[\\/]/).includes("__tests__") || /\.(spec|test)\.[cm]?[jt]sx?$/.test(relatif)
  );
}

function sources(dossier: string): string[] {
  const absolu = path.join(RACINE, dossier);
  const trouves: string[] = [];
  const parcourir = (courant: string) => {
    for (const nom of readdirSync(courant)) {
      const chemin = path.join(courant, nom);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (/\.[cm]?[jt]sx?$/.test(nom)) trouves.push(path.relative(RACINE, chemin));
    }
  };
  parcourir(absolu);
  return trouves.filter((f) => !estUnTest(f)).map((f) => f.split(path.sep).join("/"));
}

describe("les candidatures ne partent pas au CRM (ADR 0047, révision)", () => {
  it("la garde regarde bien quelque chose — sinon elle serait verte pour rien", () => {
    // Un renommage de dossier rendrait la liste vide, et la garde verte en
    // cessant de lire. On exige l'action qui portait l'envoi, et un fichier de
    // la console.
    const tous = DOSSIERS.flatMap(sources);
    expect(tous).toContain("src/features/job-application/actions.ts");
    expect(tous).toContain("src/features/admin-job-applications/actions.ts");
  });

  it("le motif reconnaît un import réel — témoin positif sur l'opposition au vivier", () => {
    // L'opposition au vivier importe la synchro, et doit continuer de le faire :
    // si le motif ne la reconnaissait pas, la garde ci-dessous ne prouverait rien.
    const opposition = readFileSync(path.join(RACINE, "src/server/vivier/opposition.ts"), "utf8");
    expect(IMPORT_CRM.test(opposition)).toBe(true);
    // Et les formes dynamiques, qu'une réouverture discrète emprunterait.
    expect(IMPORT_CRM.test(`const m = await import("@/server/crm-sync");`)).toBe(true);
    expect(IMPORT_CRM.test(`import { x } from "../../server/crm-sync/enqueue";`)).toBe(true);
    expect(IMPORT_CRM.test(`const m = require('@/server/crm-sync')`)).toBe(true);
  });

  it("aucun module des candidatures n'importe @/server/crm-sync", () => {
    const fautifs = DOSSIERS.flatMap(sources).filter((f) =>
      IMPORT_CRM.test(readFileSync(path.join(RACINE, f), "utf8")),
    );
    expect(
      fautifs,
      "ces fichiers rouvrent l'envoi des candidatures au CRM, coupé par décision de Will " +
        "(ADR 0047, révision) — le rouvrir exige sa validation explicite :",
    ).toEqual([]);
  });
});
