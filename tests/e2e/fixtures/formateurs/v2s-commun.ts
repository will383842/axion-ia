// Banc @formateurs, vérification n° 2 (rouge sécurité) — ce que les specs
// `v2s*` partagent côté Playwright : lancer un scénario, et reconnaître une
// donnée personnelle dans un texte rendu.

import { executerScenarioSecurite } from "./securite-execution";

export function scenarioV2<T>(
  nom: string,
  parametres: unknown = {},
  env: Readonly<Record<string, string>> = {},
): Promise<T> {
  if (!/^v2s\d{2}-[a-z0-9-]+$/.test(nom)) throw new Error(`scénario v2s mal nommé : ${nom}`);
  return executerScenarioSecurite<T>(nom, parametres, env);
}

export const RESSEMBLE_A_UN_EMAIL = /[^\s"@<>]+@[^\s"@<>]+\.[a-z]{2,}/i;
export const RESSEMBLE_A_UN_TELEPHONE = /(?:\+33|\b0)[1-9](?:[ .-]?\d{2}){4}\b/;
export const RESSEMBLE_A_UN_IBAN = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}/;
