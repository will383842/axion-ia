/**
 * FAC-1 — Module d'envoi « monde » (squelette : interface publique d'abord).
 */
import type { EmailJobName } from "@/server/queue/types";

export type ResultatEnvoi =
  "envoye" | "en-validation" | "retenu" | "indisponible" | "fiche-retiree";

export interface ApercuRendu<G extends string = string> {
  gabarit: G;
  sujet: string;
  html: string;
  destinataire: string;
  texteDefaut?: string;
}

export type TexteParDefaut = (
  gabarit: string,
  payload: Record<string, unknown>,
) => string | null | undefined;

const AFAIRE = (): never => {
  throw new Error("FAC-1 : à implémenter");
};

export function avecTexteLibre(
  _payload: Record<string, unknown>,
  _texte: string | undefined,
): Record<string, unknown> {
  return AFAIRE();
}
export async function apercuGabarit<G extends string>(
  _e: { gabarit: G; destinataire: string; payload: Record<string, unknown> },
  _texteParDefaut: TexteParDefaut,
): Promise<ApercuRendu<G>> {
  void (null as unknown as EmailJobName);
  return AFAIRE();
}
export function resultatDeLEnfilage(_r: {
  enqueued: boolean;
  garePourValidation?: boolean;
  retenu?: boolean;
}): ResultatEnvoi {
  return AFAIRE();
}
export function jobIdSansDeuxPoints(_jobId: string | undefined): string | undefined {
  return AFAIRE();
}
export async function retirerEnvoiEchoue(_jobId: string): Promise<void> {
  AFAIRE();
}
export async function avecLienEspaceRecalcule(
  _payload: Record<string, unknown>,
  _calculer: () => Promise<string | null>,
): Promise<Record<string, unknown>> {
  return AFAIRE();
}
