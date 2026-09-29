/**
 * Le CIRCUIT assemblé : les gestionnaires de chaque étape et les dépendances
 * RÉELLES (base, R2, OpenAI, plafond de dépense, alertes).
 *
 * Rien n'est construit à l'import : `depsReelles()` est appelée par le worker
 * au premier job (build `stub.invalid`, `BULLMQ_DISABLED` : aucun effet).
 */

import type { EtapeVisio, PrismaClient } from "../../../prisma/generated/client";
import { chargerCatalogue } from "./catalogue-ia";
import { depotDonneesPrisma } from "./depot-donnees";
import { stockageR2, type LectureAudio } from "./stockage-audio";
import type { AlerteCircuit, DepsCircuit, Gestionnaire } from "./etapes";
import { obtenirClientOpenAI, type ClientOpenAIVisio } from "./openai/client";
import { portCoutReel, type PortCout } from "./openai/cout";
import {
  consolider,
  ebaucher,
  extraire,
  rattacher,
  rediger,
  verifierCompteRenduEtape,
  verifierFaitsEtape,
} from "./passes-ia";
import { precontroler } from "./precontroles";
import { depotEtapesPrisma } from "./prise-d-etape";
import { purgerAudio } from "./purge-audio";
import { transcrire } from "./recevoir-transcription";

export const GESTIONNAIRES: Readonly<Partial<Record<EtapeVisio, Gestionnaire>>> = {
  transcrire,
  precontroler,
  extraire,
  verifier_faits: verifierFaitsEtape,
  rattacher,
  consolider,
  ebaucher,
  rediger,
  verifier_compte_rendu: verifierCompteRenduEtape,
  purger_audio: purgerAudio,
};

/** Alerte technique : `AlerteSysteme` + dé-duplication existante (jamais une table parallèle). */
export async function alerterParLaConsole(a: AlerteCircuit): Promise<void> {
  const { creerOuDedup } = await import("@/server/qualiopi/alertes/alertes-service");
  await creerOuDedup({
    code: a.code,
    niveau: a.niveau,
    titre: a.titre,
    message: a.message,
    ...(a.rencontreId ? { cibleType: "Rencontre", cibleId: a.rencontreId } : {}),
  });
}

let arret = false;
/** Appelé au SIGTERM : les étapes en cours repassent `a_faire` sans compter. */
export function demanderArretDuCircuit(): void {
  arret = true;
}

export interface OptionsCircuit {
  readonly db: PrismaClient;
  readonly stockage?: LectureAudio;
  readonly openai?: () => ClientOpenAIVisio;
  readonly cout?: PortCout;
  readonly alerter?: (a: AlerteCircuit) => Promise<void>;
  readonly maintenant?: () => Date;
}

export function construireCircuit(o: OptionsCircuit): DepsCircuit {
  return {
    depot: depotEtapesPrisma(o.db),
    donnees: depotDonneesPrisma(o.db, o.stockage ?? stockageR2),
    openai: o.openai ?? obtenirClientOpenAI,
    cout: o.cout ?? portCoutReel,
    catalogue: chargerCatalogue,
    alerter: o.alerter ?? alerterParLaConsole,
    maintenant: o.maintenant ?? (() => new Date()),
    arretDemande: () => arret,
    gestionnaires: GESTIONNAIRES,
  };
}

/** Les dépendances de production. */
export async function depsReelles(): Promise<DepsCircuit> {
  const { prisma } = await import("@/lib/prisma");
  return construireCircuit({ db: prisma });
}
