import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = resolve(process.cwd(), "src");
const DOSSIER = join(RACINE, "server/qualiopi/documents/cadre-pieces");

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((nom) => {
    const chemin = join(dir, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

/** Code seul : les commentaires d'historique peuvent citer les anciens noms. */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const sources = fichiers(DOSSIER).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.spec\.tsx?$/.test(f));

describe("cadre-pieces séparé des pièces signables", () => {
  it("sentinelle : le dossier contient bien les fichiers du cadre", () => {
    const noms = sources.map((f) => f.slice(DOSSIER.length + 1));
    for (const n of ["page.tsx", "blocs.tsx", "tableau.tsx", "encadre.tsx", "index.ts"]) {
      expect(noms).toContain(n);
    }
  });

  it("aucun fichier du cadre n'importe ni n'appelle brandColor ni SignatureZone", () => {
    for (const f of sources) {
      const src = sansCommentaires(readFileSync(f, "utf8"));
      expect(src, f).not.toMatch(/\bbrandColor\b/);
      expect(src, f).not.toMatch(/\bSignatureZone\b/);
    }
  });

  it("l'API publique du cadre n'expose ni SignatureZone, ni pdfStyles, ni brandColor", async () => {
    const cadre = await import("./index");
    expect(cadre).not.toHaveProperty("SignatureZone");
    expect(cadre).not.toHaveProperty("pdfStyles");
    expect(cadre).not.toHaveProperty("brandColor");
  });

  it("index.ts ne ré-exporte de base-layout que les noms autorisés (aucun `export *`)", () => {
    const src = sansCommentaires(readFileSync(join(DOSSIER, "index.ts"), "utf8"));
    expect(src).not.toMatch(/export\s*\*\s*(as\s+\w+\s+)?from\s*["'][^"']*base-layout["']/);
    const reexports = [
      ...src.matchAll(/export\s+(type\s+)?\{([^}]*)\}\s*from\s*["'][^"']*base-layout["']/g),
    ];
    const valeurs: string[] = [];
    const types: string[] = [];
    for (const m of reexports) {
      const noms = (m[2] ?? "")
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      (m[1] ? types : valeurs).push(...noms);
    }
    expect(valeurs.sort()).toEqual(["assainirEspacesPdf", "formatEur", "formatEurosFromCents"]);
    expect(types.sort()).toEqual(["OrganismeIdentite"]);
  });

  it("le cadre des pièces n'est jamais importé par un fichier de devis", () => {
    const devis = fichiers(RACINE).filter(
      (f) =>
        /\.(ts|tsx)$/.test(f) &&
        !f.startsWith(DOSSIER) &&
        /(devis|quote)/i.test(f.slice(RACINE.length)),
    );
    expect(devis.length).toBeGreaterThan(0);
    for (const f of devis) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/cadre-pieces/);
    }
  });
});

// ---------------------------------------------------------------------------
// V8-P2b G1-G3 : bascule des pièces non signables (liste FERMÉE) sur le cadre.
// ---------------------------------------------------------------------------
const QUALIOPI = join(RACINE, "server/qualiopi");
const TEMPLATES = join(QUALIOPI, "documents/templates");

/** G1 pédagogie · G2 évaluations · G3 attestations : 20 pièces, ni plus ni moins. */
const PIECES_BASCULEES = [
  // G1
  "documents/templates/programme-formation.tsx",
  "documents/templates/convocation.tsx",
  "documents/templates/livret-accueil.tsx",
  "documents/templates/reglement-interieur.tsx",
  "documents/templates/organisation-action.tsx",
  "documents/templates/inventaire-moyens.tsx",
  "documents/templates/liste-formateurs.tsx",
  "documents/templates/cv-formateur.tsx",
  "documents/templates/registre.tsx",
  "supports/templates/support-pdf.tsx",
  // G2
  "documents/templates/positionnement.tsx",
  "documents/templates/positionnement-rempli.tsx",
  "documents/templates/grille-evaluation.tsx",
  "documents/templates/evaluation-realisee.tsx",
  "documents/templates/fiche-adaptation.tsx",
  "documents/templates/satisfaction.tsx",
  "documents/templates/satisfaction-remplie.tsx",
  // G3
  "documents/templates/attestation.tsx",
  "documents/templates/attestation-partielle.tsx",
  "documents/templates/certificat-realisation.tsx",
] as const;

