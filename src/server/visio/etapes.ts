/**
 * L'ENCHAÎNEMENT du circuit visio et l'EXÉCUTION d'une étape (ADR 0054-0055 ;
 * LOTS-EXECUTION PR 6).
 *
 *   transcrire → precontroler → extraire → verifier_faits → rattacher →
 *   consolider → ebaucher → rediger → verifier_compte_rendu → (à valider)
 *
 * et, à part : `purger_audio` (à la validation, au plus tard à 30 jours, et
 * tout de suite sur un refus, un retrait ou un rendez-vous qui n'en était pas
 * un).
 *
 * `executerEtape` : prise atomique (`prise-d-etape.ts`), verrou prolongé
 * toutes les 60 s, calcul HORS transaction (appels OpenAI), écriture finale
 * dans UNE transaction qui vérifie le jeton de propriété et l'absence de
 * retrait. Puis, selon la CLASSE de l'erreur :
 *
 *   passagere        reprises à +5 min, +30 min, +2 h, +6 h, +24 h, +48 h,
 *                    +72 h depuis le premier échec, puis échec définitif,
 *                    alerte et note manuelle proposée ;
 *   contenu          un essai de plus, puis échec définitif ;
 *   configuration,   l'étape est SUSPENDUE, alerte technique ; quota et
 *   quota, plafond   plafond suspendent TOUT le circuit (reprise manuelle, ou
 *                    au 1er du mois pour le plafond) ;
 *   schema_en_retard +15 min SANS compter (base pas encore migrée : le worker
 *                    atterrit ~50 min avant l'app), alerte au-delà de 2 h ;
 *   arrêt du worker  l'étape repasse `a_faire` SANS compter.
 *
 * Plafond total : 10 exécutions IMPUTÉES par étape — une prise reportée,
 * suspendue ou relâchée au SIGTERM n'est pas imputée (`executionsImputees`) ;
 * une prise perdue par un verrou expiré l'est (boucle de plantages). Aucune étape ne tourne tant qu'un
 * enregistrement de la rencontre est actif.
 */

import type { EtapeVisio } from "../../../prisma/generated/client";
import type { CatalogueIA } from "./catalogue-ia";
import type { ClientOpenAIVisio } from "./openai/client";
import { idTacheVisio, type PortCout } from "./openai/cout";
import { classerErreurOpenAI, ErreurVisio } from "./openai/erreurs";
import {
  executionsImputees,
  ResultatOrphelin,
  RetraitConstate,
  type DecisionEchec,
  type DepotEtapes,
  type EtapeTenue,
  type Suite,
  type Tx,
} from "./prise-d-etape";
import type { PortDonnees } from "./port-donnees";
import { CODES_ALERTES_CIRCUIT } from "./alertes-circuit";

/** L'ordre du circuit du compte rendu. */
export const ENCHAINEMENT = [
  "transcrire",
  "precontroler",
  "extraire",
  "verifier_faits",
  "rattacher",
  "consolider",
  "ebaucher",
  "rediger",
  "verifier_compte_rendu",
] as const satisfies readonly EtapeVisio[];

/** Étapes qui ne portent pas de compte rendu (une seule par rencontre). */
export const ETAPES_SANS_COMPTE_RENDU: ReadonlySet<EtapeVisio> = new Set([
  "transcrire",
  "precontroler",
  "extraire",
  "purger_audio",
]);

/** Reprises d'une erreur passagère, en minutes depuis le PREMIER échec (≈ 72 h). */
export const REPRISES_PASSAGERES_MIN = [5, 30, 120, 360, 1440, 2880, 4320] as const;
export const PLAFOND_EXECUTIONS = 10;
export const REPORT_SCHEMA_MIN = 15;
export const ALERTE_SCHEMA_APRES_MS = 2 * 3600_000;
export const REPORT_ENREGISTREMENT_ACTIF_MIN = 5;
export const PROLONGATION_VERROU_MS = 60_000;

