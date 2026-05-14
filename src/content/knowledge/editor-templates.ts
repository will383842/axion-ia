/**
 * KB V4 (Sprint KB-16) — Templates éditeur HTML par type KB.
 *
 * Chaque template = squelette HTML minimal pré-rempli avec les sections
 * recommandées pour le type (H2 + paragraphes placeholder).
 *
 * Utilisé côté admin :
 *  - Bouton « nouveau » dans `/<admin>/knowledge/new` propose template par type
 *  - Côté factory : utilisé pour prompts LLM (skeleton attendu en sortie)
 *
 * Tous les templates respectent les heuristic gates (≥ 1 H2, lien https, etc.).
 */

import type { KbType } from "../../../prisma/generated/client";

export interface EditorTemplate {
  readonly type: KbType;
  readonly label: string;
  readonly html: string;
  readonly minWordCount: number;
}

const T = (
  label: string,
  html: string,
  minWordCount: number = 300,
): { label: string; html: string; minWordCount: number } => ({
  label,
  html,
  minWordCount,
});

const TEMPLATES_BY_TYPE: Partial<
  Record<KbType, { label: string; html: string; minWordCount: number }>
> = {
  article: T(
    "Article éditorial",
    `<h2>Contexte</h2>
<p>Pourquoi ce sujet compte aujourd'hui pour les dirigeants et opérationnels.</p>
<h2>Enjeux clés</h2>
<ul><li>Premier enjeu...</li><li>Second enjeu...</li></ul>
<h2>Approche Axion-IA</h2>
<p>Comment nous abordons cette question dans nos interventions.</p>
<h2>À retenir</h2>
<p>Synthèse en 2-3 phrases actionnables.</p>`,
    600,
  ),
  case_study: T(
    "Étude de cas client",
    `<h2>Le client</h2>
<p>Secteur, taille, contexte au début de la mission.</p>
<h2>Problématique</h2>
<p>Le défi opérationnel à résoudre.</p>
<h2>Intervention Axion-IA</h2>
<p>Format, durée, livrables.</p>
<h2>Résultats mesurables</h2>
<ul><li>Indicateur 1...</li><li>Indicateur 2...</li></ul>
<h2>Citation client</h2>
<blockquote>« ... »</blockquote>`,
    700,
  ),
  faq: T(
    "FAQ — Question / Réponse",
    `<h2>Question</h2>
<p>Réponse claire en 2-3 phrases. Limiter à un seul point par FAQ pour le snippet AEO.</p>`,
    80,
  ),
  glossary_term: T(
    "Terme de glossaire",
    `<h2>Définition</h2>
<p>Définition concise du terme.</p>
<h2>Pourquoi c'est important</h2>
<p>Contexte d'usage et enjeu opérationnel.</p>`,
    150,
  ),
  guide: T(
    "Guide pas à pas",
    `<h2>Objectif</h2>
<p>Ce que cette procédure permet d'obtenir.</p>
<h2>Pré-requis</h2>
<ul><li>...</li></ul>
<h2>Étapes</h2>
<ol><li>Étape 1...</li><li>Étape 2...</li><li>Étape 3...</li></ol>
<h2>Vérification</h2>
<p>Comment valider le succès.</p>`,
    500,
  ),
  help_article: T(
    "Article d'aide produit",
    `<h2>Symptôme</h2>
<p>Description du problème rencontré.</p>
<h2>Cause probable</h2>
<p>Pourquoi ça arrive.</p>
<h2>Solution</h2>
<ol><li>...</li></ol>`,
    300,
  ),
  methodology: T(
    "Méthodologie / Doctrine",
    `<h2>Principe directeur</h2>
<p>Ce que cette méthode défend.</p>
<h2>Étapes</h2>
<ol><li>...</li></ol>
<h2>Anti-patterns</h2>
<ul><li>...</li></ul>`,
    500,
  ),
  // V4 factory types
  automation_recipe: T(
    "Recette automatisation",
    `<h2>Outils utilisés</h2>
<p>n8n / Make / Zapier...</p>
<h2>Trigger</h2>
<p>L'événement déclencheur.</p>
<h2>Actions</h2>
<ol><li>...</li></ol>
<h2>Avantages opérationnels</h2>
<ul><li>Temps économisé</li><li>Erreurs évitées</li></ul>`,
    500,
  ),
  tool_review: T(
    "Revue outil IA",
    `<h2>Présentation</h2>
<p>Description + éditeur + prix.</p>
<h2>Cas d'usage forts</h2>
<ul><li>...</li></ul>
<h2>Limites</h2>
<ul><li>...</li></ul>
<h2>Recommandation Axion-IA</h2>
<p>Quand l'adopter, quand l'éviter.</p>`,
    600,
  ),
  industry_use_case: T(
    "Cas d'usage sectoriel",
    `<h2>Le secteur</h2>
<p>Contexte économique, contraintes réglementaires.</p>
<h2>Cas d'usage IA prioritaires</h2>
<ol><li>...</li></ol>
<h2>Premiers résultats observés</h2>
<p>Métriques disponibles publiquement.</p>`,
    600,
  ),
  comparison: T(
    "Comparatif outils / approches",
    `<h2>Critères de comparaison</h2>
<ul><li>...</li></ul>
<h2>Option A</h2>
<p>Forces / faiblesses.</p>
<h2>Option B</h2>
<p>Forces / faiblesses.</p>
<h2>Verdict Axion-IA</h2>
<p>Recommandation contextuelle.</p>`,
    700,
  ),
  implementation_playbook: T(
    "Playbook implémentation",
    `<h2>Phase 0 — Cadrage</h2>
<p>...</p>
<h2>Phase 1 — Mise en place</h2>
<p>...</p>
<h2>Phase 2 — Pilote</h2>
<p>...</p>
<h2>Phase 3 — Mise à l'échelle</h2>
<p>...</p>
<h2>Risques fréquents</h2>
<ul><li>...</li></ul>`,
    800,
  ),
  prompt_pattern: T(
    "Pattern de prompt",
    `<h2>Pattern</h2>
<pre><code>Tu es {role}. Ta tâche : {tâche}. Contraintes : {liste}.</code></pre>
<h2>Quand l'utiliser</h2>
<p>...</p>
<h2>Exemples concrets</h2>
<p>...</p>`,
    150,
  ),
  roi_calculator_template: T(
    "Template calcul ROI",
    `<h2>Variables d'entrée</h2>
<ul><li>Coût horaire collaborateur : €...</li><li>Heures gagnées par semaine : ...</li></ul>
<h2>Formule</h2>
<p>ROI = (gain mensuel - coût solution) / coût solution × 100</p>
<h2>Exemple chiffré</h2>
<p>...</p>`,
    300,
  ),
  intervention_module: T(
    "Module d'intervention",
    `<h2>Public cible</h2>
<p>Dirigeants / équipes opérationnelles / experts métier.</p>
<h2>Objectifs pédagogiques</h2>
<ul><li>...</li></ul>
<h2>Déroulé</h2>
<ol><li>...</li></ol>
<h2>Livrables</h2>
<p>...</p>`,
    400,
  ),
  competence_boost: T(
    "Boost de compétence (micro-contenu)",
    `<h2>Compétence visée</h2>
<p>1 phrase actionnable.</p>
<h2>Astuce concrète</h2>
<p>...</p>`,
    100,
  ),
  secteur_brief: T(
    "Brief sectoriel",
    `<h2>Le secteur en chiffres</h2>
<ul><li>...</li></ul>
<h2>Tendances IA 2026</h2>
<p>...</p>
<h2>Axion-IA dans ce secteur</h2>
<p>...</p>`,
    400,
  ),
  dept_brief: T(
    "Brief département",
    `<h2>Contexte économique du département</h2>
<p>...</p>
<h2>Tissu PME / ETI</h2>
<p>...</p>
<h2>Présence Axion-IA</h2>
<p>...</p>`,
    400,
  ),
  metier_brief: T(
    "Brief métier",
    `<h2>Le métier</h2>
<p>Description rôle et missions.</p>
<h2>Tâches automatisables</h2>
<ul><li>...</li></ul>
<h2>Axion-IA pour ce métier</h2>
<p>...</p>`,
    400,
  ),
};

const FALLBACK_TEMPLATE = T(
  "Article générique",
  `<h2>Section principale</h2>
<p>Rédiger le contenu ici. Inclure au moins un H2 et un lien https vers une source crédible.</p>`,
  300,
);

export function getTemplateForType(type: KbType): EditorTemplate {
  const t = TEMPLATES_BY_TYPE[type] ?? FALLBACK_TEMPLATE;
  return { type, label: t.label, html: t.html, minWordCount: t.minWordCount };
}

export function getAllTemplates(): readonly EditorTemplate[] {
  return Object.entries(TEMPLATES_BY_TYPE).map(([type, tpl]) => ({
    type: type as KbType,
    label: tpl!.label,
    html: tpl!.html,
    minWordCount: tpl!.minWordCount,
  }));
}
