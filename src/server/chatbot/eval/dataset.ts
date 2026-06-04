// Jeu d'évaluation chatbot (T-24, T-42, REQ-073) — fixture de référence.
//
// Basé sur 11-JEU-EVAL-50QR.md. Deux volets vérifiables en CI SANS LLM ni DB :
//  1. ROUTAGE D'INTENTION (déterministe via slot-filling) — la majorité du
//     parcours vendeur dépend du bon aiguillage rdv/lead/recherche/hors-sujet.
//  2. ANTI-HALLUCINATION (output-guard) — prix/URL inventés bloqués, vrais passés.
//
// Le volet « exactitude RAG » (RÉPONSE depuis la KB) nécessite retrieval+LLM →
// hors de cette éval CI (jouée en smoke runtime). Rejouer à chaque modif
// knowledge/prompt ; éval en baisse ⇒ rollback (REQ-077).

import type { ChatIntent } from "@/server/chatbot/catalog/slot-filling";

export interface IntentEvalItem {
  readonly id: string;
  readonly question: string;
  readonly expected: ChatIntent;
}

/** Items dont l'intention est déterministe (aiguillage du parcours). */
export const INTENT_EVAL: ReadonlyArray<IntentEvalItem> = [
  // Prise de RDV
  { id: "E-30", question: "Je voudrais prendre rendez-vous", expected: "rdv" },
  { id: "E-30b", question: "Peut-on réserver un créneau pour échanger ?", expected: "rdv" },
  { id: "E-31", question: "J'aimerais un rendez-vous de découverte", expected: "rdv" },
  // Capture lead
  { id: "E-33", question: "Voici mon email, rappelez-moi", expected: "lead" },
  {
    id: "E-33b",
    question: "Je vous laisse mes coordonnées pour être recontacté",
    expected: "lead",
  },
  // Recadrage hors-sujet
  { id: "E-HS1", question: "Quelle est la capitale de l'Australie ?", expected: "hors_sujet" },
  { id: "E-HS2", question: "Raconte-moi une blague", expected: "hors_sujet" },
  { id: "E-HS3", question: "Quelle est la météo demain à Paris ?", expected: "hors_sujet" },
  // Recherche d'offre par critères (catalogue)
  {
    id: "E-12",
    question: "Quelles formations entre 2000 et 3000 € ?",
    expected: "recherche_offre",
  },
  { id: "E-RO2", question: "Quelle est votre offre la moins chère ?", expected: "recherche_offre" },
  {
    id: "E-RO3",
    question: "Une formation de 2 jours pour 8 personnes",
    expected: "recherche_offre",
  },
  // Comparaison
  {
    id: "E-CMP1",
    question: "Quelle différence entre l'audit et l'implémentation ?",
    expected: "comparaison",
  },
  {
    id: "E-CMP2",
    question: "Audit ou formation, que choisir pour démarrer ?",
    expected: "comparaison",
  },
  // Explication (RAG) — formulations explicites captées par le classifieur déterministe.
  { id: "E-03", question: "C'est quoi un audit flash ?", expected: "explication" },
  {
    id: "E-18",
    question: "Comment se déroule une mission d'implémentation ?",
    expected: "explication",
  },
  {
    id: "E-EX3",
    question: "En quoi consiste un accompagnement un-à-un ?",
    expected: "explication",
  },
  // NB (T-18) : les questions business GÉNÉRALES sans marqueur explicite (« Que
  // propose Axion-IA ? », « Mes données sont-elles protégées ? ») tombent en
  // hors_sujet (recadrage) avec le classifieur DÉTERMINISTE — limite assumée,
  // levée par le classifieur LLM léger (T-18). Non incluses ici pour garder une
  // éval de régression nette du déterministe.
];

export interface GuardEvalItem {
  readonly id: string;
  readonly text: string;
  /** true = la sortie DOIT être bloquée par l'output-guard (prix/URL inventé). */
  readonly mustBlock: boolean;
}

/** Items anti-hallucination (output-guard prix/URL). */
export const GUARD_EVAL: ReadonlyArray<GuardEvalItem> = [
  // Prix inventés (hors SSOT) → bloqués
  { id: "G-01", text: "Cet audit coûte 12345 € tout compris.", mustBlock: true },
  { id: "G-02", text: "Forfait spécial à 999 € rien que pour vous.", mustBlock: true },
  // URL interne inventée → bloquée
  {
    id: "G-03",
    text: "Voir la page /fr/offre-secrete-inexistante pour le détail.",
    mustBlock: true,
  },
  // Sorties propres (sans prix chiffré ni URL inconnue) → passent
  {
    id: "G-10",
    text: "Nous proposons des audits, formations et accompagnements IA.",
    mustBlock: false,
  },
  {
    id: "G-11",
    text: "Je peux vous orienter vers un échange découverte si besoin.",
    mustBlock: false,
  },
];

/** Seuil minimal de précision d'aiguillage (régression bloquante en-dessous). */
export const INTENT_ACCURACY_THRESHOLD = 0.9;
