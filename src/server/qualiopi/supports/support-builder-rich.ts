/**
 * Qualiopi — Builder RICHE de supports de formation (chantier « Excellence »).
 *
 * Builder PUR (aucune I/O). Produit un `SupportContenu` détaillé à partir du
 * `ContenuDetaille` structuré généré par le moteur (concepts expliqués, exemples
 * métier, exercices AVEC corrigés, quiz, notes formateur, adaptations modalité).
 *
 * Utilisé par `construireSupport` (support-builder.ts) UNIQUEMENT quand la
 * formation possède un `contenuDetaille` valide ; sinon fallback squelette (le
 * comportement historique reste intact — additif, zéro régression).
 *
 * Différence formateur / stagiaire :
 *  - Les corrigés d'exercices, les notes d'animation et les réponses de quiz ne
 *    figurent QUE dans les supports formateur (slides_formateur, guide_animation,
 *    grille_eval). Les supports stagiaire ne les exposent jamais.
 */

import type {
  ContenuDetaille,
  ModuleContenu,
  SequenceContenu,
  QuizItem,
} from "../engine/content-schema";
import {
  normaliserModalite,
  rappelAnimationModalite,
  libelleModalite,
} from "../engine/modalite-pedagogie";
import type { SupportType } from "../../../../prisma/generated/client";
import type { SupportContenu, SectionContenu, BlocContenu } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, "0")}`;
  if (h > 0) return `${h}h`;
  return `${m} min`;
}

function conceptsBlocs(seq: SequenceContenu): BlocContenu[] {
  return seq.concepts.map((c) => ({
    type: "paragraphe" as const,
    texte: `${c.titre} — ${c.explication}`,
  }));
}

/**
 * Notes d'adaptation selon la modalité. En HYBRIDE, on rend LES DEUX adaptations
 * (présentiel + distanciel) au lieu d'en perdre une (cf. revue m2).
 */
function adaptationNotes(
  seq: SequenceContenu,
  modalite: "presentiel" | "distanciel" | "hybride",
): BlocContenu[] {
  const out: BlocContenu[] = [];
  if (modalite === "distanciel") {
    if (seq.adaptationDistanciel)
      out.push({ type: "note", texte: `Adaptation distanciel : ${seq.adaptationDistanciel}` });
  } else if (modalite === "presentiel") {
    if (seq.adaptationPresentiel)
      out.push({ type: "note", texte: `Adaptation présentiel : ${seq.adaptationPresentiel}` });
  } else {
    if (seq.adaptationPresentiel)
      out.push({ type: "note", texte: `Présentiel : ${seq.adaptationPresentiel}` });
    if (seq.adaptationDistanciel)
      out.push({ type: "note", texte: `Distanciel : ${seq.adaptationDistanciel}` });
  }
  return out;
}

function quizStagiaire(quiz: QuizItem[]): BlocContenu[] {
  // Sans révéler la bonne réponse (auto-évaluation).
  return quiz.map((q, i) => ({
    type: "liste" as const,
    items: [
      `Q${i + 1}. ${q.question}`,
      ...q.options.map((o, j) => `   ${String.fromCharCode(65 + j)}. ${o}`),
    ],
  }));
}

function quizFormateur(quiz: QuizItem[]): BlocContenu[] {
  return quiz.map((q, i) => ({
    type: "note" as const,
    texte: `Q${i + 1}. ${q.question} → Réponse : ${String.fromCharCode(65 + q.bonneReponseIndex)}. ${q.options[q.bonneReponseIndex] ?? ""} (${q.explication})`,
  }));
}

// ── Slides formateur (version animée, avec corrigés + notes) ──────────────────

function slidesFormateur(titre: string, c: ContenuDetaille): SectionContenu[] {
  const modalite = normaliserModalite(c.modalite);
  const sections: SectionContenu[] = [];

  sections.push({
    titre: "Introduction",
    blocs: [
      { type: "paragraphe", texte: titre },
      { type: "note", texte: rappelAnimationModalite(modalite) },
    ],
  });

  for (const mod of c.modules) {
    sections.push({
      titre: mod.titre,
      blocs: [{ type: "paragraphe", texte: mod.introduction }],
    });

    for (const seq of mod.sequences) {
      const blocs: BlocContenu[] = [];
      if (seq.dureeMin) blocs.push({ type: "note", texte: `Durée : ${formatDuree(seq.dureeMin)}` });
      blocs.push(...conceptsBlocs(seq));
      blocs.push({ type: "note", texte: `Exemple : ${seq.exempleConcret}` });
      if (seq.pointsVigilance.length > 0) {
        blocs.push({ type: "liste", items: seq.pointsVigilance.map((p) => `⚠️ ${p}`) });
      }
      if (seq.exercice) {
        blocs.push({
          type: "exercice",
          texte: `Exercice (${formatDuree(seq.exercice.dureeMin)}) : ${seq.exercice.consigne}`,
        });
        blocs.push({ type: "note", texte: `Corrigé : ${seq.exercice.corrige}` });
      }
      blocs.push({ type: "note", texte: `Animation : ${seq.noteFormateur}` });
      blocs.push(...adaptationNotes(seq, modalite));
      sections.push({ titre: `${mod.titre} — ${seq.titre}`, blocs });
    }

    sections.push({
      titre: `Synthèse — ${mod.titre}`,
      blocs: [{ type: "paragraphe", texte: mod.synthese }],
    });
    if (mod.quiz.length > 0) {
      sections.push({ titre: `Quiz — ${mod.titre}`, blocs: quizFormateur(mod.quiz) });
    }
  }

  return sections;
}

// ── Slides stagiaire (rédigé, sans corrigés ni réponses de quiz) ──────────────

function slidesStagiaire(titre: string, c: ContenuDetaille): SectionContenu[] {
  const sections: SectionContenu[] = [];
  sections.push({ titre: "Présentation", blocs: [{ type: "paragraphe", texte: titre }] });

  for (const mod of c.modules) {
    sections.push({ titre: mod.titre, blocs: [{ type: "paragraphe", texte: mod.introduction }] });
    for (const seq of mod.sequences) {
      const blocs: BlocContenu[] = [
        ...conceptsBlocs(seq),
        { type: "note", texte: `Exemple : ${seq.exempleConcret}` },
      ];
      if (seq.exercice) {
        blocs.push({ type: "exercice", texte: `À vous : ${seq.exercice.consigne}` });
      }
      sections.push({ titre: `${mod.titre} — ${seq.titre}`, blocs });
    }
    sections.push({
      titre: `À retenir — ${mod.titre}`,
      blocs: [{ type: "paragraphe", texte: mod.synthese }],
    });
  }
  return sections;
}

// ── Livret stagiaire ──────────────────────────────────────────────────────────

function livretStagiaire(titre: string, objectifs: string[], c: ContenuDetaille): SectionContenu[] {
  const sections: SectionContenu[] = [];
  sections.push({
    titre: "Bienvenue",
    blocs: [
      {
        type: "paragraphe",
        texte: `Bienvenue dans la formation « ${titre} ». Ce livret rassemble l'essentiel de votre parcours.`,
      },
    ],
  });
  if (objectifs.length > 0) {
    sections.push({
      titre: "Objectifs pédagogiques",
      blocs: [{ type: "objectif", items: objectifs }],
    });
  }
  for (const mod of c.modules) {
    const blocs: BlocContenu[] = [{ type: "paragraphe", texte: mod.introduction }];
    for (const seq of mod.sequences) {
      blocs.push({ type: "paragraphe", texte: seq.titre });
      blocs.push(...conceptsBlocs(seq));
      blocs.push({ type: "note", texte: `Exemple : ${seq.exempleConcret}` });
    }
    blocs.push({ type: "note", texte: `À retenir : ${mod.synthese}` });
    sections.push({ titre: mod.titre, blocs });
  }
  return sections;
}

