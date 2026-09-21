// Le dossier apporteur ne part pas au CRM — garde statique.
//
// ── Pourquoi une garde, en plus du test de l'action ───────────────────────
// Ordre de Will du 04/09 : « rien ne part au CRM sans ma validation ». Le
// dossier complet du tunnel apporteurs appelait pourtant `syncCandidateToCrm`,
// et des dossiers sont effectivement partis (mesure R8 du 19/09 ; le détail est
// tenu hors de ce dépôt, qui est PUBLIC). La décision B2 du 19/09 coupe cet
// envoi.
//
// Le test de `submitCommercialApplicationAction` prouve que l'action ne l'appelle
// plus. Il ne dit rien du fichier voisin : une nouvelle action du tunnel (une
// relance, une saisie manuelle, un bouton « transmettre ») pourrait rouvrir le
// canal sans passer par lui. Cette garde ferme le DOSSIER entier : aucun module
// du tunnel apporteur n'importe `@/server/crm-sync`, imports dynamiques compris.
//
// ── Ce qu'elle ne couvre pas, délibérément ────────────────────────────────
// Les fichiers de test (`__tests__`, `*.spec.*`, `*.test.*`) : un test peut
// légitimement simuler le module pour prouver qu'il n'est PAS appelé.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Les deux dossiers du tunnel apporteur : les actions serveur et le formulaire. */
const DOSSIERS = [
  "src/features/commercial-application",
  "src/components/forms/commercial-application",
];

/**
 * Toute spécification de module qui désigne la synchro CRM : `from "…"`,
 * `import "…"`, `import("…")`, `require("…")`, en alias `@/` comme en relatif.
 */
const IMPORT_CRM =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["'`][^"'`]*server\/crm-sync(?:\/[^"'`]*)?["'`]/;

function estUnTest(relatif: string): boolean {
  return (
    relatif.split(/[\\/]/).includes("__tests__") || /\.(spec|test)\.[cm]?[jt]sx?$/.test(relatif)
  );
}

/**
 * Retire commentaires de ligne et de bloc.
 *
 * 🔑 Sans ça, la garde ci-dessous accuse le texte qui ÉNONCE la règle : la
 * doctrine « jamais de `NOT: FILTRE_APPORTEUR_PRISMA` » est écrite en toutes
 * lettres dans l'en-tête de `est-apporteur.ts`. Mesuré au premier essai : un
 * seul coupable, et c'était le commentaire. Une règle doit pouvoir se citer
 * elle-même. Même procédé que `le-tunnel-apporteur-ne-dit-jamais-agent-commercial`.
 */
function codeSeul(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*/g, "$1");
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
  return trouves.filter((f) => !estUnTest(f));
}

