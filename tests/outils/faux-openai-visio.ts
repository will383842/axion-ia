/**
 * FAUX CLIENT OpenAI et FAUX PORT DE COÛT pour les tests du circuit visio.
 *
 * Aucun réseau : chaque appel est ENREGISTRÉ (paramètres complets), et la
 * réponse vient d'une file de réponses préparées. Le port de coût enregistre
 * l'ordre « plafond → appel → registre » : c'est ce que les gardes vérifient.
 */

import type {
  ClientOpenAIVisio,
  DemandeReponse,
  DemandeTranscription,
  ReponseBrute,
} from "@/server/visio/openai/client";
import type { EcritureCout, PortCout } from "@/server/visio/openai/cout";

export interface Journal {
  readonly evenements: string[];
}

export function fauxCout(
  journal: Journal = { evenements: [] },
  options: { plafondAtteint?: boolean } = {},
) {
  const verifications: number[] = [];
  const ecritures: EcritureCout[] = [];
  const port: PortCout = {
    verifierPlafond: async (estimation) => {
      journal.evenements.push("plafond");
      verifications.push(estimation);
      if (options.plafondAtteint) {
        const { ProviderError } = await import("@/server/content-gen/providers/IProvider");
        throw new ProviderError("cap", "cost_cap_reached", "openai", false);
      }
    },
    enregistrer: async (e) => {
      journal.evenements.push("registre");
      ecritures.push(e);
    },
  };
  return { port, verifications, ecritures, journal };
}

/** Une réponse Responses « réussie » portant `sortie` (sérialisée en JSON). */
export function reponseReussie(sortie: unknown, modele = "gpt-6-sol"): ReponseBrute {
  return {
    statut: "completed",
    raisonIncomplete: null,
    modele,
    texte: JSON.stringify(sortie),
    refus: null,
    jetonsEntree: 1000,
    jetonsEntreeEnCache: 200,
    jetonsSortie: 300,
  };
}

export function fauxClient(
  journal: Journal = { evenements: [] },
  reponses: {
    readonly transcriptions?: unknown[];
    readonly reponses?: Array<ReponseBrute | Error>;
  } = {},
) {
  const demandesTranscription: DemandeTranscription[] = [];
  const demandesReponse: DemandeReponse[] = [];
  const transcriptions = [...(reponses.transcriptions ?? [])];
  const rep = [...(reponses.reponses ?? [])];
  const client: ClientOpenAIVisio = {
    transcrire: async (d) => {
      journal.evenements.push("appel");
      demandesTranscription.push(d);
      const r = transcriptions.shift();
      if (r instanceof Error) throw r;
      if (r === undefined) throw new Error("faux client : aucune transcription préparée");
      return r;
    },
    repondre: async (d) => {
      journal.evenements.push("appel");
      demandesReponse.push(d);
      const r = rep.shift();
      if (r instanceof Error) throw r;
      if (r === undefined) throw new Error("faux client : aucune réponse préparée");
      return r;
    },
  };
  return { client, demandesTranscription, demandesReponse, journal };
}

/** Un client qui LÈVE à tout appel : prouve qu'OpenAI n'est jamais appelé. */
export function clientInterdit(): ClientOpenAIVisio & { appels: number } {
  const c = {
    appels: 0,
    transcrire: async () => {
      c.appels += 1;
      throw new Error("OpenAI ne devait pas être appelé");
    },
    repondre: async () => {
      c.appels += 1;
      throw new Error("OpenAI ne devait pas être appelé");
    },
  };
  return c;
}
