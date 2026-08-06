/**
 * Qualiopi — CONTENU PÉDAGOGIQUE d'un module (module PUR, aucun accès Prisma).
 *
 * ## Ce que ce fichier corrige
 *
 * 🔴 Constaté en production le 2026-08-05 : un module des 22 formations vendues
 * ne contient qu'un titre et des titres de séquences. Pas de durée, pas
 * d'objectif, pas de démonstration, pas d'exercice, pas de synthèse, aucune
 * note pour le formateur. Les générateurs de supports produisent donc une table
 * des matières mise en page — le guide d'animation va jusqu'à inventer un
 * timing (60 min par module) faute de durée réelle.
 *
 * Ce module donne au contenu la forme qu'exige le « Standard de contenu
 * pédagogique » d'Axion-IA (5 août 2026) : cinq blocs par module, et des notes
 * d'animation attachées à chaque bloc.
 *
 * ## Pourquoi les notes sont portées par le BLOC, pas par la slide
 *
 * L'exigence de Will est « une aide au formateur pour chaque slide ». Modéliser
 * par slide figerait pourtant le découpage : une démonstration peut occuper une
 * ou deux slides selon la longueur du prompt, et ce choix appartient au
 * générateur. Le bloc est l'unité STABLE — il porte le sens, la slide n'est
 * qu'un rendu. Chaque bloc produisant au moins une slide, l'aide reste au
 * rendez-vous pour chacune.
 *
 * ## Pourquoi du JSON et pas de nouvelles tables
 *
 * `Formation.programmeDetaille` est déjà une colonne Json. L'enrichir évite une
 * migration sur une table de production, garde la lecture en une requête, et
 * reste rétro-compatible : les 22 modules actuels restent lisibles, simplement
 * INCOMPLETS — ce que `diagnostiquerModule` sait dire précisément.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Notes d'animation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ce qu'un formateur doit avoir sous les yeux pour animer un bloc qu'il n'a pas
 * écrit. C'est l'exigence centrale du Standard : « n'importe quel formateur IA,
 * quel que soit son niveau, doit pouvoir assurer n'importe quelle formation ».
 *
 * ⚠️ `planB` n'est pas optionnel, et c'est délibéré : en formation IA, la
 * démonstration en direct échoue régulièrement (quota atteint, service
 * indisponible, réponse aberrante). Un bloc sans repli laisse le formateur
 * seul devant la salle — exactement ce que le Standard veut empêcher.
 */
export const notesAnimateurSchema = z.object({
  /** Ce qu'il faut DIRE, pas ce qu'il faut montrer. */
  script: z.string().min(20, "Le script doit être une consigne utile, pas un mot-clé."),
  /** Durée de ce bloc, en minutes — alimente le programme minuté annoncé en ouverture. */
  timingMin: z.number().int().positive().max(240),
  /** Questions récurrentes des stagiaires sur ce point précis, et leur réponse. */
  faq: z
    .array(
      z.object({
        question: z.string().min(5),
        reponse: z.string().min(5),
      }),
    )
    .default([]),
  /** Blocages observés à cette étape, et comment les désamorcer. */
  blocages: z
    .array(
      z.object({
        situation: z.string().min(5),
        parade: z.string().min(5),
      }),
    )
    .default([]),
  /** Repli si la démonstration technique tombe en panne. Jamais vide. */
  planB: z.string().min(10, "Un plan B vague ne sert à rien le jour où l'outil tombe."),
});

export type NotesAnimateur = z.infer<typeof notesAnimateurSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Les cinq blocs
// ─────────────────────────────────────────────────────────────────────────────

/** Bloc 1 — l'objectif, formulé comme un résultat observable et RATTACHÉ. */
export const blocObjectifSchema = z.object({
  /** « À l'issue de ce module, vous saurez… » — un résultat, pas un thème. */
  enonce: z.string().min(15),
  /**
   * Identifiant de l'objectif GLOBAL de la formation que ce module sert.
   * Sans ce lien, impossible de prouver en fin de formation que les objectifs
   * déclarés ont été couverts — c'est l'exigence explicite du Standard.
   */
  objectifGlobalId: z.string().min(1),
  notes: notesAnimateurSchema,
});

