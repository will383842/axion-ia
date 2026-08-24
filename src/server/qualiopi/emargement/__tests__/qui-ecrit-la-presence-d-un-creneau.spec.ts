/**
 * CLIQUET — l'inventaire des écrivains de la présence d'un créneau.
 *
 * ## Ce que ce fichier garde, et pourquoi il ne garde pas un CAS
 *
 * 🔴 2026-08-24 — DEUX DÉFAUTS, UNE SEULE FAUTE, ET LA RÈGLE ÉTAIT DÉJÀ ÉCRITE.
 *
 * `PresenceCreneau.present` et `.dureeRealiseeMinutes` sont la preuve d'assiduité
 * de l'indicateur `off.12`. Ils alimentent, dans cet ordre :
 *
 *   `dureeRealiseeMinutes` → `recomputeTauxPresence` → `enrollment.tauxPresencePct`
 *   → `classifierPresence` → **résultat de l'attestation** et heures du
 *   **certificat de réalisation**.
 *
 * Quatre endroits les écrivent. Au 2026-08-24, deux d'entre eux le faisaient sans
 * regarder si une signature électronique vivante affirmait déjà la présence :
 *
 *   · `emargement/revocation-service.ts` — révoquer une signature retirait la
 *     preuve et **gardait son effet** : le certificat continuait de déclarer les
 *     heures. Et le geste est offert à l'auditrice elle-même
 *     (`mode-auditeur/emargement/page.tsx`).
 *   · `actions/qualiopi/presence.ts`, chemin manuel — un clic « Enregistrer »
 *     case décochée écrasait un créneau signé. La signature restait vivante et
 *     affirmait la présence, le créneau la niait.
 *
 * 🔑 LA RÈGLE EXISTAIT POURTANT, ÉCRITE ET JUSTIFIÉE, DANS LES MÊMES FICHIERS.
 * `revocation-service.ts` appliquait « plus aucune signature vivante ⇒ retomber »
 * au niveau de l'INSCRIPTION et l'avait oubliée sur le CRÉNEAU.
 * `presence.ts` portait `protegePresentiel` sur le chemin d'IMPORT — avec le
 * commentaire « une preuve d'émargement présentiel détruite en silence » — et
 * n'en avait aucun équivalent sur le chemin MANUEL.
 *
 * Corriger les deux cas sans garder la CLASSE aurait reproduit la faute au
 * cinquième écrivain. C'est l'objet de ce fichier.
 *
 * ## Pourquoi un INVENTAIRE et pas une règle sémantique
 *
 * « Tout écrivain doit lire `emargementSignatures` » n'est pas exprimable
 * statiquement sans faux positifs : `signature-service` écrit légitimement la
 * présence (il EST la preuve), `recomputeTauxPresence` re-dérive `present` d'une
 * durée, et `presence.ts:273` ne crée qu'un créneau neuf, sur lequel aucune
 * signature ne peut exister.
 *
 * On fige donc la liste, chaque entrée portant sa raison. Un écrivain nouveau
 * fait rougir : son auteur doit alors choisir explicitement entre poser la garde
 * et se justifier ici. C'est le patron déjà employé pour les buckets
 * `size-limit` (`tests/unit/ci/size-limit-buckets.spec.ts`).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RACINE_SRC = join(process.cwd(), "src");

/**
 * Les écrivains connus, et POURQUOI chacun a le droit d'écrire.
 *
 * La clé est le chemin ; la valeur, le nombre de sites d'écriture dans ce
 * fichier. Le nombre — et non la ligne — parce qu'une ligne dérive au premier
 * commentaire ajouté, alors qu'un site de plus est exactement ce qu'on cherche.
 */