// ── Mémo (synthèses + concepts + auto-évaluation) ─────────────────────────────

function memo(c: ContenuDetaille): SectionContenu[] {
  const sections: SectionContenu[] = [];
  for (const mod of c.modules) {
    const conceptTitres = mod.sequences.flatMap((s) => s.concepts.map((cc) => cc.titre));
    const blocs: BlocContenu[] = [{ type: "paragraphe", texte: mod.synthese }];
    if (conceptTitres.length > 0) blocs.push({ type: "liste", items: conceptTitres });
    sections.push({ titre: `Points clés — ${mod.titre}`, blocs });
    if (mod.quiz.length > 0) {
      sections.push({ titre: `Auto-évaluation — ${mod.titre}`, blocs: quizStagiaire(mod.quiz) });
    }
  }
  return sections;
}

// ── Guide d'animation (timing + notes + corrigés) ─────────────────────────────

function guideAnimation(c: ContenuDetaille): SectionContenu[] {
  const modalite = normaliserModalite(c.modalite);
  const sections: SectionContenu[] = [];
  sections.push({
    titre: "Préparer la session",
    blocs: [
      { type: "note", texte: "Vérifier le matériel/technique 30 min avant le démarrage." },
      { type: "note", texte: rappelAnimationModalite(modalite) },
    ],
  });

  let cumul = 0;
  for (const mod of c.modules) {
    const blocs: BlocContenu[] = [];
    for (const seq of mod.sequences) {
      const debut = formatDuree(cumul);
      cumul += seq.dureeMin;
      blocs.push({ type: "paragraphe", texte: `${seq.titre} [${debut} → ${formatDuree(cumul)}]` });
      blocs.push({ type: "note", texte: `Animation : ${seq.noteFormateur}` });
      if (seq.exercice) {
        blocs.push({
          type: "note",
          texte: `Exercice : ${seq.exercice.consigne} — Corrigé : ${seq.exercice.corrige}`,
        });
      }
      blocs.push(...adaptationNotes(seq, modalite));
    }
    sections.push({ titre: `Module : ${mod.titre}`, blocs });
  }

  sections.push({
    titre: "Clôture",
    blocs: [
      { type: "note", texte: "Réserver 10 min pour le tour de table et les questions." },
      { type: "note", texte: "Distribuer le questionnaire de satisfaction." },
    ],
  });
  return sections;
}

