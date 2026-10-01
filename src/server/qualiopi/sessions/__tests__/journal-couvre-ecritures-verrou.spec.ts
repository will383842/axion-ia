/**
 * ADR 0060 (D8) — CHAQUE ACTION « VERROU » SE RETROUVE DANS L'HISTORIQUE DU DOSSIER.
 *
 * Revue de la PR #1245 : l'historique d'une réouverture cherchait le journal
 * d'activité sur la session, ses inscriptions et ses pièces seulement. Une
 * présence corrigée (`PresenceCreneau`), un émargement révoqué
 * (`EmargementSignature`), un questionnaire saisi (`Questionnaire`), une
 * évaluation, un relevé importé ou un incident n'y figuraient pas, et le ZIP
 * écrivait « aucune au journal d'activité » au certificateur.
 *
 * Ce test lit chaque action classée `verrou` au registre, relève le
 * `targetType` de chacun de ses appels à `logQualiopiActivity`, et exige qu'il
 * soit parmi les types que l'historique recherche. Une action qui supprime sa
 * cible doit en plus porter `dossierSessionId` : son identifiant ne se
 * retrouvera plus en base.
 */

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { ecrituresDe } from "../verrou-dossier-registre";
import { CLE_DOSSIER_SESSION, TYPES_CIBLES_JOURNAL_SESSION } from "../historique-dossier";

const RACINE = join(process.cwd(), "src", "server", "actions", "qualiopi");

function corpsAction(source: string, action: string): string | null {
  const debuts = [...source.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)];
  const i = debuts.findIndex((m) => m[1] === action);
  if (i < 0) return null;
  return source.slice(debuts[i]?.index ?? 0, debuts[i + 1]?.index ?? source.length);
}

/** Le texte de chaque objet passé à `logQualiopiActivity({ … })`, accolades équilibrées. */
function appelsJournal(corps: string): string[] {
  const out: string[] = [];
  const re = /logQualiopiActivity\(\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(corps)) !== null) {
    let profondeur = 0;
    let j = m.index + m[0].length - 1;
    for (; j < corps.length; j++) {
      const c = corps[j];
      if (c === "{") profondeur++;
      else if (c === "}") {
        profondeur--;
        if (profondeur === 0) break;
      }
    }
    out.push(corps.slice(m.index, j + 1));
  }
  return out;
}

function typeCible(appel: string): string | null {
  return /targetType:\s*"([^"]+)"/.exec(appel)?.[1] ?? null;
}

function defauts(action: string, corps: string): string[] {
  const out: string[] = [];
  const supprime = /^(supprimer|delete|remove)/i.test(action);
  for (const appel of appelsJournal(corps)) {
    const type = typeCible(appel);
    if (type === null) {
      out.push(`${action} : targetType non littéral — illisible pour cette vérification`);
      continue;
    }
    if (!TYPES_CIBLES_JOURNAL_SESSION.includes(type)) {
      out.push(
        `${action} : journalise sous « ${type} », que l'historique du dossier ne cherche pas`,
      );
    }
    if (supprime && !appel.includes(CLE_DOSSIER_SESSION)) {
      out.push(`${action} : supprime sa cible sans porter « ${CLE_DOSSIER_SESSION} »`);
    }
  }
  return out;
}

describe("ADR 0060 (D8) — l'historique du dossier voit chaque action VERROU", () => {
  const verrou = ecrituresDe("verrou");

  it("témoin : l'analyse lit bien les appels au journal des actions VERROU", () => {
    const avecJournal = verrou.filter((e) => {
      const corps = corpsAction(readFileSync(join(RACINE, e.fichier), "utf-8"), e.action);
      return corps !== null && appelsJournal(corps).length > 0;
    });
    expect(avecJournal.length).toBeGreaterThan(30);
    expect(TYPES_CIBLES_JOURNAL_SESSION).toEqual(
      expect.arrayContaining([
        "PresenceCreneau",
        "EmargementSignature",
        "DocumentSignature",
        "EvaluationAcquis",
        "Questionnaire",
        "ReleveConnexionImport",
        "Incident",
      ]),
    );
  });

  it("🔴 chaque appel au journal d'une action VERROU porte un targetType recherché par l'historique", () => {
    const fautes: string[] = [];
    for (const e of verrou) {
      const corps = corpsAction(readFileSync(join(RACINE, e.fichier), "utf-8"), e.action);
      if (corps === null) {
        fautes.push(`${e.fichier}#${e.action} introuvable`);
        continue;
      }
      fautes.push(...defauts(`${e.fichier}#${e.action}`, corps));
    }
    expect(fautes).toEqual([]);
  });

  it("contre-témoin : un type inconnu et une suppression sans marqueur sont vus", () => {
    const faux = `export async function supprimerTrucAction() {
      await logQualiopiActivity({ action: "x", targetType: "Truc", targetId: id, changes: { a: { b: 1 } }, session });
    }`;
    expect(defauts("supprimerTrucAction", faux)).toEqual([
      "supprimerTrucAction : journalise sous « Truc », que l'historique du dossier ne cherche pas",
      `supprimerTrucAction : supprime sa cible sans porter « ${CLE_DOSSIER_SESSION} »`,
    ]);
  });
});
