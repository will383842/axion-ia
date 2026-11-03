/**
 * Le fournisseur d'IA du rapport avant audit, tel que le WORKER l'obtient.
 *
 * Les clés sont lues directement dans `process.env` AU MOMENT DE L'APPEL (pas via `src/env.ts` :
 * le worker ne passe pas par la validation). Ordre : RAPPORT_ANTHROPIC_KEY_1, _2, _3 ; les vides
 * et les doublons sont ignorés. Aucune clé n'est jamais journalisée ni mise dans un message.
 * ANTHROPIC_API_KEY est réservée à d'autres usages et n'est volontairement pas lue ici.
 */
import type { FournisseurIA } from "./executer";
import { creerFournisseurAnthropic } from "./fournisseur/anthropic";

export class FournisseurNonBranche extends Error {
  constructor() {
    super(
      "Aucune clé Anthropic n'est posée pour le rapport avant audit (RAPPORT_ANTHROPIC_KEY_1).",
    );
    this.name = "FournisseurNonBranche";
  }
}

const NOMS_DES_CLES = [
  "RAPPORT_ANTHROPIC_KEY_1",
  "RAPPORT_ANTHROPIC_KEY_2",
  "RAPPORT_ANTHROPIC_KEY_3",
] as const;

function lireCles(): string[] {
  const cles: string[] = [];
  for (const nom of NOMS_DES_CLES) {
    const valeur = process.env[nom]?.trim();
    if (valeur && !cles.includes(valeur)) cles.push(valeur);
  }
  return cles;
}

export async function obtenirFournisseur(): Promise<FournisseurIA> {
  const cles = lireCles();
  if (cles.length === 0) throw new FournisseurNonBranche();
  return creerFournisseurAnthropic({ cles });
}