const ECRIVAINS_CONNUS: ReadonlyArray<{ fichier: string; sites: number; raison: string }> = [
  {
    fichier: "src/server/qualiopi/presence/presence-service.ts",
    sites: 2,
    raison:
      "`upsertCreneau` (le helper que tous les autres appellent) et " +
      "`recomputeTauxPresence`, qui re-dérive `present` de la durée. Ce dernier " +
      "est la SOURCE de la dérivation, pas un écrivain de fait.",
  },
  {
    fichier: "src/server/actions/qualiopi/presence.ts",
    sites: 5,
    raison:
      "création d'un créneau neuf (aucune signature possible) · mise à jour du " +
      "PLAN seul (`dureePrevueMinutes`/`libelle`, jamais la présence) · grille " +
      "manuelle et correction unitaire, toutes deux GARDÉES par " +
      "`_count.emargementSignatures` · import, gardé par `protegePresentiel`.",
  },
  {
    fichier: "src/server/qualiopi/emargement/signature-service.ts",
    sites: 1,
    raison:
      "la signature EST la preuve : c'est elle qui crée la présence. Elle " +
      "s'abstient déjà sur un créneau issu d'un import (D.6313-3-1).",
  },
  {
    fichier: "src/server/qualiopi/emargement/revocation-service.ts",
    sites: 1,
    raison:
      "défait ce que la signature avait posé, et seulement quand plus aucune " +
      "signature vivante ne couvre le créneau. Même exception distancielle.",
  },
];

/** `presenceCreneau.update|upsert|updateMany|create`, ou un appel à `upsertCreneau`. */
const ECRITURE = /presenceCreneau\.(update|updateMany|upsert|create)\b|\bupsertCreneau\(/;

/**
 * ⚠️ La DECLARATION de `upsertCreneau` n'est pas une écriture — et mon premier
 * motif la comptait comme telle. Un cliquet qui s'accuse lui-même n'est pas
 * moins faux qu'un cliquet aveugle : ce dépôt a déjà payé un test statique qui
 * trouvait ses propres commentaires.
 */
const DECLARATION = new RegExp("function[ ]+upsertCreneau[ ]*[(]");

function sources(dossier: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      if (entree === "__tests__") continue;
      trouves.push(...sources(chemin));
      continue;
    }
    if (!/\.tsx?$/.test(entree)) continue;
    if (/\.(spec|test)\.tsx?$/.test(entree)) continue;
    trouves.push(chemin);
  }
  return trouves;
}

/**
 * ⚠️ Les commentaires sont RETIRÉS avant comptage. Ce fichier-ci, comme celui de
 * la révocation, cite `presenceCreneau.update(` en prose pour expliquer le
 * défaut — un cliquet qui compte ses propres explications finit par accuser de
 * la documentation. Ce dépôt l'a déjà payé.
 */
function sitesDEcriture(source: string): number {
  const sansCommentaires = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  const SAUT = new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10));
  return sansCommentaires.split(SAUT).filter((l) => ECRITURE.test(l) && !DECLARATION.test(l))
    .length;
}

function inventaireReel(): Map<string, number> {
  const trouve = new Map<string, number>();
  for (const chemin of sources(RACINE_SRC)) {
    const n = sitesDEcriture(readFileSync(chemin, "utf8"));
    if (n > 0) trouve.set(relative(process.cwd(), chemin).replace(/\\/g, "/"), n);
  }
  return trouve;
}

