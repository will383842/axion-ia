/**
 * CLIQUET — le balayage de l'échéance de conservation doit trouver quelque chose.
 *
 * ## Ce qu'il garde, et contre quoi
 *
 * Le rapport à blanc de rétention (`scripts/qualiopi-retention-dry-run.ts`)
 * dérive sa liste de modèles du schéma Prisma. C'est la bonne façon : une liste
 * énumérée à la main prend du retard sans le dire.
 *
 * 🔴 Mais un balayage dérivé a une panne propre, et elle est silencieuse : si
 * la colonne est renommée, ou si le client Prisma généré est périmé, le filtre
 * ne trouve **plus rien** — et le rapport sort vide, propre, rassurant. Zéro
 * pièce échue : excellente nouvelle, sauf qu'on n'a rien mesuré.
 *
 * **Ce dépôt a payé cette panne exacte cinq fois.** D'où le plancher ci-dessous.
 *
 * ⚠️ Le plancher est volontairement inférieur au compte réel (4 modèles au
 * 2026-08-24 : `CoachingSeanceSignature`, `DocumentGenere`, `DocumentSignature`,
 * `EmargementSignature`). Un test qui exige le compte EXACT rougirait à chaque
 * ajout légitime de modèle et finirait par être relâché. On exige donc la
 * classe — « le balayage voit encore les pièces signées » — pas l'inventaire.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COLONNE_ECHEANCE,
  modelesAvecEcheance,
  nomDelegue,
} from "@/server/qualiopi/legal/retention-echeance";

describe("l'échéance de conservation reste mesurable", () => {
  it("le balayage trouve au moins trois modèles porteurs — sinon il ne mesure rien", () => {
    // 🔑 LE CONTRE-TÉMOIN. Sans lui, un rapport vide passerait pour un bon
    // résultat. Trois est un plancher : au 2026-08-24 il y en a quatre.
    const modeles = modelesAvecEcheance();
    expect(
      modeles.length,
      `le balayage de « ${COLONNE_ECHEANCE} » ne trouve plus que ${modeles.length} ` +
        `modèle(s) : [${modeles.join(", ")}]. Soit la colonne a été renommée sans ` +
        `propager, soit le client Prisma généré est périmé (\`pnpm prisma:generate\`). ` +
        `Dans les deux cas, le rapport à blanc de rétention rendra un résultat VIDE ` +
        `et rassurant sans avoir rien mesuré.`,
    ).toBeGreaterThanOrEqual(3);
  });

  it("les pièces qui portent la mention « 5 ans » sont bien dans le balayage", () => {
    // La mention imprimée au stagiaire concerne les documents générés et les
    // signatures. Si l'un des deux sortait du balayage, le rapport serait
    // partiel là où le texte, lui, promet toujours.
    const modeles = modelesAvecEcheance();
    for (const attendu of ["DocumentGenere", "EmargementSignature"]) {
      expect(
        modeles,
        `« ${attendu} » ne porte plus « ${COLONNE_ECHEANCE} », alors que la pièce ` +
          `correspondante porte imprimée la durée de conservation. Le rapport à blanc ` +
          `cesserait de la compter.`,
      ).toContain(attendu);
    }
  });

  it("chaque modèle dérivé a un délégué Prisma du nom attendu", () => {
    // `nomDelegue` repose sur une convention Prisma (initiale en minuscule),
    // pas sur un contrat publié. Si elle changeait, le rapport lèverait une
    // exception à l'exécution — mieux vaut le savoir ici.
    for (const modele of modelesAvecEcheance()) {
      expect(nomDelegue(modele)).toBe(modele.charAt(0).toLowerCase() + modele.slice(1));
    }
  });

  it("le rapport à blanc ne contient AUCUNE opération destructive", () => {
    // ⛔ L'invariant qui compte. Le mandat est explicite : mesurer, jamais
    // effacer. Une purge introduite ici supprimerait des pièces légales
    // signées, de façon irréversible.
    //
    // ⚠️ On analyse LIGNE PAR LIGNE en écartant les commentaires. Un test
    // statique naïf trouverait ses propres explications — le fichier parle
    // abondamment de suppression, puisque c'est son sujet. Ce dépôt s'est déjà
    // fait piéger par un extracteur qui lisait les commentaires.
    const source = readFileSync(
      join(process.cwd(), "scripts", "qualiopi-retention-dry-run.ts"),
      "utf8",
    );
    const codeSeul = source
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => !l.startsWith("*") && !l.startsWith("//") && !l.startsWith("/*"))
      .join("\n");

    const destructifs = [
      "deleteMany",
      ".delete(",
      "$executeRaw",
      "$queryRaw",
      "TRUNCATE",
      "DROP ",
      ".update(",
      "updateMany",
    ].filter((motif) => codeSeul.includes(motif));

    expect(
      destructifs,
      `opération(s) destructive(s) ou mutante(s) trouvée(s) dans le rapport à blanc : ` +
        `[${destructifs.join(", ")}]. Ce script MESURE, il n'efface pas et ne modifie ` +
        `pas. Supprimer une pièce légale signée est irréversible, et la pièce peut ` +
        `être exigée bien après cinq ans (litige prud'homal, contrôle DREETS, ` +
        `redressement d'un financeur). La purge elle-même attend un arbitrage de Will.`,
    ).toEqual([]);
  });

  it("le contre-témoin du test précédent : il reconnaîtrait bien une purge", () => {
    // 🔑 Sans ce cas, le test ci-dessus passerait au vert même si sa liste de
    // motifs était vide ou son extracteur cassé — il n'examinerait rien.
    const faux = ["const x = 1;", "await prisma.documentGenere.deleteMany({});"].join("\n");
    const codeSeul = faux
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => !l.startsWith("*") && !l.startsWith("//") && !l.startsWith("/*"))
      .join("\n");
    expect(
      ["deleteMany", ".delete(", "$executeRaw"].filter((m) => codeSeul.includes(m)),
      "l'extracteur du test précédent ne reconnaît plus une purge évidente : " +
        "il ne garde donc plus rien.",
    ).toContain("deleteMany");
  });
});
