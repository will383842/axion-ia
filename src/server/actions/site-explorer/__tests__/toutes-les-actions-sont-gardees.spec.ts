/**
 * 🔴 `D6-1-C3` — SEPT exports de ce module n'avaient AUCUNE garde.
 *
 * ## Le défaut
 *
 * Sur les treize actions de `site-routes.ts`, sept ne demandaient à personne qui
 * il était — dont `triggerScanAll()` (enfile un job BullMQ sans argument ni
 * limite), `resolveAnomaly()` (écrit en base) et `getSiteRouteDetail()` (rend
 * `adminNotes`, des notes internes).
 *
 * Les six autres, dans le MÊME fichier, appelaient `requireAdminWrite()` en
 * première ligne. Ce n'était pas un choix : c'était un oubli, sept fois, avec la
 * bonne pratique sous les yeux.
 *
 * ## Pourquoi c'est une faille et pas une négligence
 *
 * Next.js expose **chaque export** d'un module `"use server"` comme une action
 * invocable par un `POST` portant `Next-Action: <id>` — **sans cookie, sans
 * session**. Le middleware protège les *pages*, jamais les actions. Et l'image
 * de production est publique sur GHCR : le manifeste qui liste les identifiants
 * d'action se lit en la téléchargeant.
 *
 * 🔑 Une action non gardée n'est donc pas « réservée aux admins parce que seul
 * l'écran admin l'appelle ». Elle est **publique**.
 *
 * ## Portée de ce test
 *
 * ⚠️ Il couvre CE fichier, pas tout le dépôt. Une première version visait les
 * ~226 modules `"use server"` : elle produisait des faux positifs (actions
 * publiques par conception — connexion, portail stagiaire, signature par jeton —
 * et wrappers de formulaire qui délèguent à une fonction gardée). Elle a été
 * retirée plutôt que livrée approximative : **une garde fausse est pire qu'une
 * garde absente, elle rassure**. Le balayage complet reste à instruire, fichier
 * par fichier.
 *
 * Ce test garde la PRÉSENCE d'une garde, pas sa JUSTESSE — savoir si
 * `requireAdminWrite` est le bon niveau pour un acte engageant relève de la
 * matrice d'habilitation et de ses propres tests.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = join(process.cwd(), "src", "server", "actions", "site-explorer", "site-routes.ts");

/** Toute fonction qui établit QUI appelle. */
const GARDES = ["requireAdminRead", "requireAdminWrite"] as const;

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Les exports du module, avec le corps qui suit chacun. */
function exportsEtCorps(): Array<{ nom: string; corps: string }> {
  const lignes = sansCommentaires(readFileSync(SOURCE, "utf-8")).split("\n");
  const debuts = lignes
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => /^export\s+async\s+function\s+\w+/.test(l))
    .map(({ i }) => i);

  return debuts.map((debut, k) => {
    const fin = k + 1 < debuts.length ? debuts[k + 1]! : lignes.length;
    return {
      nom: /function\s+(\w+)/.exec(lignes[debut]!)?.[1] ?? "?",
      corps: lignes.slice(debut, fin).join("\n"),
    };
  });
}

describe("🔴 `D6-1-C3` — aucune action Site Explorer n'est joignable sans session", () => {
  const actions = exportsEtCorps();

  it("l'inventaire n'est pas vide", () => {
    // 🔑 Sans ceci, un renommage de fichier ou un changement de syntaxe
    // d'export viderait la liste, et le test ci-dessous passerait au vert en ne
    // vérifiant plus rien.
    expect(actions.length, "les treize actions doivent être trouvées").toBeGreaterThanOrEqual(13);
  });

  it("🔴 chaque export appelle une garde d'identité en première ligne utile", () => {
    const nus = actions
      .filter((a) => !GARDES.some((g) => a.corps.includes(`${g}(`)))
      .map((a) => a.nom);

    expect(
      nus,
      "Ces exports sont invocables par POST `Next-Action` SANS session : " + nus.join(", "),
    ).toEqual([]);
  });

  it("les actions qui ÉCRIVENT ou DÉCLENCHENT exigent le niveau write", () => {
    // ⚠️ Distinction volontaire : lire la liste des routes est une lecture
    // (`requireAdminRead`), enfiler un job ou marquer une anomalie résolue est
    // une écriture. Confondre les deux ouvrirait l'écriture à `reader`.
    const ecrivains = ["triggerInspection", "triggerScanAll", "triggerDiscovery", "resolveAnomaly"];
    for (const nom of ecrivains) {
      const a = actions.find((x) => x.nom === nom);
      expect(a, `« ${nom} » doit exister`).toBeDefined();
      expect(a!.corps, `« ${nom} » écrit ou déclenche : niveau write exigé`).toContain(
        "requireAdminWrite(",
      );
    }
  });

  it("le témoin : la lecture SAIT reconnaître un export nu", () => {
    // 🔑 La règle s'applique à elle-même. Sur un corps fabriqué sans garde, elle
    // doit le voir — sinon les tests ci-dessus ne prouvent rien de plus que
    // « le fichier existe ».
    const nu = "export async function faire() {\n  await prisma.x.update({});\n}";
    expect(GARDES.some((g) => nu.includes(`${g}(`))).toBe(false);
  });
});