describe("qui écrit la présence d'un créneau", () => {
  const reel = inventaireReel();

  it("le balayage trouve bien des écritures — sinon il ne garde rien", () => {
    // Contre-témoin : un motif cassé rendrait une carte vide, et tous les tests
    // suivants passeraient au vert sans avoir mesuré une seule écriture. C'est la
    // panne exacte que ce dépôt a payée quatre fois.
    expect(
      reel.size,
      "aucune écriture de présence trouvée dans `src` : le motif `ECRITURE` ne " +
        "reconnaît plus rien, et ce cliquet ne garde plus rien",
    ).toBeGreaterThanOrEqual(4);
  });

  it("aucun écrivain NOUVEAU ne s'ajoute en silence", () => {
    const connus = new Set(ECRIVAINS_CONNUS.map((e) => e.fichier));
    const inconnus = [...reel.keys()].filter((f) => !connus.has(f));
    expect(
      inconnus,
      "fichier(s) écrivant `present` ou `dureeRealiseeMinutes` sans figurer à " +
        "l'inventaire. Ces deux colonnes sont la preuve d'assiduité de `off.12` : " +
        "elles alimentent le taux de présence, le résultat de l'attestation et " +
        "les heures du certificat de réalisation. Avant d'ajouter une entrée ici, " +
        "répondre à la question qui a produit deux défauts le 2026-08-24 : " +
        "**que fait ce code si une signature électronique VIVANTE affirme déjà la " +
        "présence de ce créneau ?** Les deux réponses admises sont « je refuse » " +
        "(grille, correction unitaire, import) et « je suis la preuve elle-même » " +
        "(signature, révocation).",
    ).toEqual([]);
  });

  it("aucun écrivain connu n'a DISPARU — l'inventaire ne se périme pas en silence", () => {
    // Symétrique du précédent : un fichier renommé sortirait de la carte réelle
    // sans que rien ne le dise, et l'inventaire décrirait un dépôt qui n'existe
    // plus. Même famille que le cliquet des budgets, qui cherchait deux de ses
    // trois aides au mauvais chemin.
    const disparus = ECRIVAINS_CONNUS.filter((e) => !reel.has(e.fichier)).map((e) => e.fichier);
    expect(
      disparus,
      "fichier(s) inventorié(s) ici mais qui n'écrivent plus la présence : " +
        "renommage, déplacement, ou suppression. Mettre l'inventaire à jour — un " +
        "inventaire faux est pire qu'une absence d'inventaire.",
    ).toEqual([]);
  });

  it("le NOMBRE de sites par fichier n'augmente pas en silence", () => {
    // Le grain fin : un écrivain de plus DANS un fichier déjà inventorié est
    // exactement la façon dont les deux défauts du 2026-08-24 sont nés — la
    // grille et l'import cohabitent dans `presence.ts`, l'un gardé, l'autre non.
    const ecarts = ECRIVAINS_CONNUS.filter((e) => (reel.get(e.fichier) ?? 0) > e.sites).map(
      (e) => `${e.fichier} — ${reel.get(e.fichier)} sites au lieu de ${e.sites}`,
    );
    expect(
      ecarts,
      "site(s) d'écriture ajouté(s) dans un fichier déjà inventorié. Poser la " +
        "garde `_count.emargementSignatures`, puis relever le compte ici en " +
        "expliquant pourquoi la nouvelle écriture est légitime.",
    ).toEqual([]);
  });

  it("les deux gardes posées le 2026-08-24 sont toujours là", () => {
    // Un cliquet d'inventaire ne dit rien du CONTENU. Ces deux assertions
    // nomment les gardes elles-mêmes : sans elles, on pourrait retirer la
    // protection sans changer le nombre de sites, et l'inventaire resterait vert.
    const grille = readFileSync(
      join(RACINE_SRC, "server", "actions", "qualiopi", "presence.ts"),
      "utf8",
    );
    // 🔴 ANCRÉ SUR LES DEUX GARDES, PAS SUR UN COMPTE. Une première version
    // exigeait « au moins 2 occurrences de `_count.emargementSignatures > 0` ».
    // Or le fichier en porte SIX — l'import en a les siennes — et retirer l'une
    // des deux nouvelles laissait le cliquet vert. Mesuré en la retirant.
    expect(
      grille,
      "la garde de la GRILLE a été retirée : un clic « Enregistrer » case " +
        "décochée peut de nouveau écraser un créneau signé électroniquement",
    ).toContain("signaturesProtegees += 1;");

    expect(
      grille,
      "la garde de la CORRECTION UNITAIRE a été retirée : elle réécrit " +
        '`present` en forçant `source: "manuel"`, et contredirait une ' +
        "signature vivante",
    ).toContain("Ce créneau porte une signature d'émargement");

    const revocation = readFileSync(
      join(RACINE_SRC, "server", "qualiopi", "emargement", "revocation-service.ts"),
      "utf8",
    );
    expect(
      revocation,
      "la révocation ne défait plus la présence : le certificat de réalisation " +
        "recommencerait à déclarer des heures qu'aucune preuve ne soutient",
    ).toMatch(/dureeRealiseeMinutes:\s*0/);
  });
});
