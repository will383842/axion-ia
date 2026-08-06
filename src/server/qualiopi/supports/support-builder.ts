/**
 * Qualiopi — Builder PUR de supports de formation pédagogiques (T13).
 *
 * `construireSupport` : produit un `SupportContenu` structuré depuis les données
 * de formation, selon le type de support demandé. AUCUNE I/O — pur, synchrone,
 * testable unitairement sans mock.
 *
 * `titreSupport` : génère le titre du document selon le type et le titre de formation.
 *
 * Types supportés :
 *  - slides_formateur   → 1 section/séquence, contenu détaillé formateur
 *  - slides_stagiaire   → 1 section/séquence, contenu synthétique stagiaire
 *  - livret_stagiaire   → accueil + objectifs + programme + moyens + ressources
 *  - memo               → points clés par mod (mémorisation rapide)
 *  - guide_animation    → timing + consignes formateur par mod
 *  - exercices          → énoncés d'exercices depuis les objectifs/séquences
 *  - grille_eval        → critères d'évaluation depuis les objectifs pédagogiques
 *
 * NE PAS "use client" — builder serveur.
 */

import type { SupportType } from "../../../../prisma/generated/client";
import { construireSupportRiche } from "./support-builder-rich";
import type {
  FormationInput,
  ModuleProgramme,
  SupportContenu,
  SectionContenu,
  BlocContenu,
} from "./types";
import { titreModuleSansPrefixe } from "@/server/qualiopi/documents/programme-modules";

// ============================================================
// Titre du support
// ============================================================

/**
 * Libellés FR des 7 types de supports — SSOT (convergence du 2026-08-05).
 *
 * Trois tables divergeaient : ici (« Diaporama formateur »), TYPE_LABELS_RAW de
 * supports/page.tsx (« Diapositives formateur ») et typeLabelFr du template PDF
 * (« SLIDES FORMATEUR »). Le même objet portait trois noms — et « Diaporama
 * formateur » entrait en collision avec le slot `diaporama` du kit documentaire
 * (le .pptx UPLOADÉ projeté en salle, un objet DIFFÉRENT du PDF généré). D'où
 * « Livret de projection » : ce que le formateur a sous les yeux, pas ce qu'il
 * projette. La page supports importe cette table ; le badge PDF la reprend en
 * MAJUSCULES (parité verrouillée par support-labels.spec.ts).
 *
 * ⚠️ `SupportFormation.titre` est PERSISTÉ en base et estampillé dans les PDF
 * R2 : les supports générés AVANT la convergence gardent l'ancien libellé
 * jusqu'à régénération (bouton existant, version++). On ne migre PAS les
 * données.
 */
export const SUPPORT_TYPE_LABELS: Record<SupportType, string> = {
  slides_formateur: "Livret de projection (formateur)",
  slides_stagiaire: "Support de cours (stagiaire)",
  livret_stagiaire: "Livret stagiaire",
  memo: "Mémo récapitulatif",
  guide_animation: "Guide d'animation",
  exercices: "Cahier d'exercices",
  grille_eval: "Grille d'évaluation",
};

/**
 * Génère le titre du document support selon son type.
 */
export function titreSupport(type: SupportType, formationTitre: string): string {
  return `${SUPPORT_TYPE_LABELS[type]} — ${formationTitre}`;
}

// ============================================================
// Helpers internes
// ============================================================

