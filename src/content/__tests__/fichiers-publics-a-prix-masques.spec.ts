/**
 * R7 — les fichiers statiques de `public/` qui affichent un prix (ou une commission)
 * ne sont plus servis au public (ordre de Williams du 08/11/2026 : seule la Journée IA
 * à 1 490 € HT reste affichée).
 *
 * `public/` est servi tel quel, HORS du middleware (`src/proxy.ts` exclut `.html`,
 * `.pdf`, `.jpg`…) et hors des pages : l'interrupteur de `pricing.ts` ne l'atteint pas.
 * Les fichiers ne sont PAS supprimés (un QR imprimé, un e-mail déjà envoyé y pointent) :
 * une redirection TEMPORAIRE (307, réversible) de `next.config.ts` passe AVANT le système de fichiers et
 * les masque. Et aucun lien de `src/` (hors console d'administration) n'y mène plus.
 *
 * Inventaire (relu le 08/11/2026, `pdftotext` + lecture des images) :
 *   - `public/catalogue/index.html` + `pages-web/*.jpg` : le catalogue à feuilleter,
 *     un prix par offre (« 3 600 € HT / groupe », p. 36 « Tous nos tarifs ») ;
 *     `og-catalogue.jpg` en reproduit la couverture (« 0 € », « Dès 1 190 € »).
 *   - `public/imprimes/devenir-apporteur-d-affaires-axion-ia.pdf` : commissions
 *     (500 €/journée, 30 %) et prix de vente (1 200 €, 1 190 €, 990 €).
 *
 * NON masqués, et pourquoi (vérifié) :
 *   - `public/imprimes/guide-ia-entreprise-2026-axion-ia.pdf` : ses euros sont des
 *     tarifs d'ÉDITEURS (Google Workspace, OpenAI…), des exemples de ROI et des
 *     plafonds publics (CPF, Bpifrance) — aucun prix d'Axion-IA ;
 *   - les trois fiches et le dossier intervenant : aucun montant ;
 *   - `public/documents/apporteurs/comment-ca-marche.pdf` : fiche de l'apporteur
 *     SOUS CONTRAT, liée seulement par l'e-mail privé `apporteur-demarrage.tsx`.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

// Le moteur de motifs de Next lui-même (sans déclaration de types publiée).
const { pathToRegexp } = createRequire(import.meta.url)("next/dist/compiled/path-to-regexp") as {
  pathToRegexp: (source: string) => RegExp;
};

const RACINE = process.cwd();

/**
 * Depuis #1871 les fichiers ne sont plus sous `public/` : ils sont archivés ici (rien n'est
 * supprimé). Les redirections restent le filet des anciennes adresses (QR, e-mails).
 */
const ARCHIVE = "docs/pdf-hors-ligne-certification";

/** Chemins publics (URL) porteurs de prix. Chaque entrée DOIT exister dans l'archive. */
const FICHIERS_A_PRIX: readonly string[] = [
  "/catalogue/index.html",
  "/catalogue/og-catalogue.jpg",
  ...readdirSync(join(RACINE, ARCHIVE, "catalogue-feuilletoir/pages-web")).map(
    (f) => `/catalogue/pages-web/${f}`,
  ),
  "/imprimes/devenir-apporteur-d-affaires-axion-ia.pdf",
];

interface Regle {
  source: string;
  destination: string;
  permanent?: boolean;
  has?: unknown;
  missing?: unknown;
}

async function regles(): Promise<Regle[]> {
  const config = (await import("../../../next.config")).default as {
    redirects?: () => Promise<Regle[]>;
  };
  return (await config.redirects?.()) ?? [];
}

function regleQuiCouvre(rs: readonly Regle[], chemin: string): Regle | undefined {
  // Next applique la PREMIÈRE règle qui correspond.
  return rs.find((r) => pathToRegexp(r.source).test(chemin));
}

function fichiers(d: string): string[] {
  return readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? fichiers(p) : [p];
  });
}

