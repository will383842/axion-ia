/**
 * Les identifiants de l'admin de développement n'ont qu'UNE écriture.
 *
 * Ils en avaient deux, divergentes, et la divergence a maintenu quatre specs
 * Playwright hors d'exécution — partout, toujours :
 *
 *   - `prisma/seed.ts` créait `admin@axion-ia.com` ;
 *   - le fixture Playwright retombait sur une autre adresse quand
 *     `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` manquaient, et ces deux
 *     variables n'étaient définies dans AUCUN fichier du dépôt.
 *
 * Les quatre specs concernées (`a11y-admin`, `admin-nav-clic`,
 * `admin-booking-flow`, `qualiopi/vente-parcours`) se `test.skip`aient donc
 * silencieusement. Un skip n'est pas un vert : c'est une absence de preuve.
 *
 * ⚠️ RÈGLE DE RÉDACTION — ce fichier raisonne sur des lignes de CODE
 * (déclarations `export const`, clés YAML `NOM:`), jamais sur des chaînes nues :
 * les valeurs d'avant sont citées dans les en-têtes des fichiers concernés, et
 * un contrôle qui confond une explication avec le fait qu'elle explique est un
 * contrôle faux.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const lire = (rel: string): string => readFileSync(path.join(RACINE, ...rel.split("/")), "utf8");

/** Lignes de code : commentaires de ligne et blocs de commentaire retirés. */
function codeSeul(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .filter((l) => !/^\s*(\/\/|#)/.test(l))
    .join("\n");
}

const SSOT_CHEMIN = "prisma/seeds/identifiants-admin-dev.ts";
const SSOT = codeSeul(lire(SSOT_CHEMIN));

function constanteExportee(nom: string): string {
  // Pas d'expression régulière construite dans un littéral de gabarit : `\s` y
  // est un échappement non reconnu, donc un simple `s`. Le motif ne matche alors
  // jamais — et un contrôle qui ne trouve jamais rien passe au vert sans rien
  // prouver. On lit la ligne, on prend ce qui est entre guillemets.
  const ligne = SSOT.split(/\r?\n/).find((l) => l.includes(`export const ${nom} =`));
  expect(ligne, `\`${nom}\` n'est plus exportée par ${SSOT_CHEMIN}`).toBeTypeOf("string");
  const debut = ligne!.indexOf('"');
  const fin = ligne!.lastIndexOf('"');
  expect(fin, `la valeur de \`${nom}\` n'est plus un littéral entre guillemets`).toBeGreaterThan(
    debut,
  );
  return ligne!.slice(debut + 1, fin);
}

const EMAIL = constanteExportee("ADMIN_DEV_EMAIL");
const MOT_DE_PASSE = constanteExportee("ADMIN_DEV_PASSWORD");

describe("identifiants de l'admin de développement — une seule écriture", () => {
  it("le seed Prisma les importe au lieu de les réécrire", () => {
    const seed = codeSeul(lire("prisma/seed.ts"));
    expect(
      /from\s+"\.\/seeds\/identifiants-admin-dev"/.test(seed),
      "`prisma/seed.ts` n'importe plus la source unique : la recopie peut recommencer.",
    ).toBe(true);
    expect(
      seed.includes('"' + EMAIL + '"'),
      "`prisma/seed.ts` réécrit l'adresse en dur alors qu'il importe la constante.",
    ).toBe(false);
  });

  it("le fixture Playwright les importe et n'a plus de valeur de repli inventée", () => {
    const fixture = codeSeul(lire("tests/e2e/fixtures/admin-auth.ts"));
    expect(
      /from\s+"[^"]*identifiants-admin-dev"/.test(fixture),
      "Le fixture n'importe plus la source unique.",
    ).toBe(true);
    expect(
      /ADMIN_SEED_EMAIL"\]\s*\?\?\s*"/.test(fixture),
      "Le fixture retombe sur une adresse écrite en dur. C'est exactement ce qui a " +
        "maintenu quatre specs hors d'exécution : le repli ne correspondait à aucun " +
        "compte semé, et personne ne pouvait le voir puisque l'échec se traduisait par " +
        "un `test.skip`.",
    ).toBe(false);
    expect(
      /ADMIN_SEED_PASSWORD"\]\s*\?\?\s*"/.test(fixture),
      "Même chose pour le mot de passe.",
    ).toBe(false);
  });

  it("Gate B donne à Playwright les identifiants que le seed crée réellement", () => {
    const ci = codeSeul(lire(".github/workflows/ci.yml"));

    const email = ci.match(/ADMIN_SEED_EMAIL:\s*"([^"]+)"/);
    const motDePasse = ci.match(/ADMIN_SEED_PASSWORD:\s*"([^"]+)"/);

    expect(
      email,
      "Gate B ne définit pas `ADMIN_SEED_EMAIL` : les specs de console se skipperont.",
    ).not.toBeNull();
    expect(motDePasse, "Gate B ne définit pas `ADMIN_SEED_PASSWORD`.").not.toBeNull();

    expect(
      email![1],
      "L'adresse donnée à Playwright par la CI ne correspond pas à celle que " +
        `${SSOT_CHEMIN} fait semer. Le login échouera, et l'échec se présentera comme un skip.`,
    ).toBe(EMAIL);
    expect(motDePasse![1], "Même divergence sur le mot de passe.").toBe(MOT_DE_PASSE);
  });

  it("Gate B fait tourner le serveur E2E sur une vraie base, pas sur le stub de build", () => {
    const ci = codeSeul(lire(".github/workflows/ci.yml"));
    const gateB = ci.slice(ci.indexOf("\n  gate-b:"), ci.indexOf("\n  gate-c-docker:"));

    expect(
      /image:\s*pgvector\/pgvector:pg16/.test(gateB),
      "Gate B n'a pas de service Postgres : `loginAsAdmin` ne peut pas aboutir, et les " +
        "quatre specs de console retomberont dans le silence du `test.skip`.",
    ).toBe(true);

    const urlsDeStep = [...gateB.matchAll(/^\s+DATABASE_URL:\s*"([^"]+)"/gm)].map((m) => m[1]!);
    expect(
      urlsDeStep.some((u) => !u.includes("stub.invalid")),
      "Aucune étape de Gate B ne reçoit une vraie `DATABASE_URL`. Le stub de build " +
        "court-circuite toutes les requêtes Prisma : le serveur démarrerait sans données.",
    ).toBe(true);
  });
});