function formatDuree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, "0")}`;
  if (h > 0) return `${h}h`;
  return `${m} min`;
}

function sequencesTitles(mod: ModuleProgramme): string[] {
  return (mod.sequences ?? []).map((s) => s.titre);
}

/**
 * Ce que le formateur fait pendant la séquence, en un mot.
 *
 * Formulé du point de vue de l'animation — « Le formateur montre », « Chacun
 * produit » — parce que c'est ce qu'on lit en diagonale entre deux séquences,
 * pas une taxonomie.
 */
const NATURE_SEQUENCE: Record<string, string> = {
  objectif: "annoncer le résultat visé",
  cadre: "poser le cadre",
  demonstration: "montrer, avant/après",
  pratique: "faire produire, chronométré",
  verification: "faire vérifier et corriger en salle",
  synthese: "faire formuler les acquis",
  pause: "pause",
};

/**
 * Durée d'un module, en minutes, ou `null` si elle n'est pas établie.
 *
 * 🔴 Le guide d'animation retenait `mod.dureeMin ?? 60`. Or `programmeDetaille`
 * n'a JAMAIS porté de durée au niveau module — seulement au niveau séquence.
 * Le repli s'appliquait donc systématiquement : le document que le formateur
 * suit en salle annonçait quatre modules d'une heure pour une journée de sept,
 * et les horaires de toutes les séquences en découlaient. On additionne
 * désormais les séquences, et on se tait quand rien n'est su.
 */
function dureeModuleMin(mod: ModuleProgramme): number | null {
  if (typeof mod.dureeMin === "number" && mod.dureeMin > 0) return mod.dureeMin;
  const somme = (mod.sequences ?? []).reduce((n, s) => n + (s.dureeMin ?? 0), 0);
  return somme > 0 ? somme : null;
}

function moduleResume(mod: ModuleProgramme): string {
  const duree = mod.dureeMin ? ` (${formatDuree(mod.dureeMin)})` : "";
  // `moduleId` est un identifiant technique (« mod-1 »), pas un numero : il
  // n'a rien a faire sur une piece remise au stagiaire. Et le titre porte deja
  // « Module N — ». Les deux ensemble donnaient « Module mod-1 : Module 1 — … ».
  return `${titreModuleSansPrefixe(mod.titre)}${duree}`;
}

// ============================================================
// Builders par type
// ============================================================

function buildSlidesFormateur(f: FormationInput): SupportContenu {
  const sections: SectionContenu[] = [];

  // Page de titre
  sections.push({
    titre: "Introduction",
    blocs: [
      { type: "paragraphe", texte: f.titre },
      { type: "paragraphe", texte: `Durée totale : ${f.dureeHeures}h` },
      {
        type: "liste",
        items:
          f.objectifsPedagogiques.length > 0 ? f.objectifsPedagogiques : ["Objectifs à définir"],
      },
    ],
  });

  // Une section par mod, avec les séquences détaillées
  for (const mod of f.programmeDetaille) {
    const blocs: BlocContenu[] = [];

    blocs.push({ type: "note", texte: moduleResume(mod) });

    if (mod.sequences && mod.sequences.length > 0) {
      for (const seq of mod.sequences) {
        const dureeLabel = seq.dureeMin ? ` — ${formatDuree(seq.dureeMin)}` : "";
        blocs.push({ type: "paragraphe", texte: `${seq.titre}${dureeLabel}` });
        if (seq.description) {
          blocs.push({ type: "note", texte: seq.description });
        }
      }
    } else {
      blocs.push({ type: "paragraphe", texte: "Séquences à préciser." });
    }

    if (f.methodesPedagogiques && f.methodesPedagogiques.length > 0) {
      blocs.push({ type: "liste", items: f.methodesPedagogiques });
    }

    sections.push({ titre: mod.titre, blocs });
  }

  // Notes formateur
  const noteBlocs: BlocContenu[] = [
    { type: "note", texte: "Vérifier la configuration technique avant la session." },
    { type: "note", texte: "Encourager les questions à chaque fin de mod." },
  ];
  if (f.moyensTechniques && f.moyensTechniques.length > 0) {
    noteBlocs.push({ type: "liste", items: f.moyensTechniques });
  }
  sections.push({ titre: "Notes formateur", blocs: noteBlocs });

  return {
    sections,
    meta: { type: "slides_formateur", formation: f.titre },
  };
}

function buildSlidesStagiaire(f: FormationInput): SupportContenu {
  const sections: SectionContenu[] = [];

  sections.push({
    titre: "Présentation de la formation",
    blocs: [
      { type: "paragraphe", texte: f.titre },
      { type: "paragraphe", texte: `Durée : ${f.dureeHeures}h` },
      {
        type: "objectif",
        items:
          f.objectifsPedagogiques.length > 0 ? f.objectifsPedagogiques : ["Objectifs à définir"],
      },
    ],
  });

  for (const mod of f.programmeDetaille) {
    const blocs: BlocContenu[] = [];
    const seqTitles = sequencesTitles(mod);

    if (seqTitles.length > 0) {
      blocs.push({ type: "liste", items: seqTitles });
    } else {
      blocs.push({ type: "paragraphe", texte: "Contenu en cours d'élaboration." });
    }

    sections.push({ titre: mod.titre, blocs });
  }

  if (f.ressourcesPedagogiques && f.ressourcesPedagogiques.length > 0) {
    sections.push({
      titre: "Ressources complémentaires",
      blocs: [{ type: "liste", items: f.ressourcesPedagogiques }],
    });
  }

  return {
    sections,
    meta: { type: "slides_stagiaire", formation: f.titre },
  };
}

function buildLivretStagiaire(f: FormationInput): SupportContenu {
  const sections: SectionContenu[] = [];

  // Accueil
  sections.push({
    titre: "Bienvenue",
    blocs: [
      {
        type: "paragraphe",
        texte: `Bienvenue dans la formation « ${f.titre} ». Ce livret vous accompagnera tout au long de votre parcours.`,
      },
      { type: "note", texte: `Durée totale : ${f.dureeHeures}h` },
    ],
  });

  // Objectifs
  sections.push({
    titre: "Objectifs pédagogiques",
    blocs: [
      {
        type: "objectif",
        items:
          f.objectifsPedagogiques.length > 0 ? f.objectifsPedagogiques : ["Objectifs à définir"],
      },
    ],
  });

  // Programme
  const progBlocs: BlocContenu[] = [];
  for (const mod of f.programmeDetaille) {
    progBlocs.push({ type: "paragraphe", texte: moduleResume(mod) });
    const seqTitles = sequencesTitles(mod);
    if (seqTitles.length > 0) {
      progBlocs.push({ type: "liste", items: seqTitles });
    }
  }
  sections.push({ titre: "Programme", blocs: progBlocs });

  // Moyens pédagogiques
  if (f.methodesPedagogiques && f.methodesPedagogiques.length > 0) {
    sections.push({
      titre: "Méthodes pédagogiques",
      blocs: [{ type: "liste", items: f.methodesPedagogiques }],
    });
  }

  // Moyens techniques
  if (f.moyensTechniques && f.moyensTechniques.length > 0) {
    sections.push({
      titre: "Moyens techniques",
      blocs: [{ type: "liste", items: f.moyensTechniques }],
    });
  }

  // Ressources
  if (f.ressourcesPedagogiques && f.ressourcesPedagogiques.length > 0) {
    sections.push({
      titre: "Ressources pédagogiques",
      blocs: [{ type: "liste", items: f.ressourcesPedagogiques }],
    });
  }

  // Évaluation
  sections.push({
    titre: "Évaluation",
    blocs: [
      {
        type: "paragraphe",
        texte:
          "Votre progression est évaluée en continu (exercices pratiques) et en fin de formation (évaluation sommative). Une attestation vous sera remise à l'issue du parcours.",
      },
    ],
  });

  return {
    sections,
    meta: { type: "livret_stagiaire", formation: f.titre },
  };
}

function buildMemo(f: FormationInput): SupportContenu {
  const sections: SectionContenu[] = [];

  sections.push({
    titre: "Points clés à retenir",
    blocs: [
      {
        type: "objectif",
        items:
          f.objectifsPedagogiques.length > 0 ? f.objectifsPedagogiques : ["Objectifs à définir"],
      },
    ],
  });

  for (const mod of f.programmeDetaille) {
    const seqTitles = sequencesTitles(mod);
    const blocs: BlocContenu[] = [];
    if (seqTitles.length > 0) {
      blocs.push({ type: "liste", items: seqTitles });
    } else {
      blocs.push({ type: "paragraphe", texte: "Concepts abordés dans ce mod." });
    }
    sections.push({ titre: `Points clés — ${mod.titre}`, blocs });
  }

  sections.push({
    titre: "Ressources de référence",
    blocs: [
      {
        type: "liste",
        items:
          f.ressourcesPedagogiques && f.ressourcesPedagogiques.length > 0
            ? f.ressourcesPedagogiques
            : ["Documentation fournie en formation"],
      },
    ],
  });

  return {
    sections,
    meta: { type: "memo", formation: f.titre },
  };
}

function buildGuideAnimation(f: FormationInput): SupportContenu {
  const sections: SectionContenu[] = [];

  sections.push({
    titre: "Préparer la session",
    blocs: [
      { type: "note", texte: "Vérifier le matériel technique 30 min avant le démarrage." },
      { type: "note", texte: "S'assurer de la disponibilité de tous les supports stagiaires." },
      {
        type: "liste",
        items:
          f.moyensTechniques && f.moyensTechniques.length > 0
            ? f.moyensTechniques
            : ["Équipements à vérifier"],
      },
    ],
  });

  let cumulMin = 0;
  /**
   * Dès qu'un module n'est pas minuté, plus aucun horaire n'est situable : on
   * cesse d'en annoncer plutôt que de décaler tout le reste de la journée.
   */
  let horaireSituable = true;

  for (const mod of f.programmeDetaille) {
    const dureeModule = dureeModuleMin(mod);
    const debutModule = cumulMin;

    const blocs: BlocContenu[] = [];
    if (horaireSituable && dureeModule !== null) {
      cumulMin += dureeModule;
      blocs.push({
        type: "note",
        texte: `Timing : ${formatDuree(debutModule)} → ${formatDuree(cumulMin)}`,
      });
    } else {
      horaireSituable = false;
      blocs.push({
        type: "note",
        texte: "Module non minuté : caler la durée avec le formateur avant la session.",
      });
    }

    if (mod.sequences && mod.sequences.length > 0) {
      let seqCumul = 0;
      for (const seq of mod.sequences) {
        const seqDuree = seq.dureeMin ?? 0;
        const nature = NATURE_SEQUENCE[seq.type ?? ""];
        const reperes: string[] = [];
        if (horaireSituable && seqDuree > 0) {
          reperes.push(`${formatDuree(debutModule + seqCumul)} — ${seqDuree} min`);
        } else if (seqDuree > 0) {
          reperes.push(`${seqDuree} min`);
        }
        if (nature !== undefined) reperes.push(nature);
        seqCumul += seqDuree;

        const label = reperes.length > 0 ? `${seq.titre} [${reperes.join(" · ")}]` : seq.titre;
        blocs.push({ type: "paragraphe", texte: label });
        if (seq.description) {
          blocs.push({ type: "note", texte: `Consigne : ${seq.description}` });
        }
      }
    }

    if (f.methodesPedagogiques && f.methodesPedagogiques.length > 0) {
      blocs.push({ type: "liste", items: f.methodesPedagogiques });
    }

    sections.push({ titre: titreModuleSansPrefixe(mod.titre), blocs });
  }

  sections.push({
    titre: "Clôture de session",
    blocs: [
      { type: "note", texte: "Réserver 10 min pour les questions et le tour de table." },
      { type: "note", texte: "Distribuer les questionnaires de satisfaction." },
      { type: "note", texte: "Rappeler les ressources complémentaires disponibles." },
    ],
  });

  return {
    sections,
    meta: { type: "guide_animation", formation: f.titre },
  };
}

function buildExercices(f: FormationInput): SupportContenu {
  const sections: SectionContenu[] = [];

  sections.push({
    titre: "Instructions générales",
    blocs: [
      {
        type: "paragraphe",
        texte:
          "Ce cahier d'exercices accompagne la formation. Pour chaque exercice, rédigez votre réponse dans l'espace prévu. Les solutions sont discutées en séance avec le formateur.",
      },
    ],
  });

  let exoNum = 1;
  for (const mod of f.programmeDetaille) {
    const blocs: BlocContenu[] = [];

    if (mod.sequences && mod.sequences.length > 0) {
      for (const seq of mod.sequences) {
        blocs.push({
          type: "exercice",
          texte: `Exercice ${exoNum} — ${seq.titre}`,
          items: [
            `Contexte : ${seq.description ?? "Appliquer les concepts de la séquence."}`,
            "Consigne : Réalisez l'exercice suivant en respectant les contraintes énoncées.",
            "Espace réponse : _______________________________________________",
          ],
        });
        exoNum++;
      }
    } else {
      blocs.push({
        type: "exercice",
        texte: `Exercice ${exoNum} — ${mod.titre}`,
        items: [
          "Consigne : Réalisez l'exercice en appliquant les notions du mod.",
          "Espace réponse : _______________________________________________",
        ],
      });
      exoNum++;
    }

    sections.push({ titre: `Exercices — ${mod.titre}`, blocs });
  }

  // Exercice de synthèse sur les objectifs
  if (f.objectifsPedagogiques.length > 0) {
    sections.push({
      titre: "Synthèse finale",
      blocs: [
        {
          type: "exercice",
          texte: `Exercice de synthèse — ${f.titre}`,
          items: f.objectifsPedagogiques.map(
            (obj, i) => `Question ${i + 1} : Démontrez votre maîtrise de l'objectif : « ${obj} »`,
          ),
        },
      ],
    });
  }

  return {
    sections,
    meta: { type: "exercices", formation: f.titre },
  };
}

