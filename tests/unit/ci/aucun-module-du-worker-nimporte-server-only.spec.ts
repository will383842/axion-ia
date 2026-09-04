import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 🔴 AUCUN MODULE ATTEIGNABLE PAR LE WORKER NE PEUT IMPORTER `server-only`.
 *
 * ## Le défaut fermé (mesuré en production le 2026-09-04, `bcc33883b`)
 *
 * `src/server/careers/rappels-entretien.ts` ouvrait par `import "server-only"`.
 * Le paquet `server-only` n'est déclaré dans AUCUN `package.json` du dépôt : il
 * ne résout QUE dans la compilation Next, qui l'alias en interne. Or le worker
 * BullMQ de production tourne `tsx src/server/queue/worker.ts` — du TypeScript
 * SOURCE, hors de Next.
 *
 * Le worker atteignait ce module par un `await import()` **dans son handler**.
 * Conséquence, et c'est ce qui rend le défaut méchant : le worker ne plante
 * pas. Il démarre, logue `ready`, et **échoue silencieusement à chaque
 * déclenchement du cron** :
 *
 *   [formation-crons-worker] failed type=formation-crons.rappels-entretien:
 *   Cannot find package 'server-only' imported from
 *   /app/src/server/careers/rappels-entretien.ts
 *
 * Trois fois en vingt minutes, pendant que `formateur-rappel-j1` passait
 * normalement juste à côté. DEUX crons étaient morts — `rappels-entretien`
 * (toutes les 5 min) et `candidatures-en-sommeil` (quotidien) — et rien ne le
 * disait : ni le déploiement, ni une alerte, ni un test.
 *
 * ## Pourquoi cette garde n'a pas de faux positif
 *
 * `server-only` a un rôle légitime : empêcher qu'un module serveur parte dans
 * un bundle client. Huit autres modules l'utilisent à bon droit — ils ne sont
 * atteints QUE par des composants Next. Cette garde ne leur dit rien.
 *
 * Elle ne parle QUE des modules atteignables depuis `src/server/queue/**`, et
 * pour ceux-là l'interdiction est structurelle, pas stylistique : sous `tsx`,
 * l'import ne peut pas résoudre. Il n'y a donc aucun cas légitime à excuser, et
 * aucune liste d'exceptions à tenir — la garde ne peut pas pourrir.
 *
 * ## Ce qu'elle suit
 *
 * La fermeture TRANSITIVE, pas seulement les imports directs : le défaut se
 * reproduirait à l'identique si un module du worker importait un module qui,
 * lui, importe `server-only`. Statiques et dynamiques (`await import(...)`).
 */

const RACINE = resolve(__dirname, "../../..");
const SRC = join(RACINE, "src");
const DEPART = join(SRC, "server/queue");

/** Tous les `.ts`/`.tsx` sous un dossier. */
function fichiersSous(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) out.push(...fichiersSous(full));
    else if (/\.tsx?$/.test(e)) out.push(full);
  }
  return out;
}

/**
 * Spécificateurs importés par un fichier — `import x from "…"`, `import "…"`,
 * `export … from "…"` et `await import("…")`.
 */
function specificateurs(source: string): string[] {
  const out: string[] = [];
  const motifs = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of motifs) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) out.push(m[1] as string);
  }
  return out;
}

/** `@/x/y` → chemin absolu du fichier, ou null si ce n'est pas un module du dépôt. */
function resoudre(spec: string): string | null {
  if (!spec.startsWith("@/")) return null;
  const base = join(SRC, spec.slice(2));
  for (const cand of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    try {
      if (statSync(cand).isFile()) return cand;
    } catch {
      /* pas ce candidat */
    }
  }
  return null;
}

/** Fermeture transitive des modules du dépôt atteignables depuis le worker. */
function atteignablesDepuisLeWorker(): Set<string> {
  const vus = new Set<string>();
  const file = fichiersSous(DEPART);
  while (file.length > 0) {
    const f = file.pop() as string;
    if (vus.has(f)) continue;
    vus.add(f);
    let source: string;
    try {
      source = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    for (const spec of specificateurs(source)) {
      const cible = resoudre(spec);
      if (cible !== null && !vus.has(cible)) file.push(cible);
    }
  }
  return vus;
}

// 🔑 ANCRÉ EN DÉBUT DE LIGNE, et ce détail est le fruit d'une erreur : la
// première version cherchait le motif n'importe où dans le fichier. Elle a
// rougi sur `src/server/chatbot/tenant.ts` — dont le COMMENTAIRE dit qu'il
// n'importe justement PAS ce paquet — et sur les deux modules qu'elle venait de
// faire corriger, pour la même raison : leur commentaire d'explication citait le
// motif. Une garde qui attrape la MENTION d'une faute au lieu de la faute est
// pire qu'absente : elle rougit sur les fichiers les mieux documentés, et on
// apprend à la désarmer.
//
// ⚠️ Et `tenant.ts` mérite d'être lu : il porte, depuis la chaîne d'ingestion
// T-05, un commentaire qui décrit EXACTEMENT ce défaut et sa cause. Le savoir
// existait donc déjà dans le dépôt — dans un fichier — et n'a empêché sa
// réapparition ni dans `rappels-entretien.ts`, ni dans `dossiers-en-sommeil.ts`.
// C'est précisément ce qu'un commentaire ne sait pas faire, et qu'une garde sait.
const IMPORTE_SERVER_ONLY = /^\s*import\s+["']server-only["']/m;

describe("🔴 le worker tourne hors de Next — `server-only` n'y résout pas", () => {
  it("aucun module atteignable depuis `src/server/queue/**` n'importe `server-only`", () => {
    const atteignables = [...atteignablesDepuisLeWorker()].sort();
    const fautifs = atteignables
      .filter((f) => IMPORTE_SERVER_ONLY.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(RACINE.length + 1).replace(/\\/g, "/"));

    expect(
      fautifs,
      `Ces modules sont atteignables par le worker BullMQ (qui tourne \`tsx\` sur le SOURCE, ` +
        `hors de Next) et importent \`server-only\`, qui n'est déclaré dans aucun package.json ` +
        `et ne résout que dans la compilation Next.\n\n` +
        `Le worker NE PLANTERA PAS : il démarrera, se déclarera \`ready\`, et le job échouera ` +
        `en silence à chaque déclenchement — exactement le défaut du 2026-09-04.\n\n` +
        `Correctif : retirer l'import. Le cloisonnement client reste assuré par le fait que ` +
        `ces modules vivent sous \`src/server/\`.\n\n` +
        `Fautifs :\n  - ${fautifs.join("\n  - ")}`,
    ).toEqual([]);
  });

  // 🔑 TÉMOIN POSITIF. Sans lui, une liste vide ne distingue pas « aucun
  // fautif » de « ma marche d'import ne parcourt rien » — un `@/` mal résolu,
  // un dossier de départ renommé, et la garde rend le vert de l'aveugle.
  it("TÉMOIN+ : la marche atteint vraiment les modules du recrutement", () => {
    const atteignables = [...atteignablesDepuisLeWorker()].map((f) =>
      f.slice(RACINE.length + 1).replace(/\\/g, "/"),
    );

    expect(atteignables.length).toBeGreaterThan(50);
    // Ces deux-là sont atteints par un `await import()` DANS un handler — le
    // cas précis que les imports directs ne verraient pas.
    expect(atteignables).toContain("src/server/careers/rappels-entretien.ts");
    expect(atteignables).toContain("src/server/careers/dossiers-en-sommeil.ts");
  });
});
