/**
 * Le fournisseur d'IA du rapport avant audit, tel que le WORKER l'obtient (2026-11-02).
 *
 * Volontairement NON BRANCHÉ ici : le vrai fournisseur (API Anthropic, modèles de `modeles.ts`)
 * est écrit par un autre lot. Tant qu'il ne l'est pas, un lancement aboutit proprement en
 * `erreur` avec un message lisible, sans aucun appel réseau. Le worker reçoit cette fonction par
 * injection (`traiterRapport`), ce qui permet aux tests d'y brancher un faux.
 */
import type { FournisseurIA } from "./executer";

export class FournisseurNonBranche extends Error {
  constructor() {
    super("Le fournisseur d'IA du rapport avant audit n'est pas encore branché.");
    this.name = "FournisseurNonBranche";
  }
}

export async function obtenirFournisseur(): Promise<FournisseurIA> {
  throw new FournisseurNonBranche();
}