// ── Cahier d'exercices stagiaire (consignes + espace réponse, SANS corrigé) ───

function exercices(titre: string, c: ContenuDetaille): SectionContenu[] {
  const sections: SectionContenu[] = [];
  sections.push({
    titre: "Instructions générales",
    blocs: [
      {
        type: "paragraphe",
        texte: `Ce cahier d'exercices accompagne la formation « ${titre} ». Rédigez vos réponses dans l'espace prévu ; les corrigés sont repris en séance avec le formateur.`,
      },
    ],
  });

  let n = 1;
  for (const mod of c.modules) {
    const blocs: BlocContenu[] = [];
    for (const seq of mod.sequences) {
      if (!seq.exercice) continue;
      const items = [
        `Consigne : ${seq.exercice.consigne}`,
        `Durée indicative : ${formatDuree(seq.exercice.dureeMin)}`,
      ];
      if (seq.exercice.criteresReussite.length > 0) {
        items.push(`Réussi si : ${seq.exercice.criteresReussite.join(" ; ")}`);
      }
      items.push("Réponse : _______________________________________________");
      blocs.push({ type: "exercice", texte: `Exercice ${n} — ${seq.titre}`, items });
      n++;
    }
    if (blocs.length > 0) sections.push({ titre: `Exercices — ${mod.titre}`, blocs });
  }
  return sections;
}

// ── Grille d'évaluation (objectifs + critères de réussite des exercices) ──────

function grilleEval(objectifs: string[], c: ContenuDetaille): SectionContenu[] {
  const sections: SectionContenu[] = [];
  if (objectifs.length > 0) {
    sections.push({
      titre: "Évaluation des objectifs",
      blocs: [
        {
          type: "liste",
          items: objectifs.map((o) => `${o} — Acquis / En cours / Non acquis`),
        },
      ],
    });
  }
  for (const mod of c.modules) {
    const criteres = mod.sequences.flatMap((s) => s.exercice?.criteresReussite ?? []);
    if (criteres.length > 0) {
      sections.push({
        titre: `Critères observables — ${mod.titre}`,
        blocs: [{ type: "liste", items: criteres.map((cr) => `${cr} — ☐ Oui ☐ Non`) }],
      });
    }
  }
  return sections;
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

/**
 * Construit un support RICHE depuis le contenu détaillé. Le type `SupportType`
 * pilote la vue (formateur vs stagiaire). Ne throw jamais sur contenu bien formé.
 */
export function construireSupportRiche(
  type: SupportType,
  input: { titre: string; objectifsPedagogiques: string[]; contenuDetaille: ContenuDetaille },
): SupportContenu {
  const { titre, objectifsPedagogiques: objectifs, contenuDetaille: c } = input;
  let sections: SectionContenu[];
  switch (type) {
    case "slides_formateur":
      sections = slidesFormateur(titre, c);
      break;
    case "slides_stagiaire":
      sections = slidesStagiaire(titre, c);
      break;
    case "livret_stagiaire":
      sections = livretStagiaire(titre, objectifs, c);
      break;
    case "memo":
      sections = memo(c);
      break;
    case "guide_animation":
      sections = guideAnimation(c);
      break;
    case "exercices":
      sections = exercices(titre, c);
      break;
    case "grille_eval":
      sections = grilleEval(objectifs, c);
      break;
    default:
      sections = slidesStagiaire(titre, c);
  }
  return {
    sections,
    meta: {
      type,
      formation: titre,
      source: "contenu_detaille",
      modalite: libelleModalite(normaliserModalite(c.modalite)),
      ...(c.genereLe ? { date: c.genereLe } : {}),
    },
  };
}
