/**
 * FAUX CIRCUIT : un `DepotEtapes` en mémoire aux MÊMES PRÉDICATS que le SQL de
 * `prise-d-etape.ts` (prise seulement `a_faire` et verrou libre ; écriture
 * finale seulement `en_cours` ET même `execution` ; retrait constaté = rien
 * écrit), et un assembleur de `DepsCircuit`.
 *
 * ⚠️ Ce n'est pas Postgres : la vraie atomicité est prouvée par la chaîne de
 * Gate D (`scripts/ci/gate-d-visio.ts`). Ici, on prouve que le CODE du circuit
 * se sert correctement du jeton de propriété.
 */

import type { EtapeVisio } from "../../prisma/generated/client";
import type { AlerteCircuit, DepsCircuit, Gestionnaire } from "@/server/visio/etapes";
import type { PortDonnees } from "@/server/visio/port-donnees";
import {
  ETAPES_PERMISES_APRES_RETRAIT,
  priseNonImputee,
  ResultatOrphelin,
  RetraitConstate,
  type DecisionEchec,
  type DepotEtapes,
  type EtapeTenue,
  type Suite,
  type Tx,
} from "@/server/visio/prise-d-etape";
import { fauxClient, fauxCout } from "./faux-openai-visio";
import type { CatalogueIA } from "@/server/visio/catalogue-ia";
import { construireCatalogue } from "@/server/visio/catalogue-ia";

export interface LigneEtape {
  id: string;
  rencontreId: string;
  etape: EtapeVisio;
  compteRenduId: string | null;
  statut: string;
  execution: number;
  echecs: number;
  interruptions: number;
  classeErreur: string | null;
  derniereErreur: string | null;
  prochaineTentativeLe: Date | null;
  premierEchecLe: Date | null;
  verrouJusqua: Date | null;
}

export class FauxDepot implements DepotEtapes {
  readonly lignes: LigneEtape[] = [];
  readonly ecritures: string[] = [];
  retraits = new Set<string>();
  suspensionsGlobales = 0;
  private n = 0;
  constructor(private readonly horloge: () => Date = () => new Date()) {}

  ajouter(p: Partial<LigneEtape> & { rencontreId: string; etape: EtapeVisio }): LigneEtape {
    const l: LigneEtape = {
      id: `t${++this.n}`,
      compteRenduId: null,
      statut: "a_faire",
      execution: 0,
      echecs: 0,
      interruptions: 0,
      classeErreur: null,
      derniereErreur: null,
      prochaineTentativeLe: null,
      premierEchecLe: null,
      verrouJusqua: null,
      ...p,
    };
    this.lignes.push(l);
    return l;
  }

  ligne(id: string): LigneEtape {
    const l = this.lignes.find((x) => x.id === id);
    if (!l) throw new Error(`ligne ${id} absente`);
    return l;
  }

  prendre = async (id: string): Promise<EtapeTenue | null> => {
    const l = this.lignes.find((x) => x.id === id);
    const maintenant = this.horloge();
    if (!l || l.statut !== "a_faire" || (l.verrouJusqua !== null && l.verrouJusqua > maintenant))
      return null;
    l.statut = "en_cours";
    l.execution += 1;
    l.verrouJusqua = new Date(maintenant.getTime() + 5 * 60_000);
    return {
      id: l.id,
      rencontreId: l.rencontreId,
      etape: l.etape,
      compteRenduId: l.compteRenduId,
      execution: l.execution,
      interruptions: l.interruptions,
      echecs: l.echecs,
      premierEchecLe: l.premierEchecLe,
    };
  };

  prolonger = async (t: EtapeTenue) => {
    const l = this.ligne(t.id);
    return l.statut === "en_cours" && l.execution === t.execution;
  };

  private garder(t: EtapeTenue): LigneEtape {
    const l = this.ligne(t.id);
    if (l.statut !== "en_cours" || l.execution !== t.execution) throw new ResultatOrphelin();
    if (this.retraits.has(t.rencontreId) && !ETAPES_PERMISES_APRES_RETRAIT.has(t.etape))
      throw new RetraitConstate();
    return l;
  }

