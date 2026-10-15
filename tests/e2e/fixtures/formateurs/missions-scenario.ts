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
//
// 🔑 UN fichier de scénario missions à la fois (verrou fichier, `prendreTour`).
// Plusieurs scénarios appellent des passages GLOBAUX avec l'horloge du banc avancée
// de plusieurs jours (expiration des propositions à J+2, relances jusqu'à J+21,
// moteur des lettres) : ces passages lisent TOUTES les missions de la base. Lancés
// en parallèle, ils expireraient la proposition d'un autre scénario en plein
// milieu de son parcours. Les autres specs du banc, elles, restent parallèles.

import { mkdir, open, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";

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

const VERROU = path.join(
  process.env["IMAGE_BANK_STORAGE_PATH"]
    ? path.dirname(process.env["IMAGE_BANK_STORAGE_PATH"])
    : "/tmp/banc-formateurs/stockage",
  "scenarios-missions.verrou",
);
/** Un verrou plus vieux que ceci appartient à un processus mort. */
const VERROU_PERIME_MS = 15 * 60_000;

/** Attend son tour : crée le verrou en exclusif, ou patiente tant qu'un autre le tient. */
async function prendreTour(jeton: string): Promise<void> {
  await mkdir(path.dirname(VERROU), { recursive: true });
  for (;;) {
    try {
      const f = await open(VERROU, "wx");
      await f.writeFile(jeton);
      await f.close();
      return;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      try {
        if (Date.now() - (await stat(VERROU)).mtimeMs > VERROU_PERIME_MS) await unlink(VERROU);
      } catch {
        // Rendu entre-temps : on retente.
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

/** Rend le tour — seulement s'il est bien le sien. */
async function rendreTour(jeton: string): Promise<void> {
  try {
    if ((await readFile(VERROU, "utf8")) === jeton) await unlink(VERROU);
  } catch {
    // Déjà rendu.
  }
}

export function cadreScenario(nom: string): CadreScenario {
  const cadre = {} as CadreScenario;
  test.describe.configure({ mode: "serial" });
  test.skip(
    !URL_PUITS && process.env["BANC_FORMATEURS"] !== "1",
    "hors du job banc-formateurs : ni file ni puits SMTP",
  );

  let pris = false;
  const jeton = `${process.pid}:${nom}:${Date.now()}:${Math.random()}`;
  test.beforeAll(async () => {
    // L'attente du tour compte dans ce délai : jusqu'à onze fichiers avant celui-ci.
    test.setTimeout(540_000);
    await prendreTour(jeton);
    cadre.pilote = await demarrerPilote();
    cadre.monde = await creerMonde(nom);
    cadre.console = () => ({ admin: cadre.monde.admin });
    cadre.espace = (trainerId: string) => ({ formateurId: trainerId });
    cadre.constat = await prendreInterrupteurs(cadre.pilote, cadre.monde.admin);
    pris = true;
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    try {
      if (cadre.monde) await effacerMonde(cadre.monde);
      if (pris) await rendreInterrupteurs();
      if (cadre.pilote) await cadre.pilote.arreter();
    } finally {
      await rendreTour(jeton);
      await prisma.$disconnect();
    }
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