/** Une alerte technique (sans parole, sans nom). */
export interface AlerteCircuit {
  readonly code: string;
  readonly niveau: "info" | "important" | "critique";
  readonly titre: string;
  readonly message: string;
  readonly rencontreId: string | null;
}

/** Tout ce dont une étape a besoin — injecté (tests, Gate D, production). */
export interface DepsCircuit {
  readonly depot: DepotEtapes;
  readonly donnees: PortDonnees;
  readonly openai: () => ClientOpenAIVisio;
  readonly cout: PortCout;
  readonly catalogue: () => Promise<CatalogueIA>;
  readonly alerter: (a: AlerteCircuit) => Promise<void>;
  readonly maintenant: () => Date;
  /** Vrai dès que le worker a reçu SIGTERM. */
  readonly arretDemande: () => boolean;
  readonly gestionnaires: Readonly<Partial<Record<EtapeVisio, Gestionnaire>>>;
}

export interface ContexteEtape {
  readonly t: EtapeTenue;
  readonly deps: DepsCircuit;
  /** `visio-<etape>-<rencontreId>-<execution>` : porté par `cost_ledger.jobId`. */
  readonly jobId: string;
  /** Lève `InterruptionArret` si le worker s'arrête (à appeler entre deux appels coûteux). */
  readonly verifierArret: () => void;
  /** Écriture intermédiaire gardée (jeton + retrait). */
  readonly ecrireEnCours: <R>(fn: (tx: Tx) => Promise<R>) => Promise<R>;
}

export interface ResultatGestionnaire {
  /** Écriture finale ; rend les étapes à programmer ensuite. */
  readonly ecrire: (tx: Tx) => Promise<readonly Suite[]>;
}

export type Gestionnaire = (ctx: ContexteEtape) => Promise<ResultatGestionnaire>;

/** Le worker s'arrête : l'étape repart `a_faire` sans compter d'essai. */
export class InterruptionArret extends Error {
  constructor() {
    super("arrêt du worker");
    this.name = "InterruptionArret";
  }
}

/** Arrêt NORMAL du circuit pour cette rencontre (piste muette, deux refus…) : échec définitif, sans reprise. */
export class ArretVisio extends Error {
  constructor(readonly code: DecisionEchec["code"] & string) {
    super(`arrêt du circuit : ${code}`);
    this.name = "ArretVisio";
  }
}

/** L'étape attend une réponse de Will (enregistrement de moins de 90 s). */
export class AttenteWill extends Error {
  constructor(readonly motif: string) {
    super(`en attente de Will : ${motif}`);
    this.name = "AttenteWill";
  }
}

function plusMinutes(d: Date, min: number): Date {
  return new Date(d.getTime() + min * 60_000);
}

/** Ce qu'il advient d'une étape après une erreur classée. Fonction PURE. */
export function decisionApresErreur(
  t: EtapeTenue,
  err: ErreurVisio,
  maintenant: Date,
): DecisionEchec {
  const base = { classe: err.classe, code: err.code } as const;
  switch (err.classe) {
    case "passagere": {
      const premier = t.premierEchecLe ?? maintenant;
      const delai = REPRISES_PASSAGERES_MIN[t.echecs];
      if (delai === undefined) {
        return {
          ...base,
          statut: "echec_definitif",
          compter: true,
          prochaineTentativeLe: null,
          premierEchecLe: premier,
        };
      }
      const prevue = plusMinutes(premier, delai);
      return {
        ...base,
        statut: "a_faire",
        compter: true,
        prochaineTentativeLe: prevue > maintenant ? prevue : plusMinutes(maintenant, 1),
        premierEchecLe: premier,
      };
    }
    case "contenu":
      return t.echecs >= 1
        ? {
            ...base,
            statut: "echec_definitif",
            compter: true,
            prochaineTentativeLe: null,
            premierEchecLe: t.premierEchecLe ?? maintenant,
          }
        : {
            ...base,
            statut: "a_faire",
            compter: true,
            prochaineTentativeLe: plusMinutes(maintenant, 5),
            premierEchecLe: maintenant,
          };
    case "schema_en_retard":
      return {
        ...base,
        statut: "a_faire",
        compter: false,
        prochaineTentativeLe: plusMinutes(maintenant, REPORT_SCHEMA_MIN),
        premierEchecLe: t.premierEchecLe ?? maintenant,
      };
    case "configuration":
    case "quota":
    case "plafond":
      return {
        ...base,
        statut: "suspendu",
        compter: false,
        prochaineTentativeLe: null,
        premierEchecLe: t.premierEchecLe ?? maintenant,
      };
  }
}

