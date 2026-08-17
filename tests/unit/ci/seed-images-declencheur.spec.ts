// @vitest-environment node
//
// Environnement `node` : lecture de fichiers du dépôt.

/**
 * Verrou GEO-089 (volet déclenchement) — le seed de la banque d'images ne
 * partait plus. L'audit du 2026-08-14 relevait « 24 exécutions, toutes en mai
 * 2026 » sans en donner la cause.
 *
 * ## Cause racine, tracée le 2026-08-16
 *
 * Le job exigeait `github.event.workflow_run.conclusion == 'success'` — la
 * conclusion du **workflow de déploiement ENTIER**. Or ce workflow ne fait pas
 * que déployer : il enchaîne un gate Lighthouse, un ping IndexNow, un sweep de
 * chauffe. Et son job `build` porte `cancel-in-progress: true`.
 *
 * Deux conséquences, toutes deux observées :
 *
 *  - une compilation annulée par la suivante → conclusion `cancelled` → seed
 *    sauté (16 compilations annulées pour 3 réussies le 2026-08-16) ;
 *  - un gate Lighthouse rouge → conclusion `failure` → seed sauté, **alors que
 *    le déploiement, lui, a réussi**.
 *
 * 🔑 Le seed dépend d'UNE chose : que le conteneur tourne la nouvelle image.
 * C'est le job `deploy` qui l'établit. Le coupler au verdict d'un gate de
 * qualité indépendant, c'est éteindre tout le pipeline image à la première
 * régression Web Vitals — sans que personne ne fasse le lien.
 *
 * ## Ce que cette garde protège
 *
 * Le nom du job interrogé est une chaîne, écrite dans un fichier, comparée à un
 * `name:` défini dans un AUTRE fichier. Rien dans YAML ne relie les deux. Un
 * renommage anodin refermerait la porte **en silence** — c'est-à-dire
 * exactement le défaut qu'on répare. D'où une garde inter-fichiers.
 *
 * (Piège payé en écrivant ce correctif : le premier filtre cherchait un job
 * commençant par « Deploy ». Le job s'appelle « Trigger Coolify deploy ». Le
 * filtre n'aurait jamais rien trouvé.)
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const SEED = readFileSync(join(RACINE, ".github/workflows/image-bank-seed.yml"), "utf8");
const DEPLOY = readFileSync(join(RACINE, ".github/workflows/deploy-coolify.yml"), "utf8");

/** Extrait le `name:` du job `deploy:` de deploy-coolify.yml. */
function nomDuJobDeploy(): string | null {
  const m = /^ {2}deploy:\s*\n(?:\s+#[^\n]*\n)*\s+name:\s*(.+)$/m.exec(DEPLOY);
  return m?.[1]?.trim().replace(/^["']|["']$/g, "") ?? null;
}

describe("GEO-089 — le seed se déclenche sur le JOB deploy, pas sur le workflow", () => {
  it("🔴 la condition ne dépend plus de la conclusion du workflow entier", () => {
    // 🔑 On cherche la condition dans une clause `if:` EXECUTABLE, pas n'importe
    // ou dans le fichier. Le premier jet de ce test cherchait la chaine partout
    // et rougissait sur... le commentaire qui EXPLIQUE le defaut corrige. Un
    // test statique qui trouve ses propres commentaires punit la documentation.
    const lignesActives = SEED.split("\n").filter((l) => !/^\s*#/.test(l));
    const enFaute = lignesActives.filter((l) => l.includes("workflow_run.conclusion == 'success'"));
    expect(
      enFaute,
      "revenir a la conclusion du workflow entier reeteint le seed des qu'un " +
        "gate Lighthouse rougit ou qu'une compilation est annulee",
    ).toEqual([]);
  });

  it("🔴 il existe une porte qui interroge la conclusion d'un job précis", () => {
    expect(SEED).toContain("actions/runs/${RUN_ID}/jobs");
    expect(SEED).toMatch(/needs\.porte\.outputs\.lancer == 'true'/);
  });

  it("🔴 le nom de job interrogé est EXACTEMENT celui déclaré dans le workflow de déploiement", () => {
    // 🔑 Le coeur de la garde : rien dans YAML ne relie ces deux fichiers.
    const nom = nomDuJobDeploy();
    expect(nom, "job `deploy` introuvable dans deploy-coolify.yml").toBeTruthy();
    expect(
      SEED.includes(`select(.name == "${nom}")`),
      `le filtre du seed doit viser le job nomme « ${nom} » ; un filtre ` +
        "approximatif refermerait la porte en silence",
    ).toBe(true);
  });

  it("la permission `actions: read` est déclarée, sans quoi l'API répond 403", () => {
    // Sans elle, la porte resterait fermee — c'est-a-dire le defaut repare.
    expect(SEED).toMatch(/^permissions:[\s\S]{0,600}?^\s{2}actions:\s*read\s*$/m);
  });

  it("un déclenchement manuel reste possible sans passer par la porte", () => {
    expect(SEED).toContain("workflow_dispatch");
    expect(SEED).toMatch(/EVENEMENT.*=.*"workflow_dispatch"|workflow_dispatch"\s*\]/);
  });
});

describe("GEO-093 — le seed ne déclare pas de miniature inexistante", () => {
  const SCRIPT = readFileSync(join(RACINE, "scripts/seed-images.cjs"), "utf8");

  it("🔴 `thumbnailPath` passe par le contrôle d'existence", () => {
    // Mesure du 2026-08-16 : 72 des 133 slugs seedes n'ont AUCUN fichier
    // `-thumb.webp`. Declarer une URL morte est pire que ne rien declarer : la
    // colonne est nullable et les consommateurs retombent sur `filePath`.
    const brut = SCRIPT.match(/thumbnailPath:\s*`images\//g) ?? [];
    expect(brut.length, "un `thumbnailPath` ecrit en dur redonne des miniatures en 404").toBe(0);
    expect((SCRIPT.match(/thumbnailPath:\s*cheminSiPresent\(/g) ?? []).length).toBeGreaterThan(0);
  });

  it("le contrôle est fail-soft hors conteneur", () => {
    // Si la racine publique est introuvable, on garde le chemin plutot que de
    // tout passer a `null` : mieux vaut l'etat actuel qu'une regression massive
    // due a un environnement inattendu.
    expect(SCRIPT).toMatch(/if \(!fs\.existsSync\(RACINE_PUBLIC\)\) return relatif;/);
  });
});
