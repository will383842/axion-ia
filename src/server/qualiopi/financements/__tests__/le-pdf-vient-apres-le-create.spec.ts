/**
 * CLIQUET — dans un allocateur à reprise, le PDF se rend APRÈS le `create`.
 *
 * ## Le défaut (2026-08-24, cahier D9-2)
 *
 * 🔴 `facturation-service.ts` et `facturation-1to1.ts` généraient le PDF de
 * facture **à l'intérieur** de la boucle de reprise sur collision de numéro. Sur
 * un `P2002`, le tour suivant en générait un **second**, laissant le premier
 * **orphelin** au registre des pièces — portant un numéro de facture qui allait
 * être attribué à une **autre** facture.
 *
 * Sur une pièce comptable, c'est doublement faux : le registre porte une pièce
 * qui ne correspond à aucune facture, et son PDF affiche le numéro d'une autre.
 * C'est exactement le défaut « facture introuvable dans les livres, refus au
 * contrôle » que `facturation-service.ts` documente déjà pour une autre cause.
 *
 * 🔑 **Le patron correct existait déjà**, écrit et commenté « PDF APRÈS le
 * create réussi (revue C2) », dans `plan-recurrent.ts` et `facture-libre.ts`.
 * Il avait simplement été oublié sur les deux jumeaux — la forme récurrente de
 * ce dépôt : une règle appliquée à un site, oubliée sur son voisin.
 *
 * ## Pourquoi ce cliquet est DÉRIVÉ et non une liste de fichiers
 *
 * Nommer les quatre fichiers d'aujourd'hui ne dirait rien du cinquième. La règle
 * porte sur une **forme** : tout fichier qui alloue un numéro avec reprise
 * (`MAX_ATTEMPTS`) et rend un PDF doit rendre ce PDF **hors** de la boucle. Un
 * nouvel allocateur écrit demain est vu sans qu'on touche à ce fichier.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RACINE = join(process.cwd(), "src", "server", "qualiopi");

/** Les domaines qui émettent des pièces comptables numérotées. */
const DOMAINES = ["financements", "coaching-1to1"] as const;

function sourcesDe(domaine: string): string[] {
  const dossier = join(RACINE, domaine);
  return readdirSync(dossier)
    .filter((f) => f.endsWith(".ts") && !f.includes(".spec.") && !f.includes(".test."))
    .map((f) => join(dossier, f))
    .filter((f) => statSync(f).isFile());
}

/**
 * Le code seul, lignes de commentaire écartées.
 *
 * ⚠️ Indispensable : les fichiers visés **parlent** tous de `generateDocument`
 * et de reprise dans leurs commentaires — celui-ci compris. Un extracteur naïf
 * accuserait les explications au lieu du code. Ce dépôt s'est fait piéger trois
 * fois par ce motif la même journée.
 */