/**
 * Bloc 2 — la démonstration avant / après.
 *
 * ⚠️ `prompt` est intégral et le schéma le vérifie : un prompt tronqué par des
 * points de suspension rend la démonstration irreproductible. « Un résultat
 * sans le prompt qui l'a produit n'est pas transmissible — le stagiaire regarde
 * un tour de magie au lieu d'apprendre. »
 *
 * `gain` est optionnel mais fortement utile : c'est le chiffre qui se lit du
 * fond de la salle (« 40 min → 10 min ») quand le texte, lui, ne se lit pas.
 */
export const blocDemonstrationSchema = z.object({
  /** La tâche telle qu'elle se fait aujourd'hui, sans IA. */
  avant: z.string().min(20),
  /** La même tâche, avec la méthode. */
  apres: z.string().min(20),
  /** Le prompt EN ENTIER, recopiable tel quel. */
  prompt: z
    .string()
    .min(30)
    .refine((p) => !/(\.\.\.|…)\s*$/.test(p.trim()), {
      message: "Le prompt est tronqué : il doit être affiché en entier.",
    }),
  /** Un SEUL outil par démonstration — mélanger brouille la reproduction. */
  outil: z.string().min(2),
  /** Écart chiffré, composé à l'échelle du titre sur la slide. */
  gain: z
    .object({
      avant: z.string().min(1),
      apres: z.string().min(1),
    })
    .optional(),
  notes: notesAnimateurSchema,
});

/** Bloc 3 — la pratique immédiate, chronométrée et universelle. */
export const blocPratiqueSchema = z.object({
  /** Consigne explicite affichée à l'écran, sur une tâche que tout le monde fait. */
  consigne: z.string().min(20),
  /** Minutage annoncé — il s'affiche sur la slide et tient le programme. */
  dureeMin: z.number().int().positive().max(120),
  notes: notesAnimateurSchema,
});

/** Bloc 4 — la vérification de compréhension, avant de passer au module suivant. */
export const blocVerificationSchema = z.object({
  question: z.string().min(10),
  /** La réponse attendue — le formateur corrige à l'oral avec le groupe. */
  reponseAttendue: z.string().min(5),
  notes: notesAnimateurSchema,
});

/**
 * Bloc 5 — la synthèse.
 *
 * Deux à trois points MAXIMUM, formulés comme des actions déjà acquises
 * (« vous savez maintenant faire X »), jamais comme un résumé de cours : « un
 * stagiaire retient une action, pas un plan de cours ».
 */
