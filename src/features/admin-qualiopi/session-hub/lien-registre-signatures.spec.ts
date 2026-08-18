/**
 * Garde statique — le hub de session MÈNE au registre des signatures FILTRÉ.
 *
 * ## Le défaut
 *
 * `listerRegistreSignatures({ sessionId })` accepte un filtre par session depuis
 * sa création, et `mode-auditeur/signatures/page.tsx` le lit dans ses paramètres
 * d'URL (`filtres.session`). Pourtant, au 2026-08-17, il n'existait **aucune**
 * occurrence de `?session=` dans tout `src/app` et `src/components` : le filtre
 * n'était atteignable qu'en tapant l'URL à la main.
 *
 * Ironie du dossier : c'est le registre LUI-MÊME qui conseille, quand il se
 * tronque, de « le restreindre à une session pour obtenir une vue exhaustive ».
 * Il donnait le conseil sans donner le chemin.
 *
 * ## Ce que la garde vérifie
 *
 * Que le hub d'une session porte un lien vers
 * `…/qualiopi/mode-auditeur/signatures?session=<id>` — dans le CODE RENDU, pas
 * dans un commentaire.
 *
 * ⚠️ Les commentaires sont DÉPOUILLÉS avant la recherche. Ce dossier cite ses
 * propres identifiants en prose (chaque bloc explique le défaut qu'il corrige) :
 * sans ce dépouillement, la garde passerait au vert le jour où quelqu'un
 * supprimerait le lien en laissant le commentaire qui le décrit — c'est-à-dire
 * exactement le jour où elle devrait rougir.
 *
 * ## Si elle échoue
 *
 * Le lien a disparu du hub, ou son URL a changé. Remettre un `<Link>` vers
 * `signatures?session=<id>` à côté du bouton « Dossier d'audit de la session » —
 * ou, si la route a bougé, mettre à jour la constante ci-dessous ET vérifier que
 * le registre lit toujours le même nom de paramètre.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** Racine du dépôt : ce fichier vit dans `src/features/admin-qualiopi/session-hub`. */
const ROOT = resolve(__dirname, "../../../..");

const HUB_SESSION = join(
  ROOT,
  "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]/page.tsx",
);
const REGISTRE_SIGNATURES = join(
  ROOT,
  "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/mode-auditeur/signatures/page.tsx",
);

/**
 * Retire les commentaires JS/JSX du source.
 *
 * Les blocs de commentaire JSX (accolade, bloc, accolade) sont un cas
 * particulier des blocs classiques : la même règle les réduit, et les accolades
 * résiduelles sont sans effet sur une recherche de sous-chaîne.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

describe("le hub de session mène au registre des signatures de CETTE session", () => {
  const codeDuHub = sansCommentaires(readFileSync(HUB_SESSION, "utf8"));

  it("porte un lien vers le registre des signatures filtré par session", () => {
    expect(
      codeDuHub,
      "Le hub d'une session ne porte plus de lien vers " +
        "`mode-auditeur/signatures?session=<id>`. Le filtre par session du registre " +
        "redevient inatteignable autrement qu'en écrivant l'URL à la main.",
    ).toMatch(/qualiopi\/mode-auditeur\/signatures\?session=/);
  });

  it("passe l'identifiant de la session, pas une valeur en dur", () => {
    expect(codeDuHub).toMatch(/signatures\?session=\$\{id\}/);
  });

  it("le paramètre posé est bien celui que le registre LIT", () => {
    // Contrôle de non-vacuité : un lien `?session=` qui pointerait sur une page
    // lisant `?sessionId=` serait un lien mort silencieux — le registre
    // afficherait toutes les pièces en ayant l'air d'en filtrer.
    const codeDuRegistre = sansCommentaires(readFileSync(REGISTRE_SIGNATURES, "utf8"));
    expect(codeDuRegistre).toContain("filtres.session");
    expect(codeDuRegistre).toContain("sessionId: filtres.session");
  });
});