function buildGrilleEval(f: FormationInput): SupportContenu {
  const sections: SectionContenu[] = [];

  sections.push({
    titre: "Informations stagiaire",
    blocs: [
      { type: "paragraphe", texte: "Nom / Prénom : _____________________________" },
      { type: "paragraphe", texte: "Date de la formation : _____________________" },
      { type: "paragraphe", texte: "Formateur : _________________________________" },
    ],
  });

  // Grille de compétences depuis les objectifs
  sections.push({
    titre: "Critères d'évaluation",
    blocs: [
      {
        type: "note",
        texte: "Notation : 1 = Non atteint | 2 = Partiellement atteint | 3 = Atteint | 4 = Dépassé",
      },
      {
        type: "liste",
        items:
          f.objectifsPedagogiques.length > 0
            ? f.objectifsPedagogiques.map((obj) => `${obj}  [ 1  2  3  4 ]`)
            : ["Critères à définir  [ 1  2  3  4 ]"],
      },
    ],
  });

  // Critères par mod
  for (const mod of f.programmeDetaille) {
    const seqTitles = sequencesTitles(mod);
    if (seqTitles.length > 0) {
      sections.push({
        titre: `Évaluation — ${mod.titre}`,
        blocs: [
          {
            type: "liste",
            items: seqTitles.map((s) => `${s}  [ 1  2  3  4 ]`),
          },
        ],
      });
    }
  }

  // Zone bilan
  sections.push({
    titre: "Bilan global",
    blocs: [
      { type: "paragraphe", texte: "Score total : _____ / _____ pts" },
      { type: "paragraphe", texte: "Mention :  □ Insuffisant  □ Satisfaisant  □ Très bien" },
      {
        type: "paragraphe",
        texte: "Commentaires : _________________________________________________",
      },
      { type: "paragraphe", texte: "Signature formateur : _________________  Date : ___________" },
      { type: "paragraphe", texte: "Signature stagiaire : _________________  Date : ___________" },
    ],
  });

  return {
    sections,
    meta: { type: "grille_eval", formation: f.titre },
  };
}