describe("le dossier apporteur ne part pas au CRM (décision B2, 19/09)", () => {
  it("la garde regarde bien quelque chose — sinon elle serait verte pour rien", () => {
    // Un renommage de dossier rendrait la liste vide, et la garde verte en
    // cessant de lire. On exige les deux fichiers qui portaient ou pourraient
    // porter l'envoi.
    const tous = DOSSIERS.flatMap(sources).map((f) => f.split(path.sep).join("/"));
    expect(tous).toContain("src/features/commercial-application/actions.ts");
    expect(tous).toContain("src/components/forms/commercial-application/wizard-state.ts");
  });

  it("le motif reconnaît un import réel — témoin positif sur /carrieres", () => {
    // `/carrieres` part toujours au CRM (ADR 0047) : son action importe la
    // synchro. Si le motif ne la reconnaissait pas, la garde ci-dessous ne
    // prouverait rien.
    const carrieres = readFileSync(
      path.join(RACINE, "src/features/job-application/actions.ts"),
      "utf8",
    );
    expect(IMPORT_CRM.test(carrieres)).toBe(true);
    // Et les formes dynamiques, qu'une réouverture discrète emprunterait.
    expect(IMPORT_CRM.test(`const m = await import("@/server/crm-sync");`)).toBe(true);
    expect(IMPORT_CRM.test(`import { x } from "../../server/crm-sync/enqueue";`)).toBe(true);
    expect(IMPORT_CRM.test(`const m = require('@/server/crm-sync')`)).toBe(true);
  });

  it("aucun module du tunnel apporteur n'importe @/server/crm-sync", () => {
    const fautifs = DOSSIERS.flatMap(sources).filter((f) =>
      IMPORT_CRM.test(readFileSync(path.join(RACINE, f), "utf8")),
    );
    expect(
      fautifs,
      "ces fichiers rouvrent l'envoi au CRM coupé le 19/09 (décision B2, ADR 0051) :",
    ).toEqual([]);
  });
  // ── 2026-09-21 — la doctrine « jamais de NOT: » devient EXÉCUTABLE ───────
  //
  // `est-apporteur.ts` interdit, en commentaire, d'écrire
  // `NOT: FILTRE_APPORTEUR_PRISMA` pour exclure les apporteurs d'une requête.
  // Le motif est un piège SQL réel : en base, un chemin JSON absent rend NULL,
  // et `NOT (NULL = 'x')` vaut encore NULL — la ligne DISPARAÎT du résultat.
  // Toutes les submissions sans `subType`, c'est-à-dire la plupart des demandes
  // clients, sortiraient silencieusement, sans la moindre erreur.
  //
  // 🔴 Jusqu'ici cette règle n'était portée QUE par un commentaire : rien ne
  // rougissait si quelqu'un l'écrivait. Sa doctrine jumelle (ne pas importer
  // `@/server/crm-sync` dans ce dossier) avait sa garde ; celle-ci non. On
  // comble l'écart — un commentaire n'est pas une garde.
  //
  // Portée : tout `src/`, pas seulement le tunnel. Le piège vaut partout où la
  // constante est lue, et son premier consommateur de production vit ailleurs
  // (`src/server/calendly/`, unité P9).
  const NEGATION_DU_FILTRE = /NOT\s*:\s*\{?\s*(?:\.\.\.\s*)?FILTRE_APPORTEUR_PRISMA/;

  it("le prédicat de négation reconnaît les formes qu'un développeur écrirait", () => {
    // Témoin : une garde qui ne reconnaît pas la faute ne la trouvera jamais.
    expect(NEGATION_DU_FILTRE.test(`NOT: FILTRE_APPORTEUR_PRISMA`)).toBe(true);
    expect(NEGATION_DU_FILTRE.test(`NOT: { ...FILTRE_APPORTEUR_PRISMA }`)).toBe(true);
    expect(NEGATION_DU_FILTRE.test(`NOT:{...FILTRE_APPORTEUR_PRISMA}`)).toBe(true);
    // Et il ne crie pas sur l'usage LÉGITIME, qui est une inclusion.
    expect(NEGATION_DU_FILTRE.test(`where: { ...FILTRE_APPORTEUR_PRISMA }`)).toBe(false);
    // Ni sur la doctrine qui se cite elle-même : `est-apporteur.ts` écrit la
    // règle en toutes lettres dans son en-tête, et la garde l'accusait au
    // premier essai. Commentaire de BLOC, comme celui du module.
    expect(NEGATION_DU_FILTRE.test(codeSeul("/** NOT: FILTRE_APPORTEUR_PRISMA */"))).toBe(false);
    // Et en commentaire de LIGNE, l'autre forme que `codeSeul` doit retirer.
    expect(NEGATION_DU_FILTRE.test(codeSeul("// NOT: FILTRE_APPORTEUR_PRISMA"))).toBe(false);
  });

  it("aucun module de src/ n'exclut les apporteurs par une négation en base", () => {
    const fautifs = sources("src").filter((f) =>
      NEGATION_DU_FILTRE.test(codeSeul(readFileSync(path.join(RACINE, f), "utf8"))),
    );
    expect(
      fautifs,
      "ces fichiers excluent les apporteurs par `NOT:` — en SQL, un chemin JSON " +
        "absent rend NULL et la négation d'un NULL reste NULL : les demandes " +
        "clients sans `subType` disparaîtraient du résultat, sans erreur. " +
        "Lire, puis filtrer en mémoire avec `estApporteur` :",
    ).toEqual([]);
  });
});
