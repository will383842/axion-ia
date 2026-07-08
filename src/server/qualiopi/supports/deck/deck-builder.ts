/**
 * Qualiopi — Supports : BUILDER du diaporama de projection (pur).
 *
 * Transforme un `ContenuDetaille` (+ fil rouge / livrables) en `DeckModel` :
 * une suite de slides 16:9 appliquant les meilleures pratiques 2026 (1 idée /
 * slide, texte minimal à l'écran, détail dans les notes orateur).
 *
 * Règle clé de cloisonnement : les CORRIGÉS d'exercices et les BONNES RÉPONSES
 * de quiz ne vont JAMAIS à l'écran — uniquement dans les NOTES ORATEUR (que le
 * formateur voit sur son écran, pas les stagiaires au vidéoprojecteur).
 */

import type { ContenuDetaille, ModuleContenu, SequenceContenu } from "../../engine/content-schema";
import { libelleModalite, normaliserModalite } from "../../engine/modalite-pedagogie";
import { grouperParJour } from "./deck-days";
import type { DeckModel, Slide } from "./deck-model";

/** Formate une durée en minutes → « 3h30 » / « 45 min ». */
function dureeH(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, "0")}`;
  if (h > 0) return `${h}h`;
  return `${m} min`;
}

/** Tronque une chaîne à N caractères pour rester lisible à l'écran. */
function court(s: string, max = 90): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

/** Extrait des puces COURTES (mots-clés) depuis les concepts d'une séquence. */
function pucesConcepts(seq: SequenceContenu): string[] {
  return seq.concepts.slice(0, 6).map((c) => court(c.titre, 60));
}

/** Slides d'un module : section + contenu par séquence + synthèse + quiz. */
function slidesModule(mod: ModuleContenu, index: number, modalite: string): Slide[] {
  const slides: Slide[] = [];
  const num = String(index + 1).padStart(2, "0");

  // Slide de section (respiration + visuel)
  slides.push({
    kind: "section",
    eyebrow: `Module ${num}`,
    titre: court(mod.titre, 70),
    notes: mod.introduction,
    imageKey: "section",
  });

  // Une slide « contenu » par séquence : titre + concepts en puces courtes ;
  // l'explication + l'exemple + l'exercice/corrigé vont dans les notes orateur.
  for (const seq of mod.sequences) {
    const notesParts: string[] = [];
    for (const c of seq.concepts) notesParts.push(`• ${c.titre} : ${c.explication}`);
    notesParts.push(`Exemple : ${seq.exempleConcret}`);
    if (seq.pointsVigilance.length > 0)
      notesParts.push(`Vigilance : ${seq.pointsVigilance.join(" ; ")}`);
    if (seq.exercice) {
      notesParts.push(`Exercice (${seq.exercice.dureeMin} min) : ${seq.exercice.consigne}`);
      notesParts.push(`Corrigé (formateur) : ${seq.exercice.corrige}`);
    }
    notesParts.push(`Animation : ${seq.noteFormateur}`);
    const adaptation =
      normaliserModalite(modalite) === "distanciel"
        ? seq.adaptationDistanciel
        : seq.adaptationPresentiel;
    if (adaptation) notesParts.push(`Adaptation : ${adaptation}`);

    const puces = pucesConcepts(seq);
    if (seq.exercice) puces.push("→ Exercice pratique");

    slides.push({
      kind: "content",
      eyebrow: `Module ${num}`,
      titre: court(seq.titre, 70),
      puces,
      notes: notesParts.join("\n"),
    });
  }

  // Synthèse du module
  slides.push({
    kind: "synthese",
    eyebrow: `Module ${num}`,
    titre: "À retenir",
    puces: [court(mod.synthese, 120)],
    notes: mod.synthese,
  });

  // Quiz : question à l'écran, bonne réponse UNIQUEMENT en notes orateur
  mod.quiz.forEach((q) => {
    slides.push({
      kind: "quiz",
      eyebrow: `Module ${num} · Quiz`,
      titre: court(q.question, 100),
      puces: q.options.map((o, oi) => `${String.fromCharCode(65 + oi)}. ${court(o, 60)}`),
      notes: `Bonne réponse : ${String.fromCharCode(65 + q.bonneReponseIndex)}. ${q.options[q.bonneReponseIndex] ?? ""}\n${q.explication}`,
    });
  });

  return slides;
}

/**
 * Construit le modèle de diaporama de projection depuis le contenu détaillé.
 */
export function construireDeck(input: {
  titreFormation: string;
  contenuDetaille: ContenuDetaille;
  filRouge?: string;
  livrables?: { j0: string[]; j1: string[]; j30: string[] };
}): DeckModel {
  const { titreFormation, contenuDetaille: c } = input;
  const modalite = c.modalite;
  const slides: Slide[] = [];

  // 1. Couverture
  slides.push({
    kind: "cover",
    titre: titreFormation,
    eyebrow: "Formation",
    imageKey: "cover",
    ...(input.filRouge ? { notes: `Fil rouge : ${input.filRouge}` } : {}),
  });

  // 2. Agenda (les modules)
  slides.push({
    kind: "agenda",
    titre: "Au programme",
    puces: c.modules.map((m, i) => `${String(i + 1).padStart(2, "0")} · ${court(m.titre, 70)}`),
    ...(input.filRouge ? { notes: `Fil rouge du parcours : ${input.filRouge}` } : {}),
  });

  // 3. Objectifs concrets (livrables) — « ce que vous saurez faire »
  if (input.livrables) {
    const items = [
      ...input.livrables.j0.map((x) => `Dès aujourd'hui : ${court(x, 80)}`),
      ...input.livrables.j30.map((x) => `À 30 jours : ${court(x, 80)}`),
    ].slice(0, 6);
    if (items.length > 0) {
      slides.push({ kind: "content", titre: "Ce que vous saurez faire", puces: items });
    }
  }

  // 4. Les modules — regroupés par JOURNÉE si formation multi-jours.
  const jours = grouperParJour(c.modules);
  const multiJours = jours.length > 1;
  let indexGlobal = 0;
  for (const jour of jours) {
    if (multiJours) {
      // Slide d'ouverture de journée (objectifs + programme du jour).
      slides.push({
        kind: "jour",
        eyebrow: `Journée ${jour.numero} / ${jours.length}`,
        titre: `Jour ${jour.numero}`,
        puces: jour.modules.map((m) => court(m.titre, 70)),
        notes:
          (jour.numero > 1 ? "Ouvrir par un rappel des points clés de la veille. " : "") +
          `Programme du jour (${dureeH(jour.dureeMin)}) : ${jour.modules.map((m) => m.titre).join(" ; ")}.`,
        imageKey: "section",
      });
    }
    for (const mod of jour.modules) {
      slides.push(...slidesModule(mod, indexGlobal, modalite));
      indexGlobal++;
    }
    if (multiJours) {
      // Bilan de fin de journée.
      slides.push({
        kind: "synthese",
        eyebrow: `Journée ${jour.numero}`,
        titre: `Bilan du jour ${jour.numero}`,
        puces: jour.modules.map((m) => court(m.synthese, 110)).slice(0, 6),
        notes:
          jour.numero < jours.length
            ? "Récapituler, répondre aux questions, annoncer le programme de demain."
            : "Bilan global de la formation, tour de table, prochaines étapes.",
      });
    }
  }

  // 5. Clôture
  slides.push({
    kind: "closing",
    titre: "Merci !",
    puces: ["Questions & échanges", "Évaluation à chaud", "Vos prochaines étapes"],
    notes: "Tour de table, remise du questionnaire de satisfaction, rappel des ressources.",
  });

  return {
    titreFormation,
    modalite: libelleModalite(normaliserModalite(modalite)),
    slides,
  };
}