function codeSeul(chemin: string): string {
  return readFileSync(chemin, "utf-8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !l.startsWith("*") && !l.startsWith("//") && !l.startsWith("/*"))
    .join("\n");
}

/** Les fichiers qui allouent un numéro AVEC reprise et rendent un PDF. */
function allocateursAvecPdf(): Array<{ chemin: string; code: string }> {
  const trouves: Array<{ chemin: string; code: string }> = [];
  for (const domaine of DOMAINES) {
    for (const chemin of sourcesDe(domaine)) {
      const code = codeSeul(chemin);
      if (code.includes("MAX_ATTEMPTS") && code.includes("generateDocument(")) {
        trouves.push({ chemin, code });
      }
    }
  }
  return trouves;
}

describe("le PDF vient après le create", () => {
  it("le balayage trouve bien des allocateurs à reprise — sinon il ne garde rien", () => {
    // 🔑 CONTRE-TÉMOIN, et il porte tout le fichier. Si le balayage cessait de
    // trouver quoi que ce soit — domaine renommé, motif cassé — le test central
    // n'examinerait AUCUN fichier et passerait au vert en ne mesurant rien.
    // C'est la panne exacte que ce dépôt a payée cinq fois.
    const trouves = allocateursAvecPdf();
    expect(
      trouves.length,
      "aucun allocateur à reprise rendant un PDF n'a été trouvé : le test suivant " +
        "ne garde plus rien, et la règle « PDF après le create » n'est plus " +
        "surveillée nulle part.",
    ).toBeGreaterThanOrEqual(3);
  });

  it("🔴 aucun PDF n'est rendu À L'INTÉRIEUR d'une boucle de reprise", () => {
    // Le cœur. Un `generateDocument` entre `for (let attempt` et la fin de la
    // boucle produit une pièce par tour perdu.
    const fautifs: string[] = [];

    for (const { chemin, code } of allocateursAvecPdf()) {
      const debutBoucle = code.indexOf("for (let attempt");
      if (debutBoucle === -1) continue; // reprise par `withNumberRetry` : hors sujet

      // Fin de boucle = le garde-fou d'échec qui la suit toujours dans ce dépôt.
      const finBoucle = code.indexOf("Impossible d'allouer un numéro unique", debutBoucle);
      const borne = finBoucle === -1 ? code.length : finBoucle;

      const dansLaBoucle = code.slice(debutBoucle, borne);
      if (dansLaBoucle.includes("generateDocument(")) {
        fautifs.push(chemin.slice(RACINE.length + 1));
      }
    }

    expect(
      fautifs,
      "PDF rendu à l'intérieur de la boucle de reprise. Sur collision de numéro " +
        "(`P2002`), le tour suivant en rend un SECOND et laisse le premier " +
        "ORPHELIN au registre des pièces — avec un numéro de facture qui sera " +
        "attribué à une AUTRE facture. Le patron correct est écrit dans " +
        "`plan-recurrent.ts` et `facture-libre.ts` : rendre le PDF APRÈS le " +
        "`create` réussi, au numéro que la base a accepté, puis rattacher le " +
        "`documentId` par un `update`.",
    ).toEqual([]);
  });

  it("le contre-témoin : le motif reconnaîtrait bien un PDF dans la boucle", () => {
    // 🔑 Sans ce cas, le test central rendrait une liste vide de fautifs même si
    // son découpage ne reconnaissait plus rien.
    const faux = [
      "for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {",
      "  const docResult = await generateDocument({ type: 'facture' });",
      "}",
      "throw new Error(`Impossible d'allouer un numéro unique`);",
    ].join("\n");

    const debut = faux.indexOf("for (let attempt");
    const fin = faux.indexOf("Impossible d'allouer un numéro unique", debut);
    expect(debut, "le motif ne reconnaît plus une boucle de reprise").toBeGreaterThanOrEqual(0);
    expect(fin, "le motif ne reconnaît plus la fin de boucle").toBeGreaterThan(debut);
    expect(
      faux.slice(debut, fin).includes("generateDocument("),
      "le découpage ne voit plus un `generateDocument` pourtant placé dans la " +
        "boucle : le test central ne garde donc plus rien.",
    ).toBe(true);
  });

  it("le documentId est rattaché par un `update` après coup", () => {
    // L'autre moitié : sortir le PDF de la boucle ne suffit pas. Le `create` ne
    // peut plus porter `documentId` (le document n'existe pas encore), donc il
    // faut le rattacher ensuite — sinon la facture reste orpheline de son PDF,
    // et l'écran ne propose plus de le télécharger.
    for (const { chemin, code } of allocateursAvecPdf()) {
      if (!code.includes("for (let attempt")) continue;
      expect(
        code,
        `${chemin.slice(RACINE.length + 1)} rend le PDF hors de la boucle mais ne ` +
          `rattache jamais le \`documentId\` à la facture : la pièce existe au ` +
          `registre sans être reliée à la facture qu'elle représente.`,
      ).toMatch(/factureFormation\.update\(/);
    }
  });
});