/** Signables (12), non signables gardées sur l'ancien cadre (4) : jamais le cadre des pièces. */
const PIECES_QUI_RESTENT_SUR_BASE_LAYOUT = [
  "devis",
  "convention",
  "convention-tripartite",
  "contrat-formation",
  "contrat-sous-traitance",
  "contrat-travail",
  "releve-connexion",
  "lettre-mission",
  "mandat-opco",
  "autorisation-captation",
  "contrat-cadre",
  "lettre-mission-v2",
  "emargement",
  "procedure-sous-traitance",
  "facture",
  "autofacture-honoraires",
].map((n) => join("documents/templates", `${n}.tsx`));

describe("pièces basculées sur le cadre des pièces (G1-G3)", () => {
  it("sentinelle : liste fermée de 20 pièces, toutes présentes sur le disque", () => {
    expect(PIECES_BASCULEES).toHaveLength(20);
    expect(new Set(PIECES_BASCULEES).size).toBe(20);
    for (const rel of PIECES_BASCULEES) {
      expect(() => statSync(join(QUALIOPI, rel)), rel).not.toThrow();
    }
  });

  it("les pièces basculées n'importent plus le cadre de base-layout ni brandColor", () => {
    for (const rel of PIECES_BASCULEES) {
      const src = sansCommentaires(readFileSync(join(QUALIOPI, rel), "utf8"));
      expect(src, rel).not.toMatch(/["'][^"']*base-layout["']/);
      expect(src, rel).not.toMatch(/\bbrandColor\b/);
      expect(src, rel).not.toMatch(/\bpdfStyles\b/);
      expect(src, rel).not.toMatch(/\bSignatureZone\b/);
      expect(src, rel).toMatch(/documents\/cadre-pieces["']/);
    }
  });

  it("liste fermée : les pièces qui importent le cadre ou appellent couleurPiece sont EXACTEMENT PIECES_BASCULEES", () => {
    const dossiers = [TEMPLATES, join(QUALIOPI, "supports/templates")];
    const utilisatrices = dossiers
      .flatMap((d) => fichiers(d))
      .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.spec\.tsx?$/.test(f))
      .filter((f) => !/[\\/](archives|__tests__)[\\/]/.test(f))
      .filter((f) =>
        /cadre-pieces|\bcouleurPiece\b/.test(sansCommentaires(readFileSync(f, "utf8"))),
      )
      .map((f) => relative(QUALIOPI, f).replace(/\\/g, "/"));
    const attendues: string[] = [...PIECES_BASCULEES];
    const enTrop = utilisatrices.filter((f) => !attendues.includes(f)).sort();
    const enMoins = attendues.filter((f) => !utilisatrices.includes(f)).sort();
    expect(
      { enTrop, enMoins },
      `fichiers en trop (hors liste) : ${enTrop.join(", ") || "aucun"} ; en moins : ${enMoins.join(", ") || "aucun"}`,
    ).toEqual({ enTrop: [], enMoins: [] });
  });

  it("aucun signable, archivé ni pièce gardée n'importe le cadre des pièces ni ses jetons", () => {
    for (const rel of PIECES_QUI_RESTENT_SUR_BASE_LAYOUT) {
      const src = readFileSync(join(QUALIOPI, rel), "utf8");
      expect(src, rel).not.toMatch(/cadre-pieces|jetons-pieces|couleurPiece/);
    }
    const archives = fichiers(join(TEMPLATES, "archives")).filter((f) => /\.(ts|tsx)$/.test(f));
    expect(archives.length).toBeGreaterThan(0);
    for (const f of archives) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/cadre-pieces|jetons-pieces|couleurPiece/);
    }
  });
});
