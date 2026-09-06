/**
 * CLIQUET — le budget des pages PUBLIQUES ne doit pas se faire manger par la
 * console d'administration.
 *
 * ## Ce qui s'est passé le 2026-09-06
 *
 * Un seul bucket sommait TOUS les `page-*.js` hors `/appel`, sous le nom
 * « cliquet anti-croissance ». Sa raison d'être est le budget Web Vitals
 * d'AGENTS.md, qui porte sur les **15 pages stratégiques** — donc sur le PUBLIC.
 *
 * Mesuré en séparant les deux populations, sur le même build :
 *
 *     pages publiques        254,36 kB
 *     console admin          452,01 kB     ← 64 % du bucket
 *     ─────────────────────────────────
 *     total                  706,37 kB     (= exactement l'ancien chiffre unique)
 *
 * 🔴 **Les deux tiers d'un budget de performance publique étaient occupés par
 * des écrans authentifiés qu'aucun visiteur ne télécharge et qu'aucune mesure
 * Lighthouse ne regarde.** Le seuil unique était donc faux dans les deux sens à
 * la fois :
 *
 *   - **trop LÂCHE là où il comptait** — à 703 kB pour un public mesuré à
 *     254 kB, le paquet public pouvait presque TRIPLER sans que rien rougisse,
 *     pendant que la gate Lighthouse post-deploy, elle, échouait déjà sur la
 *     prod (run 33967996086) ;
 *   - **bloquant là où il ne comptait pas** — trois formulaires d'administration
 *     (+3,44 kB) fermaient une PR de 30 commits.
 *
 * C'est aussi ce qui explique les recalages **700 → 702 → 703 en une seule
 * journée**, par trois sessions différentes : elles livraient toutes de l'ADMIN.
 * Un seuil qu'il faut relever à chaque fonctionnalité d'admin finit en
 * formalité. Le défaut n'était pas l'indiscipline, c'était la FORME du bucket.
 *
 * ## 🔴 LE PIÈGE QUI A COÛTÉ UNE PASSE DE MESURE, ET QUI EST SILENCIEUX
 *
 * Le groupe de routes de Next s'écrit `(admin)`, avec des parenthèses. Écrites
 * NUES dans un glob, elles ne sont pas lues comme des caractères littéraux :
 *
 *     ".next/static/chunks/app/**\/(admin)/**\/page-*.js"   → 0 fichier
 *     ".next/static/chunks/app/**\/[(]admin[)]/**\/page-*.js" → 452,01 kB
 *
 * Les deux formes ont été mesurées, sur le même build, à quelques secondes
 * d'écart. La première ne trouve RIEN alors que le répertoire existe.
 *
 * ⚠️ **Et les deux erreurs n'ont pas le même bruit.** Sur un `path` d'inclusion,
 * size-limit le dit et sort en 1 (« Size Limit can't find files at … ») : on
 * l'apprend tout de suite. Sur une NÉGATION, rien n'est exclu **et rien n'est
 * dit** — le bucket public ré-avale la console admin en silence, et le budget
 * public redevient la fiction qu'on vient de retirer.
 *
 * C'est ce cas MUET que cette garde surveille. La garde voisine
 * (`size-limit-buckets.spec.ts`, « ne nomme aucune route qui n'existe plus »)
 * ne peut pas le voir : son motif ne reconnaît que `[A-Za-z0-9._-]+`, donc il
 * ne lit ni `(admin)` ni `[(]admin[)]`.
 *
 * ## 🔴 CORRECTION DU 2026-09-06 SOIR — « 0 FICHIER » N'ÉTAIT VRAI QUE D'UN SEUL DES DEUX MOTIFS
 *
 * En éprouvant `scripts/ci/bundle-check.mjs` par mutation, les deux formes ont
 * été recomptées séparément, motif par motif :
 *
 *     **\/(admin)/**\/page-*.js   → 0 fichier      (l'inclusion du bucket admin)
 *     **\/(admin)/**              → 8 fichiers     (l'EXCLUSION du bucket public)
 *
 * Les parenthèses nues ne sont pas ignorées : picomatch les lit comme un groupe,
 * donc le motif désigne le répertoire littéralement nommé `admin` — et il en
 * existe un, `chunks/app/api/admin/`, qui porte 8 chunks de route handlers.
 *
 * 🔑 **La conséquence est que « le motif ne correspond à rien » est le mauvais
 * diagnostic pour la moitié qui compte.** L'exclusion cassée trouve 8 fichiers,
 * dont aucun n'est un `page-*.js` : elle satisfait n'importe quel contrôle
 * « ≥ 1 correspondance » tout en n'excluant rien du tout. C'est pourquoi
 * `bundle-check.mjs` ne s'arrête pas là et vérifie en plus une IDENTITÉ exacte
 * — la partition des `page-*.js` entre `/appel`, public et admin.
 *
 * La présente garde, elle, reste la première ligne : elle refuse la forme nue
 * **sans build**, donc avant même qu'une mesure existe.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

/** La forme ÉCHAPPÉE, la seule qui corresponde réellement à des fichiers. */
const GROUPE_ADMIN_ECHAPPE = "[(]admin[)]";

type Bucket = { name?: string; path?: string | string[]; limit?: string };

