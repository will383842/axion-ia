/**
 * CLIQUET — un report ne transporte pas le déroulé de l'ancienne session.
 *
 * ## Le défaut (BLOQUANT, 2026-08-24)
 *
 * `reportSessionAction` migrait les inscriptions vers la session de
 * remplacement en n'écrivant **qu'un seul champ** : `{ sessionId }`. Tout le
 * reste suivait — dont `convocationEnvoyeeAt`.
 *
 * Trois conséquences enchaînées, chacune vérifiée dans le code :
 *
 *   1. le cron de convocation ne sélectionne QUE les inscriptions dont la
 *      colonne est **nulle** → l'inscription migrée n'était **jamais** de
 *      nouveau candidate. Aucune convocation ne partait aux nouvelles dates.
 *   2. le compteur d'écart, qui exige la même clause, ne la rattrapait pas.
 *   3. le parcours compte `convocationEnvoyeeAt !== null` comme « convoquée »
 *      → l'écran « À traiter » affichait l'étape **FAITE**.
 *
 * Un auditeur aurait vu une session tenue aux nouvelles dates, une convocation
 * datée aux anciennes, et une console affirmant que la convocation était
 * partie. L'indicateur 9 contredit par la pièce elle-même.
 *
 * 🔑 **La règle existait à côté.** Changer les dates d'une session COMPTE les
 * convocations déjà parties pour exiger un motif écrit. Reporter la session
 * change aussi les dates, et ne s'en occupait pas. Une règle appliquée sur un
 * site, oubliée sur son jumeau — la forme récurrente de ce dépôt.
 *
 * ## Ce que ce fichier garde, et pourquoi ainsi
 *
 * Pas « les six colonnes du jour » : **la classe**. La liste des colonnes à
 * remettre à zéro est **dérivée du schéma** — toute colonne d'`Enrollment` qui
 * porte une trace datée du déroulé. Une septième colonne ajoutée demain sera
 * réclamée le jour de sa naissance, au lieu d'être oubliée comme les six l'ont
 * été.
 *
 * Une liste écrite à la main ne conviendrait pas : ce dépôt a déjà payé deux
 * fois qu'une énumération en dur prenne du retard sur ce qu'elle couvre.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lire = (...p: string[]): string => readFileSync(join(process.cwd(), ...p), "utf8");

const REPORT = lire("src", "server", "actions", "qualiopi", "sessions-recurrentes.ts");
const SCHEMA = lire("prisma", "schema.prisma");

/** Le corps du modèle `Enrollment`, tel que le schéma le déclare. */
function corpsEnrollment(): string {
  return /^model Enrollment \{([\s\S]*?)^\}/m.exec(SCHEMA)?.[1] ?? "";
}

/**
 * Les colonnes d'`Enrollment` qui portent une trace du DÉROULÉ d'une session —
 * convocation partie, émargement signé, présence constatée, attestation émise.
 *
 * Dérivées du schéma, jamais énumérées : c'est la seule forme qui vieillisse
 * bien. Le motif retient les colonnes datées (`...At`) et les mesures
 * d'exécution, en excluant ce qui appartient à l'inscription elle-même
 * (`createdAt`, `updatedAt`) et non à la session suivie.
 */
function colonnesDuDeroule(): string[] {
  const trouvees: string[] = [];
  for (const ligne of corpsEnrollment().split(/\r?\n/)) {
    const t = ligne.trim();
    if (t === "" || t.startsWith("//") || t.startsWith("///") || t.startsWith("@@")) continue;
    const nom = t.split(/\s+/)[0] ?? "";
    if (nom === "createdAt" || nom === "updatedAt") continue;
    if (
      /^(convocation|emargement|attestation|satisfaction|positionnement)\w*At$/.test(nom) ||
      nom === "tauxPresencePct" ||
      nom === "attestationResultat" ||
      nom === "attestationDocumentId"
    ) {
      trouvees.push(nom);
    }
  }
  return trouvees.sort();
}

/** Le bloc `data:` du transfert d'inscription, dans l'action de report. */
function blocDeTransfert(): string {
  const m = /tx\.enrollment\.update\(\{[\s\S]*?data:\s*\{([\s\S]*?)\},\s*\}\);/.exec(REPORT);
  return m?.[1] ?? "";
}

describe("un report ne transporte pas le déroulé de l'ancienne session", () => {
  it("le schéma porte bien des colonnes de déroulé — sinon ce cliquet garde du vide", () => {
    // Contre-témoin. Un motif cassé rendrait une liste vide, et le test suivant
    // passerait au vert sans avoir rien exigé. C'est la panne que ce dépôt a
    // payée cinq fois.
    expect(
      colonnesDuDeroule().length,
      "aucune colonne de déroulé trouvée sur `Enrollment` : le motif ne reconnaît " +
        "plus rien, et la garde ci-dessous ne garde plus rien.",
    ).toBeGreaterThanOrEqual(4);
  });

  it("le transfert d'inscription a bien été trouvé dans l'action de report", () => {
    // Second contre-témoin : si le `data:` n'est plus reconnu, l'assertion
    // principale comparerait à une chaîne vide et rougirait pour la mauvaise
    // raison. On veut savoir laquelle des deux a lâché.
    expect(
      blocDeTransfert(),
      "le bloc `data:` du `tx.enrollment.update` de `reportSessionAction` n'est " +
        "plus reconnaissable : ce cliquet ne mesure plus rien. Ajuster le motif.",
    ).toContain("sessionId");
  });

  it("TOUTE colonne de déroulé est remise à zéro au transfert", () => {
    const bloc = blocDeTransfert();
    // Comparaison SANS expression régulière, volontairement. La première
    // version écrivait \s dans un gabarit — où il ne vaut pas « espace » mais
    // la lettre `s` : le motif cherchait `…:s*null` et ne trouvait rien, donc
    // la garde rougissait en accusant des colonnes POURTANT PRÉSENTES. Une
    // garde qui rougit pour la mauvaise raison coûte autant qu'une garde qui
    // ne rougit pas. On retire l'espace et on compare des chaînes nues.
    const compact = bloc.replace(/\s+/g, "");
    const oubliees = colonnesDuDeroule().filter((c) => !compact.includes(`${c}:null`));

    expect(
      oubliees,
      "colonne(s) de déroulé transportée(s) telles quelles vers la session de " +
        "remplacement. C'est le BLOQUANT du 2026-08-24 : `convocationEnvoyeeAt` " +
        "suivait l'inscription, donc le cron ne convoquait JAMAIS aux nouvelles " +
        "dates (il filtre sur `null`) et l'écran « À traiter » affichait l'étape " +
        "faite. Un report est un acte de continuité ADMINISTRATIVE : l'inscription " +
        "suit, l'exécution non. Ajouter `<colonne>: null` au `data:` du transfert.",
    ).toEqual([]);
  });
});
