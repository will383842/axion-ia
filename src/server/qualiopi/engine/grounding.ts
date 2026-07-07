/**
 * Qualiopi — Formation Engine : ANCRAGE (grounding) Axion-IA.
 *
 * Module PUR (importe uniquement des données statiques pures). Produit un
 * contexte concis décrivant la posture pédagogique d'Axion-IA + sa VRAIE stack
 * d'outils IA (source unique : `src/content/stack-ia.ts`), injecté dans le
 * prompt SYSTÈME de génération de contenu (donc mis en cache par le provider
 * Anthropic → coût amorti sur tous les modules).
 *
 * But : que les exemples et exercices générés référencent les OUTILS RÉELS
 * enseignés (Claude, Copilot 365, n8n, Perplexity…) et la posture terrain
 * d'Axion-IA, au lieu de généralités hors-sol.
 *
 * ⚠️ N'injecte AUCUN chiffre/ROI (respecte l'anti-hallucination) : uniquement
 * des noms d'outils, éditeurs et pitches factuels issus du catalogue interne.
 */

import { STACK_CATEGORIES, STACK_TOOLS } from "@/content/stack-ia";

const POSTURE = [
  "CONTEXTE AXION-IA (organisme de formation à l'IA pour TPE/PME françaises) :",
  "- Posture : pragmatique et terrain — on part des tâches réelles du quotidien professionnel, pas de la théorie ni du battage médiatique.",
  "- Objectif de chaque formation : une montée en compétence immédiatement applicable, avec des livrables concrets réutilisables au poste de travail.",
  "- Les exemples et exercices DOIVENT s'appuyer sur des situations de travail réalistes et, quand c'est pertinent, sur les outils réellement enseignés ci-dessous.",
].join("\n");

/**
 * Contexte d'ancrage complet (posture + stack réelle), à concaténer au prompt
 * système. Concis pour rester peu coûteux en tokens.
 */
export function axionIaStackGrounding(): string {
  const parCategorie = STACK_CATEGORIES.map((cat) => {
    const outils = STACK_TOOLS.filter((t) => t.category === cat.id).map(
      (t) => `${t.name} (${t.vendor}) — ${t.fr.tagline}`,
    );
    if (outils.length === 0) return null;
    return `${cat.fr.eyebrow} : ${outils.join(" ; ")}`;
  }).filter((l): l is string => l !== null);

  return [POSTURE, "", "Stack IA enseignée par Axion-IA (par usage) :", ...parCategorie].join("\n");
}