const BUCKETS =
  (
    JSON.parse(readFileSync(join(RACINE, "package.json"), "utf8")) as {
      "size-limit"?: Bucket[];
    }
  )["size-limit"] ?? [];

function bucket(prefixeDuNom: string): Bucket {
  const trouve = BUCKETS.find((b) => (b.name ?? "").startsWith(prefixeDuNom));
  expect(trouve, `bucket « ${prefixeDuNom}… » introuvable dans package.json`).toBeDefined();
  return trouve as Bucket;
}

function globs(b: Bucket): string[] {
  return Array.isArray(b.path) ? b.path : b.path ? [b.path] : [];
}

describe("Le groupe de routes (admin) existe vraiment", () => {
  it("`src/app/[locale]/(admin)` est bien là — sinon les DEUX globs sont morts", () => {
    // Témoin de la garde elle-même : si quelqu'un renomme le groupe de routes,
    // le bucket admin s'arrêtera bruyamment, mais l'EXCLUSION du bucket public
    // deviendra muette. C'est cette seconde moitié qui est dangereuse.
    expect(
      existsSync(join(RACINE, "src", "app", "[locale]", "(admin)")),
      "le groupe de routes `(admin)` a été renommé ou déplacé : l'exclusion du " +
        "bucket public n'exclut plus rien, EN SILENCE, et le budget des pages " +
        "publiques ré-avale les 452 kB de la console d'administration.",
    ).toBe(true);
  });
});

describe("Les deux populations sont séparées, et le restent", () => {
  it("le bucket PUBLIC existe et porte un cliquet chiffré", () => {
    const b = bucket("SOMME des page chunks PUBLICS");
    expect(Number.isFinite(Number.parseFloat(b.limit ?? "")), `limite illisible : ${b.limit}`).toBe(
      true,
    );
  });

  it("le bucket ADMIN existe et porte un cliquet chiffré", () => {
    const b = bucket("SOMME des page chunks de la CONSOLE ADMIN");
    expect(Number.isFinite(Number.parseFloat(b.limit ?? "")), `limite illisible : ${b.limit}`).toBe(
      true,
    );
  });

  it("🔴 le bucket PUBLIC EXCLUT la console admin", () => {
    const publics = globs(bucket("SOMME des page chunks PUBLICS"));
    expect(
      publics.some((g) => g.startsWith("!") && g.includes(GROUPE_ADMIN_ECHAPPE)),
      "le bucket « pages publiques » n'exclut plus la console admin. Il redevient " +
        "la somme de tout, et son cliquet redevient une formalité qu'il faut " +
        "relever à chaque écran d'administration livré — c'est précisément l'état " +
        "d'où l'on sort (700 → 702 → 703 en une journée).",
    ).toBe(true);
  });

  it("🔴 les parenthèses sont ÉCHAPPÉES des deux côtés — nues, elles ne correspondent à RIEN", () => {
    const tous = [
      ...globs(bucket("SOMME des page chunks PUBLICS")),
      ...globs(bucket("SOMME des page chunks de la CONSOLE ADMIN")),
    ].filter((g) => g.toLowerCase().includes("admin"));

    // Témoin : sans cette ligne, le test passerait sur un fichier sans aucun
    // glob admin, donc sans rien prouver.
    expect(tous.length, "aucun glob ne mentionne la console admin").toBeGreaterThan(0);

    for (const g of tous) {
      expect(
        g.includes(GROUPE_ADMIN_ECHAPPE),
        `glob « ${g} » écrit le groupe de routes en parenthèses NUES. Mesuré le ` +
          "2026-09-06 sur le même build : `(admin)` trouve 0 fichier, " +
          "`[(]admin[)]` en trouve pour 452,01 kB. Sur une inclusion size-limit " +
          "s'arrête ; sur une NÉGATION il ne dit rien et n'exclut rien.",
      ).toBe(true);
    }
  });

  it("🔴 `bundle:check` passe par le contrôle de correspondance, pas par `size-limit` nu", () => {
    // `size-limit` seul ne sait pas dire qu'un motif ne désigne pas la bonne
    // population : il additionne ce qu'il trouve. Le contrôle qui le dit vit
    // dans `scripts/ci/bundle-check.mjs`, et il ne sert à rien s'il n'est pas
    // AU BOUT de la commande que la CI lance.
    const pkg = JSON.parse(readFileSync(join(RACINE, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(
      pkg.scripts?.["bundle:check"],
      "`bundle:check` est revenu à `size-limit` nu : la vérification des motifs " +
        "et la partition des `page-*.js` ne tournent plus, et une exclusion cassée " +
        "redevient muette.",
    ).toContain("scripts/ci/bundle-check.mjs");

    expect(
      existsSync(join(RACINE, "scripts", "ci", "bundle-check.mjs")),
      "`scripts/ci/bundle-check.mjs` a disparu : la commande `bundle:check` de la " +
        "CI échouerait au lancement.",
    ).toBe(true);
  });

  it("le nom du bucket admin DIT qu'il est hors budget Web Vitals", () => {
    // Sans cette mention, un lecteur pressé lira 470 kB comme une dette de
    // performance publique, et « réduira » des écrans que personne ne mesure.
    expect(bucket("SOMME des page chunks de la CONSOLE ADMIN").name).toMatch(/hors budget Web/i);
  });
});