export const blocSyntheseSchema = z.object({
  acquis: z
    .array(z.string().min(10))
    .min(2, "Une synthèse tient en au moins deux acquis.")
    .max(3, "Au-delà de trois, ce n'est plus une synthèse mais un résumé de cours."),
  notes: notesAnimateurSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// Le module
// ─────────────────────────────────────────────────────────────────────────────

/** Séquence — conservée telle quelle : c'est la forme des 22 formations actuelles. */
export const sequenceSchema = z.object({
  id: z.string().min(1),
  titre: z.string().min(1),
  description: z.string().optional(),
  dureeMin: z.number().int().positive().optional(),
});

/**
 * Module ENRICHI — la cible.
 *
 * Tous les blocs sont requis : c'est ce qui rend l'incomplétude détectable, et
 * donc refusable à la publication. Un module qui n'a pas ses cinq blocs n'est
 * pas un module « en cours », c'est un module qui produira un support vide.
 */
export const modulePedagogiqueSchema = z.object({
  moduleId: z.string().min(1),
  titre: z.string().min(3),
  /**
   * 🔴 Durée réelle. Son absence est la raison pour laquelle le guide
   * d'animation actuel invente « 60 min » pour chaque module.
   */
  dureeMin: z.number().int().positive().max(480),
  objectif: blocObjectifSchema,
  demonstration: blocDemonstrationSchema,
  pratique: blocPratiqueSchema,
  verification: blocVerificationSchema,
  synthese: blocSyntheseSchema,
  /** Découpage fin, optionnel — il ne remplace pas les cinq blocs. */
  sequences: z.array(sequenceSchema).default([]),
});

export type ModulePedagogique = z.infer<typeof modulePedagogiqueSchema>;

/**
 * Module tel qu'il existe AUJOURD'HUI en base : titre + séquences, le reste
 * absent. Lire cette forme sans échouer est indispensable — sinon les 22
 * formations deviendraient illisibles du jour au lendemain.
 */
export const moduleHeriteSchema = z.object({
  moduleId: z.string().min(1),
  titre: z.string().min(1),
  dureeMin: z.number().int().positive().optional(),
  sequences: z.array(sequenceSchema).default([]),
});

export type ModuleHerite = z.infer<typeof moduleHeriteSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostic de complétude
// ─────────────────────────────────────────────────────────────────────────────

/** Les cinq blocs, dans l'ordre du Standard. */
export const BLOCS_REQUIS = [
  "objectif",
  "demonstration",
  "pratique",
  "verification",
  "synthese",
] as const;

export type BlocRequis = (typeof BLOCS_REQUIS)[number];

/**
 * Corps de chaque bloc, notes retirées.
 *
 * Chaque bloc est jugé en DEUX temps : son corps, puis ses notes. Un bloc dont
 * le contenu est bon mais dont le plan B manque n'est pas « absent » — le dire
 * distinctement évite de renvoyer l'auteur réécrire ce qui est déjà fait.
 *
 * Les `omit` sont figés ici, sur des schémas CONCRETS : appelés à travers un
 * index dynamique, TypeScript ne sait plus quelle signature retenir.
 */
const CORPS_SANS_NOTES = {
  objectif: blocObjectifSchema.omit({ notes: true }),
  demonstration: blocDemonstrationSchema.omit({ notes: true }),
  pratique: blocPratiqueSchema.omit({ notes: true }),
  verification: blocVerificationSchema.omit({ notes: true }),
  synthese: blocSyntheseSchema.omit({ notes: true }),
} as const;

export interface DiagnosticModule {
  moduleId: string;
  titre: string;
  /** Le module respecte-t-il intégralement le Standard ? */
  complet: boolean;
  /** Blocs absents ou invalides — ce qu'il reste à écrire. */
  blocsManquants: BlocRequis[];
  /** La durée réelle est-elle renseignée ? Sinon le minutage est inventé. */
  dureeManquante: boolean;
  /** Blocs présents mais dont les notes d'animation sont incomplètes. */
  notesIncompletes: BlocRequis[];
}

/**
 * Dit précisément ce qui manque à un module, sans jamais lever.
 *
 * Rendre un diagnostic plutôt qu'un booléen est délibéré : « incomplet » ne
 * dit pas quoi faire, « il manque la démonstration et le plan B de la pratique »
 * si. C'est ce message que l'écran d'édition et la grille qualité afficheront.
 */
export function diagnostiquerModule(brut: unknown): DiagnosticModule {
  const base = moduleHeriteSchema.safeParse(brut);
  const moduleId =
    base.success && base.data.moduleId
      ? base.data.moduleId
      : typeof (brut as { moduleId?: unknown })?.moduleId === "string"
        ? (brut as { moduleId: string }).moduleId
        : "(sans identifiant)";
  const titre = base.success ? base.data.titre : "(module illisible)";

  if (!base.success) {
    return {
      moduleId,
      titre,
      complet: false,
      blocsManquants: [...BLOCS_REQUIS],
      dureeManquante: true,
      notesIncompletes: [],
    };
  }

  const blocsManquants: BlocRequis[] = [];
  const notesIncompletes: BlocRequis[] = [];

  for (const bloc of BLOCS_REQUIS) {
    const valeur = (brut as Record<string, unknown>)[bloc];
    if (valeur === undefined || valeur === null) {
      blocsManquants.push(bloc);
      continue;
    }
    const corpsOk = CORPS_SANS_NOTES[bloc].safeParse(valeur).success;
    if (!corpsOk) {
      blocsManquants.push(bloc);
      continue;
    }
    const notesOk = notesAnimateurSchema.safeParse((valeur as { notes?: unknown }).notes).success;
    if (!notesOk) notesIncompletes.push(bloc);
  }

  return {
    moduleId,
    titre,
    complet: blocsManquants.length === 0 && notesIncompletes.length === 0,
    blocsManquants,
    dureeManquante: base.data.dureeMin === undefined,
    notesIncompletes,
  };
}