// ============================================================
// Point d'entrée principal
// ============================================================

/**
 * Construit le contenu structuré d'un support de formation.
 * Pur : aucune I/O, aucun appel réseau. Synchrone.
 *
 * @param type   - Type de support à construire (enum SupportType Prisma).
 * @param formation - Données de la formation source.
 * @returns SupportContenu prêt pour le template PDF.
 */
export function construireSupport(type: SupportType, formation: FormationInput): SupportContenu {
  // Chemin RICHE : si la formation possède un contenu détaillé structuré
  // (concepts, exemples, exercices+corrigés, quiz), on produit un vrai support
  // au lieu du squelette. Fallback squelette conservé pour les formations pas
  // encore passées par l'étape « contenu » du moteur (zéro régression).
  if (formation.contenuDetaille) {
    return construireSupportRiche(type, {
      titre: formation.titre,
      objectifsPedagogiques: formation.objectifsPedagogiques,
      contenuDetaille: formation.contenuDetaille,
      ...(formation.filRouge ? { filRouge: formation.filRouge } : {}),
      ...(formation.livrables ? { livrables: formation.livrables } : {}),
    });
  }

  switch (type) {
    case "slides_formateur":
      return buildSlidesFormateur(formation);
    case "slides_stagiaire":
      return buildSlidesStagiaire(formation);
    case "livret_stagiaire":
      return buildLivretStagiaire(formation);
    case "memo":
      return buildMemo(formation);
    case "guide_animation":
      return buildGuideAnimation(formation);
    case "exercices":
      return buildExercices(formation);
    case "grille_eval":
      return buildGrilleEval(formation);
    default: {
      // exhaustive check
      const _never: never = type;
      throw new Error(`Type de support inconnu : ${String(_never)}`);
    }
  }
}