describe("fichiers publics porteurs de prix : masqués par une redirection temporaire (307)", () => {
  it("l'inventaire n'est pas vide, chaque fichier est archivé et plus servi par public/ (on retire, on ne supprime pas)", () => {
    expect(FICHIERS_A_PRIX.length).toBeGreaterThan(40);
    const archive = (c: string) =>
      c.startsWith("/catalogue/")
        ? join(RACINE, ARCHIVE, "catalogue-feuilletoir", c.replace("/catalogue/", ""))
        : join(RACINE, ARCHIVE, "apporteur", c.replace("/imprimes/", ""));
    for (const c of FICHIERS_A_PRIX) {
      expect(existsSync(archive(c)), c).toBe(true);
      expect(existsSync(join(RACINE, "public", c)), c).toBe(false);
    }
  });

  it("chaque fichier est masqué par une redirection TEMPORAIRE (307), sans condition, vers une page neutre", async () => {
    const rs = await regles();
    for (const c of FICHIERS_A_PRIX) {
      const r = regleQuiCouvre(rs, c);
      expect(r, c).toBeDefined();
      expect(r?.permanent, c).toBe(false);
      expect(r?.has ?? r?.missing, c).toBeUndefined();
      expect(r?.destination, c).toMatch(/^\/fr(\/[a-z-]+)?$/);
    }
  });

  it("la redirection ne déborde pas : la page /fr/catalogue et le guide IA restent servis", async () => {
    const rs = await regles();
    expect(regleQuiCouvre(rs, "/imprimes/guide-ia-entreprise-2026-axion-ia.pdf")).toBeUndefined();
    expect(regleQuiCouvre(rs, "/documents/apporteurs/comment-ca-marche.pdf")).toBeUndefined();
    expect(regleQuiCouvre(rs, "/fr/catalogue")).toBeUndefined();
  });
});

describe("aucun lien de src/ (hors console d'administration) ne mène à un fichier masqué", () => {
  const sources = fichiers(join(RACINE, "src"))
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .filter((f) => !/\.(spec|test)\.tsx?$/.test(f) && !f.includes(`${sep}__tests__${sep}`))
    .filter((f) => !f.includes(`${sep}(admin)${sep}`) && !f.includes(`${sep}admin${sep}`));

  it("le scan lit bien le dépôt (témoin)", () => {
    expect(sources.length).toBeGreaterThan(500);
  });

  it("aucune source publique ne cite /catalogue/index.html, pages-web, og-catalogue ou le PDF apporteur", () => {
    const motifs = [
      /\/catalogue\/index\.html/,
      /catalogue\/pages-web/,
      /og-catalogue\.jpg/,
      /devenir-apporteur-d-affaires-axion-ia\.pdf/,
    ];
    // Le chemin du PDF reste déclaré par une constante (`DOCUMENT_APPORTEUR_CHEMIN`) que
    // l'onglet Imprimés de la console relit ; il n'est lié nulle part au public
    // (`DOCUMENT_APPORTEUR_DIFFUSE = false`, gardé par `kit-apporteur-sans-pdf.spec.ts`).
    const autorises = new Set([
      "src/lib/commercial-application/kit-apporteur.ts",
      // Référentiel de l'onglet Imprimés de la CONSOLE (vérifié plus bas : seuls la console
      // et le composeur l'importent, et le composeur ne propose pas le catalogue).
      "src/content/imprimes.ts",
      // La page /[locale]/catalogue ne rend son lien que si la certification est délivrée
      // ET `PRIX_PUBLICS_AFFICHES` est vrai ; sinon elle redirige (vérifié plus bas et par
      // `le-catalogue-attend-la-certification.spec.tsx`).
      "src/app/[locale]/catalogue/page.tsx",
    ]);
    const fautifs = sources
      .map((f) => relative(RACINE, f).split(sep).join("/"))
      .filter((rel) => !autorises.has(rel))
      .filter((rel) => {
        const code = readFileSync(join(RACINE, rel), "utf8")
          .split("\n")
          .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
          .join("\n");
        return motifs.some((m) => m.test(code));
      });
    expect(fautifs).toEqual([]);
  });

  it("les exceptions tiennent : la page catalogue est gardée par l'interrupteur, imprimes.ts reste interne", () => {
    const page = readFileSync(join(RACINE, "src/app/[locale]/catalogue/page.tsx"), "utf8");
    expect(page).toMatch(/!isQualiopiCertificationObtenue\(\) \|\| !PRIX_PUBLICS_AFFICHES/);

    const importeurs = sources
      .map((f) => relative(RACINE, f).split(sep).join("/"))
      .filter((rel) =>
        readFileSync(join(RACINE, rel), "utf8").includes('from "@/content/imprimes"'),
      );
    const internes =
      /\/(?:\(admin\)|admin|admin-imprimes)\/|^src\/lib\/admin-nav\.ts$|^src\/lib\/imprimes\/liens-email\.ts$/;
    expect(importeurs.filter((rel) => !internes.test(rel))).toEqual([]);

    const composeur = readFileSync(join(RACINE, "src/lib/imprimes/liens-email.ts"), "utf8");
    const proposes = /IMPRIMES_PROPOSES[^=]*=\s*\[([\s\S]*?)\];/.exec(composeur)?.[1] ?? "";
    expect(proposes.length).toBeGreaterThan(0);
    expect(proposes).not.toMatch(/catalogue-a4|devenir-apporteur/);
  });
});
