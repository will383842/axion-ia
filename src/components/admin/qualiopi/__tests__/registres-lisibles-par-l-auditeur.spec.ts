/**
 * Garde — les registres Qualiopi se lisent par un certificateur, pas par
 * l'équipe qui les a codés.
 *
 * Constats en production le 2026-10-01, la veille du premier audit :
 *
 *  1. Le registre des appréciations rattachait chaque ligne par des
 *     identifiants tronqués (« T: 068304cd… E: 7c1d1a4e… ») : impossible de
 *     remonter à la session ou au stagiaire.
 *  2. Quatre registres (partenariats, sous-traitants, incidents, revue de
 *     direction) s'ouvraient sur un formulaire de création vide, la liste
 *     enregistrée passant sous le pli — alors que Réclamations, Veille, Moyens
 *     et Appréciations étaient repliés « + Nouveau… » depuis le 2026-08-03.
 *  3. Les sous-titres parlaient le jargon interne : « off.27 », « doc A14 »,
 *     « OF », « Snapshot indicateurs », « Cache Redis 1 h », « M7 / M9 ».
 *
 * Cette garde lit les sources : un retour en arrière rougit ici.
 * Le Mode auditeur a ses propres gardes et n'est pas balayé.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, it, expect } from "vitest";

const RACINE = process.cwd();
const PAGES_QUALIOPI = join(
  RACINE,
  "src",
  "app",
  "[locale]",
  "(admin)",
  "[adminPrefix]",
  "qualiopi",
);
const COMPOSANTS = join(RACINE, "src", "components", "admin", "qualiopi");

function lire(chemin: string): string {
  return readFileSync(chemin, "utf8");
}

function pages(dossier: string): string[] {
  const trouvees: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      if (entree === "mode-auditeur") continue;
      trouvees.push(...pages(chemin));
    } else if (entree === "page.tsx") {
      trouvees.push(chemin);
    }
  }
  return trouvees;
}

/** Le sous-titre d'un écran (`description` d'`AdminPageHeader`). */
function description(source: string): string | null {
  return (
    /description="([^"]*)"/.exec(source)?.[1] ??
    /description=\{`([\s\S]*?)`\}/.exec(source)?.[1] ??
    null
  );
}

describe("registres Qualiopi lisibles par l'auditeur", () => {
  it("les formulaires de création des registres sont repliés par défaut", () => {
    const formulaires = [
      "PartenariatForm.tsx",
      "SousTraitantForm.tsx",
      "IncidentForm.tsx",
      "RevueDirectionForm.tsx",
      "ReclamationForm.tsx",
      "VeilleForm.tsx",
      "MoyenForm.tsx",
      "AppreciationForm.tsx",
    ];
    const fautes = formulaires.filter((f) => {
      const source = lire(join(COMPOSANTS, f));
      return !/<AdminBlocRepliable\s+titre="\+ /.test(source) || /ouvertParDefaut/.test(source);
    });
    expect(fautes).toEqual([]);
  });

  it("le registre des appréciations n'affiche plus d'identifiant technique tronqué", () => {
    const source = lire(join(PAGES_QUALIOPI, "appreciations", "page.tsx"));
    expect(source).not.toMatch(/\.slice\(0,\s*8\)/);
    expect(source).toMatch(/resoudreRattachementsAppreciations/);
    expect(source).toMatch(/Non rattachée/);
  });

  it("aucun sous-titre d'écran ne parle le jargon interne", () => {
    const toutes = pages(PAGES_QUALIOPI);
    // Témoin de non-vacuité : sans lui, un balayage cassé serait vert.
    expect(toutes.length).toBeGreaterThan(40);

    const jargon: [RegExp, string][] = [
      [/\boff\.\d/i, "« off.N » — écrire « indicateur N »"],
      [/\bdoc A\d+/, "référence de document interne"],
      [/\bOF\b/, "« OF » — écrire « l'organisme »"],
      [/Snapshot/i, "« Snapshot »"],
      [/Redis/i, "détail technique de cache"],
      [/\bM\d+\b/, "numéro de métrique interne"],
      [/\bNC majeure\b/, "« NC » — écrire « non-conformité »"],
    ];
    const fautes: string[] = [];
    for (const page of toutes) {
      const d = description(lire(page));
      if (d === null) continue;
      for (const [motif, raison] of jargon) {
        if (motif.test(d)) fautes.push(`${relative(RACINE, page)} : ${raison}`);
      }
    }
    expect(fautes).toEqual([]);
  });

  it("les mentions de cache des tableaux de bord sont écrites pour un lecteur", () => {
    for (const ecran of ["indicateurs", "pilotage"]) {
      expect(lire(join(PAGES_QUALIOPI, ecran, "page.tsx"))).not.toMatch(/Cache Redis/);
    }
    expect(lire(join(PAGES_QUALIOPI, "revue-direction", "page.tsx"))).not.toMatch(
      /Snapshot indicateurs<\/th>/,
    );
  });
});
