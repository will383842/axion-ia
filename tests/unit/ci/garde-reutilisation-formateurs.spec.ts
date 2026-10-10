/**
 * ⛔ Garde « ne rien recréer » du chantier formateurs indépendants (lot X3, ADR 0066).
 *
 * L'ADR 0066 écarte explicitement la copie du parcours apporteur : « deux copies
 * divergent dès la première correction ». Les briques communes (lien signé, registre,
 * e-mail, files de tâches, interrupteurs, habilitations, chiffrement, preuves de
 * signature) sont RÉUTILISÉES ou EXTRAITES vers un module commun, jamais réécrites.
 *
 * Périmètre balayé (les dossiers n'existent pas encore : 0 fichier aujourd'hui, la
 * garde est verte ; elle rougit dès le premier fichier qui viole une règle) :
 *   · tout fichier sous un dossier `formateurs-independants/` dans `src/` ;
 *   · tout fichier sous `…/formateur/dossier/` dans `src/app/` (avec ou sans `[locale]`).
 * Les fichiers de test (`__tests__`, `*.spec.*`, `*.test.*`) sont exclus.
 *
 * Règles (chacune nomme le module à réutiliser) :
 *   1. `createHmac`                        → fabrique de liens signés ;
 *   2. URL `recherche-entreprises.api.gouv.fr` → client du registre existant ;
 *   3. `nodemailer`                        → `sendEmail` ;
 *   4. `new Queue(`                        → files déclarées dans `queues.ts` ;
 *   5. clé de réglage `formateurs.*` ou variable d'environnement `*FORMATEUR*`
 *      hors d'un fichier `interrupteurs.ts` (ADR 0066 (f)) ;
 *   6. comparaison à `"super_admin"` hors d'un fichier `habilitations.ts` ;
 *   7. définition de `ibanValide`, `jugerAdmission`, `estReponseAutomatique`,
 *      `normaliserNom`, `encrypt*` ;
 *   8. import de `features/apporteurs-reseau/**` (on passe par les modules communs) ;
 *   9. nouveau `model …Signature…` dans `prisma/schema.prisma` hors de la liste figée.
 *
 * Contre-témoins : des sources synthétiques violant chaque règle font échouer
 * `violationsReutilisation` ; des témoins prouvent que chaque détecteur trouve bien
 * l'original dans le module de référence (un détecteur mort serait vert pour rien).
 * Angle mort assumé : un alias (`const h = crypto["create" + "Hmac"]`) n'est pas vu.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

/** Les tables de preuve de signature existantes au 2026-10-10. Ne s'allonge que par ADR. */
const MODELES_SIGNATURE_FIGES: ReadonlyArray<string> = [
  "CoachingSeanceSignature",
  "DocumentSignature",
  // Lot S6a (e) — ce n'est PAS une table de preuve : elle porte l'empreinte HMAC
  // d'un code éphémère (10 min, 5 essais) que l'ADR 0066 étape 7 exige pour
  // signer le contrat-cadre. La preuve, elle, reste dans `DocumentSignature`.
  "DocumentSignatureCode",
  "DocumentSignatureToken",
  "EmargementContresignature",
  "EmargementSignature",
];

type Source = { chemin: string; source: string };

interface Regle {
  id: string;
  motif: RegExp;
  /** Fichier (par nom de base) où la règle ne s'applique pas. */
  saufFichier?: string;
  message: (trouve: string) => string;
}

const FONCTIONS_A_REUTILISER: Readonly<Record<string, string>> = {
  ibanValide: "src/features/apporteurs-reseau/regles-dossier.ts (à extraire en module commun)",
  jugerAdmission: "src/features/apporteurs-reseau/regles.ts (à extraire en module commun)",
  estReponseAutomatique: "src/lib/commercial-application/reponse-entrante.ts",
  normaliserNom: "src/server/qualiopi/crm/normaliser-nom.ts",
  encrypt: "src/lib/pii-crypto.ts (encryptPii)",
};

