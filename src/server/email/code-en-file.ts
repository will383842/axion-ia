/**
 * Le code à usage unique ne traverse JAMAIS la file d'e-mails en clair (S6b, relecture
 * sécurité).
 *
 * Les données d'un job BullMQ ne restent pas dans la file : un job en échec est gardé
 * dans Redis (`removeOnFail`), affiché par le tableau des files, et ses données partent
 * chez Sentry avec l'erreur (`captureWorkerError` → `jobData`). Un code en clair dans le
 * payload sortait donc par trois portes à la première panne du relais.
 *
 * Le code est SCELLÉ à l'enfilage (AES-256-GCM, clé PII, contexte lié) et n'est ouvert
 * que par le worker, au seul moment du rendu. Clé absente : l'enfilage est refusé — jamais
 * de repli en clair. Un payload de gabarit à code dont le code n'est pas scellé est refusé
 * à l'envoi.
 */

import { GABARITS_A_CODE_UNIQUE, sansCode } from "@/lib/email/gabarits-a-code";
import { decryptPii, encryptPii } from "@/lib/pii-crypto";

const CONTEXTE = { aad: "file-email:code-a-usage-unique", cleExigee: true } as const;
const PREFIXE_SCELLE = "enc:v2:";

/** Scelle un code pour la file. Lève si la clé manque (aucun repli en clair). */
export function scellerCodePourFile(code: string): string {
  const scelle = encryptPii(code, CONTEXTE);
  if (!scelle.startsWith(PREFIXE_SCELLE)) {
    throw new Error("[code-en-file] scellement impossible : envoi refusé");
  }
  return scelle;
}

export class CodeNonScelle extends Error {
  constructor() {
    super("[code-en-file] code à usage unique absent ou non scellé : envoi refusé");
    this.name = "CodeNonScelle";
  }
}

/**
 * Pour le RENDU seulement : rend une copie du payload où `valeurs.code` est ouvert. Le
 * payload du job, lui, n'est jamais modifié. Hors gabarit à code : payload inchangé.
 */
export function payloadPourRendu(
  template: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (!GABARITS_A_CODE_UNIQUE.has(template)) return payload;
  const valeurs = payload["valeurs"];
  if (valeurs === null || typeof valeurs !== "object" || Array.isArray(valeurs)) {
    throw new CodeNonScelle();
  }
  const scelle = (valeurs as Record<string, unknown>)["code"];
  if (typeof scelle !== "string" || !scelle.startsWith(PREFIXE_SCELLE)) {
    throw new CodeNonScelle();
  }
  let code: string;
  try {
    code = decryptPii(scelle, CONTEXTE);
  } catch {
    throw new CodeNonScelle();
  }
  return { ...payload, valeurs: { ...(valeurs as Record<string, unknown>), code } };
}

/**
 * L'erreur d'un envoi à code, telle qu'elle peut être journalisée, gardée dans Redis et
 * remontée à Sentry : son message est masqué, et elle ne porte NI la pile d'origine NI
 * `cause` (un objet d'erreur du relais peut recopier l'objet du message, qui porte le code).
 */
export function erreurSansCode(err: unknown): Error {
  const brut = err instanceof Error ? err.message : String(err);
  const propre = new Error(sansCode(brut));
  propre.name = err instanceof Error && err.name ? err.name : "Error";
  propre.stack = `${propre.name}: ${propre.message}`;
  return propre;
}
