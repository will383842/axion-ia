/**
 * Un état « envoyé » se pose APRÈS l'envoi, et jamais avant.
 *
 * ## La famille
 *
 * `enqueueEmail` NE LÈVE PAS quand l'e-mail ne part pas : elle RETOURNE
 * `{ enqueued: false }`. Quatre chemins distincts y mènent — file absente,
 * adresse RETENUE par la liste de suppression, e-mail garé en corbeille de
 * validation, corbeille indisponible. Un `try/catch` autour de l'appel n'en
 * voit donc aucun, et un `await enqueueEmail(...)` NU jette la seule
 * information qui dit si quelque chose est parti.
 *
 * Le dépôt a déjà corrigé cette famille quatre fois :
 *   · 2026-08-19 `emargement/envoi-liens.ts` — `envoyes++` inconditionnel
 *     (constat `D5-3-01`) : « 8 liens envoyés » sur zéro envoi ;
 *   · 2026-08-20 les six fonctions d'envoi du cron rendent un booléen ;
 *   · 2026-08-24 `attestation-service.ts` — le huitième appelant ;
 *   · et `queue/workers/__tests__/aucun-envoi-ignore.spec.ts` garde le cron.
 *
 * ⚠️ Cette garde-là ne lit qu'UN fichier (le worker des crons) et ne surveille
 * que les fonctions `envoyerX()` — jamais `enqueueEmail` lui-même. C'est
 * pourquoi elle n'a attrapé aucun des deux cas fermés ici.
 *
 * ## Ce que ce fichier garde, et ce qu'il ne garde PAS
 *
 * Il couvre DEUX fichiers, nommément, et c'est délibéré. Une garde qui
 * exigerait de lire le retour sur les ~48 sites d'appel du dépôt rougirait
 * aussitôt sur une vingtaine d'envois légitimement sans état — une
 * confirmation de contact, un lien magique — et une gate insatisfiable se fait
 * désarmer. Le périmètre s'élargit quand les sites sont traités, pas avant :
 * seuil aligné d'abord, blocage ensuite.
 *
 * 🔴 Les deux défauts fermés ici étaient LATENTS — `confirmSentAt` n'est lu
 * nulle part dans `src/`, et le compteur de `notifyNewVersion` est jeté par son
 * unique appelant. Aucun écran ne mentait. C'est exactement la raison de cette
 * garde : un état faux qui n'est encore lu par personne est un piège armé, et
 * il se déclenchera sous les yeux de quelqu'un qui n'aura touché à rien.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Source débarrassée de ses commentaires — sinon la prose ci-dessus matcherait. */
function source(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const NEWSLETTER = ["src", "features", "newsletter", "actions.ts"];
const DOCUMENTS = ["src", "server", "intervention-documents", "notifications.ts"];

const FICHIERS: ReadonlyArray<readonly [string, string[]]> = [
  ["newsletter/actions.ts", NEWSLETTER],
  ["intervention-documents/notifications.ts", DOCUMENTS],
];

describe("un état « envoyé » suit l'envoi", () => {
  it("le témoin : les deux fichiers appellent bien enqueueEmail", () => {
    // 🔑 Sans lui, un renommage viderait les recherches et TOUT ce fichier
    // passerait au vert en ne vérifiant plus rien.
    for (const [nom, chemin] of FICHIERS) {
      expect([...source(...chemin).matchAll(/enqueueEmail\(/g)].length, nom).toBeGreaterThanOrEqual(
        1,
      );
    }
  });

  it("🔴 aucun appel à enqueueEmail n'est une instruction nue", () => {
    // Une instruction nue est un `await enqueueEmail(...)` en début
    // d'expression : la réponse n'est ni testée, ni affectée, ni retournée.
    for (const [nom, chemin] of FICHIERS) {
      const nus = source(...chemin)
        .split("\n")
        .map((l, i) => [l.trim(), i + 1] as const)
        .filter(([l]) => /^await enqueueEmail\(/.test(l));

      expect(
        nus.map(([l, n]) => `${n}: ${l}`),
        `${nom} : la réponse est jetée — l'appelant comptera comme envoyé ce qui ne l'est pas`,
      ).toEqual([]);
    }
  });

  it("🔴 la newsletter ne pose confirmSentAt qu'APRÈS l'appel d'envoi", () => {
    const src = source(...NEWSLETTER);
    const appel = src.indexOf("enqueueEmail(");
    expect(appel, "l'appel d'envoi est introuvable").toBeGreaterThan(-1);

    const poses = [...src.matchAll(/confirmSentAt:/g)].map((m) => m.index ?? -1);
    expect(poses.length, "confirmSentAt n'est plus écrit du tout").toBeGreaterThanOrEqual(1);

    // C'EST L'ASSERTION QUI ROUGIT sur la version d'avant : la colonne était
    // écrite dans les DEUX branches de l'upsert, donc bien avant l'envoi.
    const avant = poses.filter((p) => p < appel);
    expect(
      avant,
      "confirmSentAt est posé AVANT l'envoi : il affirmerait qu'une confirmation " +
        "est partie alors que la liste de suppression ou une file coupée l'ont retenue",
    ).toEqual([]);
  });

  it("🔴 la newsletter lit le verdict de l'envoi", () => {
    expect(source(...NEWSLETTER)).toMatch(/\.enqueued/);
  });

  it("🔴 le compteur de notifyNewVersion ne s'incrémente que sur un envoi réel", () => {
    const src = source(...DOCUMENTS);

    // Le compteur existe toujours — sinon l'assertion suivante serait vide.
    expect(src).toMatch(/enqueued\+\+/);

    // Chaque `enqueued++` doit être précédé, dans les lignes qui le dominent,
    // d'un test du verdict. On borne la fenêtre à la boucle courante.
    const lignes = src.split("\n");
    const idx = lignes.findIndex((l) => /enqueued\+\+/.test(l));
    const fenetre = lignes.slice(Math.max(0, idx - 6), idx).join("\n");

    expect(
      fenetre,
      "enqueued++ compte les tours de boucle, pas les mises en file — " +
        "c'est le défaut `D5-3-01`, corrigé en août dans envoi-liens.ts",
    ).toMatch(/\.enqueued/);
  });
});