const REGLES: ReadonlyArray<Regle> = [
  {
    id: "hmac",
    motif: /\bcreateHmac\b/g,
    message: () =>
      "réutilisez la fabrique de liens signés (src/features/apporteurs-reseau/jeton.ts ou son module commun) au lieu de recréer une signature `createHmac`",
  },
  {
    id: "registre",
    motif: /recherche-entreprises\.api\.gouv\.fr/g,
    message: () =>
      "réutilisez le client du registre (src/features/apporteurs-reseau/annuaire.ts ou son module commun) au lieu de recréer un appel à recherche-entreprises",
  },
  {
    id: "nodemailer",
    motif: /["'`]nodemailer["'`]/g,
    message: () =>
      "réutilisez sendEmail (src/lib/email/client.ts) au lieu de recréer un transport nodemailer",
  },
  {
    id: "queue",
    motif: /\bnew\s+Queue\s*[(<]/g,
    message: () =>
      "réutilisez les files déclarées dans src/server/queue/queues.ts au lieu de recréer une `new Queue(`",
  },
  {
    id: "interrupteur",
    motif: /["'`]formateurs\.[A-Za-z_]|\bprocess\.env\.[A-Z0-9_]*FORMATEUR/g,
    saufFichier: "interrupteurs.ts",
    message: (t) =>
      `réutilisez le module interrupteurs.ts du chantier au lieu de recréer une lecture de réglage (${t})`,
  },
  {
    id: "super_admin",
    motif: /[!=]==?\s*["'`]super_admin["'`]|["'`]super_admin["'`]\s*[!=]==?/g,
    saufFichier: "habilitations.ts",
    message: () =>
      'réutilisez src/server/auth/habilitations.ts au lieu de recréer une comparaison à "super_admin"',
  },
  {
    id: "fonction",
    motif:
      /\b(?:function\s*\*?\s*|(?:const|let|var)\s+)(ibanValide|jugerAdmission|estReponseAutomatique|normaliserNom|encrypt\w*)\b/g,
    message: (nom) => {
      const cle = nom.startsWith("encrypt") ? "encrypt" : nom;
      return `réutilisez ${FONCTIONS_A_REUTILISER[cle]} au lieu de recréer \`${nom}\``;
    },
  },
  {
    id: "import-apporteurs",
    motif:
      /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)["'`]([^"'`]*apporteurs-reseau(?:\/[^"'`]*)?)["'`]/g,
    message: (spec) =>
      `réutilisez un module commun extrait au lieu d'importer le parcours apporteur (${spec})`,
  },
];

/** Vrai si le chemin (relatif, en `/`) relève du chantier formateurs indépendants. */
function dansLePerimetre(chemin: string): boolean {
  if (!chemin.startsWith("src/")) return false;
  if (/(^|\/)__tests__\//.test(chemin) || /\.(spec|test)\.[cm]?[jt]sx?$/.test(chemin)) return false;
  if (!/\.[cm]?[jt]sx?$/.test(chemin)) return false;
  return (
    /\/formateurs-independants\//.test(chemin) ||
    /^src\/app\/(?:.*\/)?formateur\/dossier\//.test(chemin)
  );
}

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/** Toutes les violations des règles 1 à 8 dans les sources du périmètre. */
function violationsReutilisation(sources: ReadonlyArray<Source>): string[] {
  const fautes: string[] = [];
  for (const { chemin, source } of sources) {
    if (!dansLePerimetre(chemin)) continue;
    const code = sansCommentaires(source);
    for (const regle of REGLES) {
      if (regle.saufFichier && basename(chemin) === regle.saufFichier) continue;
      for (const m of code.matchAll(regle.motif)) {
        const ligne = code.slice(0, m.index ?? 0).split("\n").length;
        fautes.push(`${chemin}:${ligne} [${regle.id}] ${regle.message(m[1] ?? m[0])}`);
      }
    }
  }
  return fautes;
}

/** Règle 9 : tout modèle de preuve de signature hors de la liste figée. */
function nouveauxModelesSignature(schema: string): string[] {
  const modeles = [...schema.matchAll(/^model\s+(\w*[Ss]ignature\w*)\s*\{/gm)].map((m) => m[1]!);
  return modeles
    .filter((m) => !MODELES_SIGNATURE_FIGES.includes(m))
    .map(
      (m) =>
        `prisma/schema.prisma [signature] réutilisez DocumentSignature / EmargementSignature au lieu de recréer une table de preuve de signature (\`model ${m}\`) — sinon ADR et mise à jour de la liste figée`,
    );
}

function fichiers(dossier: string): string[] {
  if (!existsSync(dossier)) return [];
  const res: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom === "node_modules" || nom === "generated") continue;
      res.push(...fichiers(chemin));
    } else {
      res.push(chemin);
    }
  }
  return res;
}

function lire(chemin: string): Source {
  return { chemin, source: readFileSync(join(RACINE, chemin), "utf8") };
}

describe("⛔ formateurs indépendants : ne rien recréer (ADR 0066, lot X3)", () => {
  const sources = fichiers(join(RACINE, "src"))
    .map((c) => relative(RACINE, c).split("\\").join("/"))
    .filter(dansLePerimetre)
    .map(lire);

  it("aucun fichier du chantier ne recrée une brique commune", () => {
    expect(violationsReutilisation(sources)).toEqual([]);
  });

  it("aucune nouvelle table de preuve de signature dans le schéma", () => {
    const schema = readFileSync(join(RACINE, "prisma/schema.prisma"), "utf8");
    expect(nouveauxModelesSignature(schema)).toEqual([]);
  });

  it("témoin : la liste figée des signatures existe bien dans le schéma (pas de nom mort)", () => {
    const schema = readFileSync(join(RACINE, "prisma/schema.prisma"), "utf8");
    for (const m of MODELES_SIGNATURE_FIGES) {
      expect(schema, `model ${m} absent du schéma`).toMatch(
        new RegExp(`^model\\s+${m}\\s*\\{`, "m"),
      );
    }
  });

  it("témoin : chaque détecteur reconnaît l'original dans son module de référence", () => {
    const references: ReadonlyArray<[string, string]> = [
      ["hmac", "src/features/apporteurs-reseau/jeton.ts"],
      ["registre", "src/features/apporteurs-reseau/annuaire.ts"],
      ["queue", "src/server/queue/queues.ts"],
      ["fonction", "src/features/apporteurs-reseau/regles-dossier.ts"],
      ["fonction", "src/features/apporteurs-reseau/regles.ts"],
      ["fonction", "src/lib/commercial-application/reponse-entrante.ts"],
      ["fonction", "src/server/qualiopi/crm/normaliser-nom.ts"],
      ["fonction", "src/lib/pii-crypto.ts"],
    ];
    for (const [id, chemin] of references) {
      const regle = REGLES.find((r) => r.id === id)!;
      const code = sansCommentaires(readFileSync(join(RACINE, chemin), "utf8"));
      expect([...code.matchAll(regle.motif)].length, `${id} dans ${chemin}`).toBeGreaterThan(0);
    }
  });

  it("le périmètre vise les dossiers du chantier et eux seuls", () => {
    expect(dansLePerimetre("src/features/formateurs-independants/dossier.ts")).toBe(true);
    expect(dansLePerimetre("src/server/formateurs-independants/garde/mission.ts")).toBe(true);
    expect(dansLePerimetre("src/app/formateur/dossier/[id]/page.tsx")).toBe(true);
    expect(dansLePerimetre("src/app/[locale]/formateur/dossier/page.tsx")).toBe(true);
    expect(dansLePerimetre("src/features/apporteurs-reseau/jeton.ts")).toBe(false);
    expect(dansLePerimetre("src/app/apporteur/dossier/page.tsx")).toBe(false);
    expect(dansLePerimetre("src/features/formateurs-independants/__tests__/x.spec.ts")).toBe(false);
    expect(dansLePerimetre("src/features/formateurs-independants/lien.spec.ts")).toBe(false);
  });
});

describe("test du test : une violation fait échouer la fonction de contrôle", () => {
  const F = "src/features/formateurs-independants";

  it("une source propre ne lève rien", () => {
    expect(
      violationsReutilisation([
        {
          chemin: `${F}/dossier.ts`,
          source:
            'import { lireRegistre } from "@/features/registre-commun/annuaire";\n// createHmac en commentaire\nexport const url = "https://axion-ia.com";\n',
        },
      ]),
    ).toEqual([]);
  });

  it("chaque règle rougit et nomme le module à réutiliser", () => {
    const fautes = violationsReutilisation([
      { chemin: `${F}/lien.ts`, source: 'import { createHmac } from "node:crypto";' },
      {
        chemin: `${F}/registre.ts`,
        source: 'await fetch("https://recherche-entreprises.api.gouv.fr/search?q=1");',
      },
      { chemin: `${F}/mail.ts`, source: 'import nodemailer from "nodemailer";' },
      { chemin: `${F}/file.ts`, source: 'const q = new Queue("fi", { connection });' },
      { chemin: `${F}/allumage.ts`, source: 'const on = await getSetting("formateurs.parcours");' },
      { chemin: `${F}/env.ts`, source: "const on = process.env.FORMATEURS_PARCOURS === 'true';" },
      { chemin: `${F}/droits.ts`, source: 'if (user.role === "super_admin") return true;' },
      { chemin: `${F}/iban.ts`, source: "export function ibanValide(s: string) { return !!s; }" },
      { chemin: `${F}/admission.ts`, source: "export const jugerAdmission = () => 'vert';" },
      { chemin: `${F}/auto.ts`, source: "function estReponseAutomatique() { return false; }" },
      { chemin: `${F}/nom.ts`, source: "const normaliserNom = (n: string) => n.trim();" },
      { chemin: `${F}/chiffre.ts`, source: "export function encryptIban(s: string) { return s; }" },
      {
        chemin: "src/app/formateur/dossier/page.tsx",
        source: 'import { jetonDossier } from "@/features/apporteurs-reseau/jeton";',
      },
    ]);
    expect(fautes.map((f) => f.match(/\[([\w-]+)\]/)![1])).toEqual([
      "hmac",
      "registre",
      "nodemailer",
      "queue",
      "interrupteur",
      "interrupteur",
      "super_admin",
      "fonction",
      "fonction",
      "fonction",
      "fonction",
      "fonction",
      "import-apporteurs",
    ]);
    for (const f of fautes) expect(f).toMatch(/réutilisez .+ au lieu d/);
    expect(fautes[0]).toContain("src/features/apporteurs-reseau/jeton.ts");
    expect(fautes[1]).toContain("src/features/apporteurs-reseau/annuaire.ts");
    expect(fautes[11]).toContain("src/lib/pii-crypto.ts");
    expect(fautes[12]).toContain("src/app/formateur/dossier/page.tsx:1");
  });

  it("interrupteurs.ts et habilitations.ts gardent leur droit exclusif", () => {
    expect(
      violationsReutilisation([
        { chemin: `${F}/interrupteurs.ts`, source: 'getSetting("formateurs.parcours");' },
        { chemin: `${F}/habilitations.ts`, source: 'role === "super_admin";' },
      ]),
    ).toEqual([]);
  });

  it("hors périmètre, rien n'est jugé", () => {
    expect(
      violationsReutilisation([
        { chemin: "src/features/apporteurs-reseau/jeton.ts", source: "createHmac('sha256', k);" },
      ]),
    ).toEqual([]);
  });

  it("un nouveau model …Signature… rougit, la liste figée non", () => {
    const schema = [
      ...MODELES_SIGNATURE_FIGES.map((m) => `model ${m} {\n  id String @id\n}`),
      "model ContratFormateurSignature {\n  id String @id\n}",
    ].join("\n\n");
    const fautes = nouveauxModelesSignature(schema);
    expect(fautes).toHaveLength(1);
    expect(fautes[0]).toContain("ContratFormateurSignature");
    expect(fautes[0]).toContain("réutilisez DocumentSignature");
  });
});