  ecrireEnCours = async <R>(t: EtapeTenue, fn: (tx: Tx) => Promise<R>): Promise<R> => {
    this.garder(t);
    return fn({} as Tx);
  };

  terminer = async (t: EtapeTenue, fn: (tx: Tx) => Promise<readonly Suite[]>) => {
    const l = this.garder(t);
    const suites = await fn({} as Tx);
    l.statut = "reussie";
    l.verrouJusqua = null;
    this.ecritures.push(`${t.etape}#${t.execution}`);
    for (const s of suites) await this.planifier({ ...s, rencontreId: t.rencontreId });
    return suites;
  };

  relacher = async (t: EtapeTenue) => {
    const l = this.ligne(t.id);
    if (l.statut !== "en_cours" || l.execution !== t.execution) return;
    l.statut = "a_faire";
    l.verrouJusqua = null;
    l.interruptions += 1;
    l.derniereErreur = "interrompu_par_arret";
  };

  echouer = async (t: EtapeTenue, d: DecisionEchec) => {
    const l = this.ligne(t.id);
    if (l.statut !== "en_cours" || l.execution !== t.execution) return;
    l.statut = d.statut;
    if (d.compter) l.echecs += 1;
    if (priseNonImputee(d)) l.interruptions += 1;
    l.classeErreur = d.classe;
    l.derniereErreur = d.code;
    l.prochaineTentativeLe = d.prochaineTentativeLe;
    l.premierEchecLe = d.premierEchecLe;
    l.verrouJusqua = null;
  };

  planifier = async (s: Suite & { rencontreId: string }) => {
    const existante = this.lignes.find(
      (x) =>
        x.rencontreId === s.rencontreId &&
        x.etape === s.etape &&
        x.compteRenduId === s.compteRenduId,
    );
    if (!existante) {
      this.ajouter({
        rencontreId: s.rencontreId,
        etape: s.etape,
        compteRenduId: s.compteRenduId,
        prochaineTentativeLe: s.pasAvant ?? null,
      });
      return;
    }
    if (
      s.reinitialiser &&
      ["reussie", "echec_definitif", "annule", "suspendu"].includes(existante.statut)
    ) {
      existante.statut = "a_faire";
      existante.echecs = 0;
      existante.premierEchecLe = null;
    }
  };

  suspendreTout = async () => {
    let n = 0;
    for (const l of this.lignes) {
      if (l.statut === "a_faire") {
        l.statut = "suspendu";
        n += 1;
      }
    }
    this.suspensionsGlobales += 1;
    return n;
  };
}

export function catalogueDeTest(): CatalogueIA {
  return construireCatalogue([
    {
      ref: "OFF:AXI-OFF-001",
      intitule: "Formation générale IA — 1 jour",
      activite: "formation",
      duree: "7 h",
      effectif: "2 à 15 participants",
      typeTarif: "fixe",
    },
    {
      ref: "TIER:audit-cible-standard",
      intitule: "Audit ciblé",
      activite: "audit",
      duree: "",
      effectif: "",
      typeTarif: "a_partir_de",
    },
  ]);
}

export function depsDeTest(o: {
  depot: FauxDepot;
  gestionnaires?: Partial<Record<EtapeVisio, Gestionnaire>>;
  donnees?: Partial<PortDonnees>;
  client?: ReturnType<typeof fauxClient>["client"];
  cout?: ReturnType<typeof fauxCout>["port"];
  maintenant?: () => Date;
  arret?: () => boolean;
}): DepsCircuit & { alertes: AlerteCircuit[] } {
  const alertes: AlerteCircuit[] = [];
  const donnees = {
    enregistrementActif: async () => false,
    oppositionIa: async () => false,
    abandonnerPourOpposition: async () => undefined,
    ...(o.donnees ?? {}),
  } as PortDonnees;
  return {
    depot: o.depot,
    donnees,
    openai: () => o.client ?? fauxClient().client,
    cout: o.cout ?? fauxCout().port,
    catalogue: async () => catalogueDeTest(),
    alerter: async (a) => {
      alertes.push(a);
    },
    maintenant: o.maintenant ?? (() => new Date("2026-10-06T10:00:00Z")),
    arretDemande: o.arret ?? (() => false),
    gestionnaires: o.gestionnaires ?? {},
    alertes,
  };
}
