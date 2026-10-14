// Banc @formateurs (missions) — le CADRE commun d'un fichier de scénario.
//
//   const sc = cadreScenario("e13");
//   test("…", async () => { const { pilote, monde } = sc; … });
//
// Avant le fichier : le processus serveur démarre, le monde est créé, les
// interrupteurs sont pris (allumés par la console si personne ne les tient).
// Après : le monde est effacé, les interrupteurs rendus, le processus arrêté.
//
// Hors du job du banc (pas de puits SMTP, pas de file), le fichier est sauté : ces
// scénarios constatent des ENVOIS, qu'aucune autre suite ne sait voir.

import { expect, test } from "@playwright/test";

import { prisma } from "./base";
import { creerMonde, effacerMonde, type Monde } from "./missions-donnees";
import {
  prendreInterrupteurs,
  rendreInterrupteurs,
  type ConstatAllumage,
} from "./missions-interrupteurs";
import { demarrerPilote, type ContexteGeste, type Pilote } from "./missions-pilote";
import { URL_PUITS } from "./puits-smtp";

export interface CadreScenario {
  pilote: Pilote;
  monde: Monde;
  /** Constat d'allumage, si CE fichier a allumé (sinon `null`). */
  constat: ConstatAllumage | null;
  /** Contexte « console » : l'administrateur du monde est connecté. */
  console: () => ContexteGeste;
  /** Contexte « espace formateur » : ce formateur est connecté. */
  espace: (trainerId: string) => ContexteGeste;
}

/** Le worker tourne à part : on lui laisse le temps de prendre un job. */
export const ATTENTE_FILE = { timeout: 60_000, intervals: [500, 1_000, 2_000] };

export function cadreScenario(nom: string): CadreScenario {
  const cadre = {} as CadreScenario;
  test.describe.configure({ mode: "serial" });
  test.skip(
    !URL_PUITS && process.env["BANC_FORMATEURS"] !== "1",
    "hors du job banc-formateurs : ni file ni puits SMTP",
  );

  let pris = false;
  test.beforeAll(async () => {
    test.setTimeout(300_000);
    cadre.pilote = await demarrerPilote();
    cadre.monde = await creerMonde(nom);
    cadre.console = () => ({ admin: cadre.monde.admin });
    cadre.espace = (trainerId: string) => ({ formateurId: trainerId });
    cadre.constat = await prendreInterrupteurs(cadre.pilote, cadre.monde.admin);
    pris = true;
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    if (cadre.monde) await effacerMonde(cadre.monde);
    if (pris) await rendreInterrupteurs();
    if (cadre.pilote) await cadre.pilote.arreter();
    await prisma.$disconnect();
  });

  return cadre;
}

/** Les missions « vivantes » (qui tiennent la place) d'une session. */
export async function propositionsVivantes(sessionId: string) {
  return prisma.missionFormateur.findMany({
    where: { sessionId, statut: { in: ["en_attente", "acceptee", "accord_hors_outil"] } },
    select: { id: true, trainerId: true, statut: true },
  });
}

/** Jamais deux propositions vivantes sur la même session. */
export async function exigerAuPlusUneVivante(sessionId: string): Promise<void> {
  const v = await propositionsVivantes(sessionId);
  expect(v.length, `propositions vivantes : ${JSON.stringify(v)}`).toBeLessThanOrEqual(1);
}
