/**
 * ⛔ AUCUN OUTIL MCP NE LIT LE DOSSIER CLIENT (chantier visio, PR 2 ;
 * plan PA-12, ADR 0053).
 *
 * L'adaptateur MCP (`src/server/mcp/**`, ADR 0046) répond à des assistants
 * extérieurs. Les comptes rendus, les transcriptions, les faits et les
 * preuves d'accord n'y ont pas leur place : ce que Will seul (et les
 * administrateurs, A2) peut lire ne doit pas pouvoir sortir par une réponse
 * d'outil.
 *
 * La liste des modèles interdits est DÉRIVÉE du schéma (annotation
 * `rgpd: dossier-client`), jamais recopiée : une table du dossier ajoutée
 * demain est couverte sans qu'on y pense. S'y ajoutent les tables techniques
 * qui touchent à la parole (transcriptions, enregistrements).
 *
 * Contre-témoin : un fichier fictif qui lit `prisma.fait.findMany`, ou qui
 * importe `@/server/visio/...`, est reconnu.
 * Angle mort avoué : une lecture passée par un module intermédiaire hors du
 * circuit (qui lirait le dossier puis serait importé par l'adaptateur) n'est
 * vue que si ce module lit un modèle par son accesseur.
 */

import { describe, expect, it } from "vitest";
import { lire, lireModeles, sansCommentaires, sourcesSous } from "./sources-du-circuit-visio";

const DOSSIER_MCP = ["src/server/mcp"] as const;

/** Tables techniques du chantier qui restent interdites à l'adaptateur. */
const TECHNIQUES_INTERDITS = [
  "Transcription",
  "Enregistrement",
  "EnregistrementTranche",
  "EnregistrementMorceau",
  "CompteRenduSource",
  "TraitementVisio",
  "AppareilEnregistrement",
] as const;

const IMPORT_DU_CIRCUIT =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["'`][^"'`]*(?:server\/visio|features\/dossier-client|lib\/rgpd-dossier-client|lib\/chiffrer-parole)(?:\/[^"'`]*)?["'`]/;

function interdits(): string[] {
  const dossier = lireModeles()
    .filter((m) => m.annotation === "dossier-client")
    .map((m) => m.accesseur);
  const techniques = TECHNIQUES_INTERDITS.map((n) => n.charAt(0).toLowerCase() + n.slice(1));
  return [...new Set([...dossier, ...techniques])];
}

function fautes(fichiers: ReadonlyArray<{ chemin: string; code: string }>): string[] {
  const accesseurs = interdits();
  const lecture = new RegExp(
    `\\.(${accesseurs.join("|")})\\.(find|count|aggregate|groupBy)\\w*\\b`,
  );
  return fichiers.flatMap(({ chemin, code }) => {
    const c = sansCommentaires(code);
    const out: string[] = [];
    if (lecture.test(c)) out.push(`${chemin} lit une table du dossier client`);
    if (IMPORT_DU_CIRCUIT.test(c)) out.push(`${chemin} importe un module du circuit visio`);
    return out;
  });
}

describe("aucun outil MCP ne lit le dossier client", () => {
  it("la liste dérivée du schéma contient bien le dossier (sinon la garde serait vide)", () => {
    const liste = interdits();
    for (const a of ["fait", "compteRendu", "transcriptionSegment", "clientContact", "rencontre"]) {
      expect(liste).toContain(a);
    }
  });

  it("la garde regarde bien l'adaptateur MCP", () => {
    expect(sourcesSous(DOSSIER_MCP)).toContain("src/server/mcp/appel.ts");
  });

  it("contre-témoin : une lecture ou un import du circuit est reconnu", () => {
    expect(
      fautes([
        { chemin: "src/server/mcp/x.ts", code: `const f = await prisma.fait.findMany({});` },
        { chemin: "src/server/mcp/y.ts", code: `import { a } from "@/server/visio/etats";` },
        { chemin: "src/server/mcp/z.ts", code: `// prisma.compteRendu.findMany — interdit` },
      ]),
    ).toHaveLength(2);
  });

  it("aucun fichier de l'adaptateur MCP ne lit le dossier client", () => {
    const fichiers = sourcesSous(DOSSIER_MCP).map((chemin) => ({ chemin, code: lire(chemin) }));
    expect(
      fautes(fichiers),
      "le dossier client ne sort jamais par l'adaptateur MCP (PA-12) — l'ouvrir exige une décision de Will :",
    ).toEqual([]);
  });
});
