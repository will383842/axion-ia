// @vitest-environment node

/**
 * Plan « sept points salariat », lot L5c (décision D6 = oui).
 *
 * Le formulaire d'entrée des apporteurs vit à `/apporteur-affaires/dossier`.
 * L'ancienne adresse `/devenir-commercial-ia/candidature` (« candidature » est un
 * mot d'embauche) redirige en 301, query string conservée par Next (`?depuis=`).
 *
 * ⚠️ Le CANAL enregistré en base (`details.source`) garde l'ancienne valeur : c'est
 * une clé technique lue par la reconnaissance des dossiers complets et par le contrat
 * partenaires, pas un lien. La changer rendrait invisibles les dossiers déjà reçus.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = path.resolve(__dirname, "../../..");
const lire = (p: string) => readFileSync(path.join(RACINE, p), "utf8");

const ANCIENNE = "/devenir-commercial-ia/candidature";
const NOUVELLE = "/apporteur-affaires/dossier";

describe("redirection de l'ancienne adresse du formulaire", () => {
  const config = lire("next.config.ts");

  it.each([
    ["/:locale(fr|en)/devenir-commercial-ia/candidature"],
    ["/:locale(fr|en)/apporteur/candidature"],
  ])("%s redirige en 301 directement vers la nouvelle adresse", (source) => {
    const i = config.indexOf(`source: "${source}"`);
    expect(i, `source ${source} absente de next.config.ts`).toBeGreaterThan(-1);
    const bloc = config.slice(i, i + 220);
    expect(bloc).toContain(`destination: "/:locale${NOUVELLE}"`);
    expect(bloc).toContain("statusCode: 301");
  });

  it("aucune redirection ne mène encore vers l'ancienne adresse (pas de chaîne)", () => {
    expect(config).not.toMatch(/destination:\s*"[^"]*devenir-commercial-ia\/candidature"/);
  });
});

describe("la page vit à la nouvelle adresse", () => {
  it("la page est à /apporteur-affaires/dossier, plus à l'ancienne adresse", () => {
    expect(
      existsSync(path.join(RACINE, "src/app/[locale]/apporteur-affaires/dossier/page.tsx")),
    ).toBe(true);
    expect(
      existsSync(path.join(RACINE, "src/app/[locale]/devenir-commercial-ia/candidature/page.tsx")),
    ).toBe(false);
  });

  it("le canonical de la page est la nouvelle adresse", () => {
    const page = lire("src/app/[locale]/apporteur-affaires/dossier/page.tsx");
    expect(page).toContain(`const PATH = "${NOUVELLE}"`);
  });

  it("le sitemap annonce la nouvelle adresse, pas l'ancienne", () => {
    const s = lire("src/app/sitemap-recrutement.xml/route.ts");
    expect(s).toContain(`path: "${NOUVELLE}"`);
    expect(s).not.toContain(ANCIENNE);
  });
});

describe("aucun lien interne ne vise l'ancienne adresse", () => {
  // Fichiers autorisés à nommer l'ancienne adresse : le canal enregistré (clé
  // technique), la redirection, et deux fichiers hors périmètre de ce lot.
  const AUTORISES = [
    "src/lib/commercial-application/lead-apporteur.ts", // DOSSIER_COMPLET_SOURCE
    "next.config.ts",
    "src/content/legal.ts", // texte juridique, non modifié par ce lot
    "src/generated/content-freshness.ts", // généré
    "scripts/partners/fixtures.ts", // exemple de canal enregistré (clé technique)
    "src/server/partners/contrat/fixtures.v3.json", // idem, contrat partenaires
  ];

  it("hors tests, seuls les fichiers autorisés la mentionnent", () => {
    const sortie = execSync(`git grep -l "${ANCIENNE}" -- src scripts`, {
      cwd: RACINE,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean)
      .filter((f) => !/__tests__|\.spec\.|\.test\.|\.stub\./.test(f))
      .filter((f) => !AUTORISES.includes(f));
    expect(sortie).toEqual([]);
  });

  it("le canal enregistré en base garde sa valeur historique", () => {
    const l = lire("src/lib/commercial-application/lead-apporteur.ts");
    expect(l).toContain(`DOSSIER_COMPLET_SOURCE = "${ANCIENNE}"`);
    expect(l).toContain(`DOSSIER_COMPLET_PATH = "${NOUVELLE}"`);
  });
});