const TITRES_SUSPENSION: Readonly<Record<string, string>> = {
  configuration: "Circuit visio suspendu : configuration (clé OpenAI ou de chiffrement)",
  quota: "Circuit visio suspendu : crédit OpenAI épuisé",
  plafond: "Circuit visio suspendu : plafond de dépense OpenAI atteint",
};

export type IssueExecution =
  | "reussie"
  | "deja_prise"
  | "orphelin"
  | "retrait"
  | "relachee"
  | "reportee"
  | "a_reessayer"
  | "echec_definitif"
  | "suspendue"
  | "attente_will";

/** Exécute UNE étape (identifiée par sa ligne `traitements_visio`). */
export async function executerEtape(
  deps: DepsCircuit,
  traitementId: string,
): Promise<IssueExecution> {
  const t = await deps.depot.prendre(traitementId);
  if (t === null) return "deja_prise";
  const maintenant = deps.maintenant();

  if (executionsImputees(t) > PLAFOND_EXECUTIONS) {
    await deps.depot.echouer(t, {
      statut: "echec_definitif",
      classe: null,
      code: "inconnu",
      compter: false,
      prochaineTentativeLe: null,
      premierEchecLe: t.premierEchecLe,
    });
    await deps.alerter({
      code: CODES_ALERTES_CIRCUIT.etapeEnEchec,
      niveau: "important",
      titre: "Circuit visio : une étape a atteint 10 exécutions",
      message: `Étape « ${t.etape} » arrêtée après ${PLAFOND_EXECUTIONS} exécutions. Une note manuelle est proposée sur la page du rendez-vous.`,
      rencontreId: t.rencontreId,
    });
    return "echec_definitif";
  }

  if (await deps.donnees.enregistrementActif(t.rencontreId)) {
    await deps.depot.echouer(t, {
      statut: "a_faire",
      classe: null,
      code: null,
      compter: false,
      prochaineTentativeLe: plusMinutes(maintenant, REPORT_ENREGISTREMENT_ACTIF_MIN),
      premierEchecLe: t.premierEchecLe,
    });
    return "reportee";
  }

  const gestionnaire = deps.gestionnaires[t.etape];
  if (!gestionnaire) {
    await deps.depot.echouer(t, {
      statut: "suspendu",
      classe: "configuration",
      code: "inconnu",
      compter: false,
      prochaineTentativeLe: null,
      premierEchecLe: t.premierEchecLe,
    });
    return "suspendue";
  }

  let mainPerdue = false;
  const minuterie = setInterval(() => {
    void deps.depot.prolonger(t).then((ok) => {
      if (!ok) mainPerdue = true;
    });
  }, PROLONGATION_VERROU_MS);
  const ctx: ContexteEtape = {
    t,
    deps,
    jobId: idTacheVisio(t.etape, t.rencontreId, t.execution),
    verifierArret: () => {
      if (deps.arretDemande()) throw new InterruptionArret();
      if (mainPerdue) throw new ResultatOrphelin();
    },
    ecrireEnCours: (fn) => deps.depot.ecrireEnCours(t, fn),
  };

  try {
    const r = await gestionnaire(ctx);
    ctx.verifierArret();
    await deps.depot.terminer(t, r.ecrire);
    return "reussie";
  } catch (err) {
    return await traiterErreur(deps, t, err);
  } finally {
    clearInterval(minuterie);
  }
}

