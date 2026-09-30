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
import { AppelInterrompu } from "./openai/erreurs";
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
import { modeEnregistrement, type ModeEnregistrement } from "./drapeau";
import { depotEtapesPrisma } from "./prise-d-etape";
import { purgerAudio } from "./purge-audio";
import { transcrire } from "./recevoir-transcription";
import {
  depotDemandesPrisma,
  envoiEmailSuiviReel,
  GESTIONNAIRES_A_LA_DEMANDE,
  type PortEnvoiEmailSuivi,
} from "./passes/etapes-a-la-demande";

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
  // PR 7 — à la demande de Will, par le même module OpenAI (coût tracé).
  ...GESTIONNAIRES_A_LA_DEMANDE,
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
let controleurArret: AbortController | null = null;

/** Le signal qui annule les appels OpenAI en vol au SIGTERM (créé au premier usage). */
function signalArret(): AbortSignal {
  controleurArret ??= new AbortController();
  if (arret) controleurArret.abort();
  return controleurArret.signal;
}

/**
 * Appelé au SIGTERM : les étapes en cours repassent `a_faire` sans compter.
 * V1 F3 : l'appel OpenAI EN VOL est annulé tout de suite (il pouvait durer
 * 120 s, la vidange n'en laisse que 25) ; il est inscrit au registre pour son
 * estimation, puis l'étape est relâchée.
 */
export function demanderArretDuCircuit(): void {
  arret = true;
  controleurArret?.abort();
}

/**
 * Le client OpenAI relié à l'arrêt du worker : chaque requête porte le
 * signal ; une requête annulée (ou demandée après l'arrêt) lève
 * `AppelInterrompu`, qui dit si elle était partie.
 */
function clientInterruptible(client: ClientOpenAIVisio, signal: AbortSignal): ClientOpenAIVisio {
  async function garder<R>(appel: () => Promise<R>): Promise<R> {
    if (signal.aborted) throw new AppelInterrompu(false);
    try {
      return await appel();
    } catch (err) {
      if (signal.aborted) throw new AppelInterrompu(true);
      throw err;
    }
  }
  return {
    transcrire: (d) => garder(() => client.transcrire({ ...d, signal })),
    repondre: (d) => garder(() => client.repondre({ ...d, signal })),
  };
}

export interface OptionsCircuit {
  readonly db: PrismaClient;
  readonly stockage?: LectureAudio;
  readonly openai?: () => ClientOpenAIVisio;
  readonly cout?: PortCout;
  readonly alerter?: (a: AlerteCircuit) => Promise<void>;
  readonly maintenant?: () => Date;
  /** PR 7 — garer l'e-mail de suivi (faux en Gate D : pas de file Redis). */
  readonly envoiEmail?: PortEnvoiEmailSuivi;
  /** PR 7 — le drapeau des étapes à la demande (lu à l'exécution sinon). */
  readonly mode?: () => ModeEnregistrement;
}

export function construireCircuit(o: OptionsCircuit): DepsCircuit {
  return {
    depot: depotEtapesPrisma(o.db),
    donnees: depotDonneesPrisma(o.db, o.stockage ?? stockageR2),
    openai: () => clientInterruptible((o.openai ?? obtenirClientOpenAI)(), signalArret()),
    cout: o.cout ?? portCoutReel,
    catalogue: chargerCatalogue,
    alerter: o.alerter ?? alerterParLaConsole,
    maintenant: o.maintenant ?? (() => new Date()),
    arretDemande: () => arret,
    gestionnaires: GESTIONNAIRES,
    demandes: {
      depot: depotDemandesPrisma(o.db),
      envoi: o.envoiEmail ?? envoiEmailSuiviReel,
      mode: o.mode ?? (() => modeEnregistrement()),
    },
  };
}

/** Les dépendances de production. */
export async function depsReelles(): Promise<DepsCircuit> {
  const { prisma } = await import("@/lib/prisma");
  return construireCircuit({ db: prisma });
}