async function traiterErreur(
  deps: DepsCircuit,
  t: EtapeTenue,
  err: unknown,
): Promise<IssueExecution> {
  const maintenant = deps.maintenant();
  if (err instanceof ResultatOrphelin) return "orphelin";
  if (err instanceof RetraitConstate) return "retrait";
  if (err instanceof InterruptionArret) {
    await deps.depot.relacher(t);
    return "relachee";
  }
  if (err instanceof AttenteWill) {
    await deps.depot.echouer(t, {
      statut: "suspendu",
      classe: null,
      code: null,
      compter: false,
      prochaineTentativeLe: null,
      premierEchecLe: t.premierEchecLe,
    });
    return "attente_will";
  }
  if (err instanceof ArretVisio) {
    await deps.depot.echouer(t, {
      statut: "echec_definitif",
      classe: "contenu",
      code: err.code,
      compter: false,
      prochaineTentativeLe: null,
      premierEchecLe: t.premierEchecLe,
    });
    return "echec_definitif";
  }

  const e = classerErreurOpenAI(err);
  const d = decisionApresErreur(t, e, maintenant);
  await deps.depot.echouer(t, d);

  if (d.statut === "suspendu") {
    if (e.classe === "quota" || e.classe === "plafond")
      await deps.depot.suspendreTout(e.classe, e.code);
    await deps.alerter({
      code: CODES_ALERTES_CIRCUIT.circuitSuspendu,
      niveau: "critique",
      titre: TITRES_SUSPENSION[e.classe] ?? "Circuit visio suspendu",
      message:
        e.classe === "plafond"
          ? "Les comptes rendus reprendront au 1er du mois, ou dès que le plafond OpenAI (partagé avec la génération de contenu) sera relevé."
          : e.classe === "quota"
            ? "Rechargez le crédit OpenAI, puis cliquez « Reprendre » sur l'état du circuit."
            : `Étape « ${t.etape} » : ${e.code}. Corrigez la configuration, puis cliquez « Reprendre ».`,
      rencontreId: null,
    });
    return "suspendue";
  }
  if (d.statut === "echec_definitif") {
    await deps.alerter({
      code: CODES_ALERTES_CIRCUIT.etapeEnEchec,
      niveau: "important",
      titre: "Circuit visio : un compte rendu n'a pas pu être produit",
      message: `Étape « ${t.etape} » en échec (${e.code}). Une note manuelle est proposée sur la page du rendez-vous.`,
      rencontreId: t.rencontreId,
    });
    return "echec_definitif";
  }
  if (
    e.classe === "schema_en_retard" &&
    d.premierEchecLe !== null &&
    maintenant.getTime() - d.premierEchecLe.getTime() > ALERTE_SCHEMA_APRES_MS
  ) {
    await deps.alerter({
      code: CODES_ALERTES_CIRCUIT.schemaEnRetard,
      niveau: "critique",
      titre: "Circuit visio : la base n'est pas migrée depuis plus de 2 heures",
      message:
        "Une colonne ou une table attendue par le worker manque. Vérifier l'atterrissage de la migration.",
      rencontreId: null,
    });
  }
  return e.classe === "schema_en_retard" ? "reportee" : "a_reessayer";
}

/** La ou les étapes qui suivent `etape` dans le circuit du compte rendu. */
export function etapeSuivante(etape: EtapeVisio): EtapeVisio | null {
  const i = (ENCHAINEMENT as readonly EtapeVisio[]).indexOf(etape);
  return i < 0 || i === ENCHAINEMENT.length - 1 ? null : ENCHAINEMENT[i + 1]!;
}
