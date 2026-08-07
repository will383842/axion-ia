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

import { calculerRatioPratiquePourMinutes } from "./ratio-pratique";

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

/**
 * Champs communs à tout bloc.
 *
 * 🔴 `dureeMin` a d'abord été rangé DANS les notes d'animation. C'était une
 * erreur de conception : une durée n'est pas un commentaire, c'est de la
 * structure — elle alimente le programme minuté annoncé en ouverture, la somme
 * comparée à la durée vendue, et le ratio de pratique (le critère le plus lourd
 * de la grille qualité). Enfouie dans les notes, elle devenait invisible à tout
 * calcul.
 */
const blocBase = {
  dureeMin: z.number().int().positive().max(240),
  notes: notesAnimateurSchema,
};

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
   * déclarés ont été couverts — indicateur 11.
   *
   * ⚠️ Le schéma vérifie qu'un identifiant est PRÉSENT ; il ne peut pas savoir
   * s'il EXISTE — un module isolé ne connaît pas sa formation. C'est
   * `diagnostiquerFormation` qui traque les renvois vers le vide.
   */
  objectifGlobalId: z.string().min(1),
  /**
   * Autres objectifs vendus que ce module sert, sans être ce pour quoi il
   * existe.
   *
   * 🔴 Ce champ manquait, et son absence rendait certaines formations
   * MATHÉMATIQUEMENT impubliables : « IA pour les RH » vend cinq objectifs et
   * tient en quatre modules. Avec un seul renvoi par module, un objectif restait
   * forcément découvert, et `diagnostiquerFormation` refusait la publication
   * d'une formation pourtant complète. Le défaut n'était pas dans la formation,
   * il était dans le modèle.
   *
   * Un seul objectif PRINCIPAL reste exigé : c'est ce que le module vise, et
   * c'est lui qui décide de son contenu. Les secondaires disent ce qu'il sert en
   * plus — et ils comptent pour la couverture de l'indicateur 11.
   */
  objectifsSecondairesIds: z.array(z.string().min(1)).default([]),
  ...blocBase,
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
  /**
   * Capture d'écran annotée — exigée par la checklist du Standard. Décrite
   * ici (ce qu'elle doit montrer) ; le fichier vit dans la bibliothèque.
   */
  captureEcran: z.string().min(10).optional(),
  /**
   * 🔴 Date de dernière vérification des captures et exemples, au format
   * AAAA-MM-JJ. Exigence explicite du Standard : « les interfaces
   * Claude/ChatGPT/Gemini changent vite ». Une démonstration qui montre une
   * interface disparue décrédibilise la formation en direct — et rien, sans
   * cette date, ne permet de repérer le module à revoir.
   */
  verifieLe: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ."),
  ...blocBase,
});

/** Bloc 3 — la pratique immédiate, chronométrée et universelle. */
export const blocPratiqueSchema = z.object({
  /** Consigne explicite affichée à l'écran, sur une tâche que tout le monde fait. */
  consigne: z.string().min(20),
  /**
   * Ce que le stagiaire REPART avec — « fiche mémo des prompts, gabarit
   * réutilisable ». La checklist du Standard l'exige, et c'est ce qui
   * distingue un atelier d'une démonstration : « chaque formation doit se
   * terminer avec un livrable tangible ».
   */
  aEmporter: z.string().min(10),
  ...blocBase,
});

/** Bloc 4 — la vérification de compréhension, avant de passer au module suivant. */
export const blocVerificationSchema = z.object({
  question: z.string().min(10),
  /** La réponse attendue — le formateur corrige à l'oral avec le groupe. */
  reponseAttendue: z.string().min(5),
  ...blocBase,
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
  ...blocBase,
});

// ─────────────────────────────────────────────────────────────────────────────
// Le module
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Séquence — conservée telle quelle : c'est la forme des 22 formations actuelles.
 *
 * ⚠️ `temps` et `type` doivent figurer ici même s'ils ne servent pas au
 * diagnostic. Zod ÉCARTE les clés qu'il ne déclare pas : valider un module
 * enrichi les aurait silencieusement effacés, et avec eux le repère d'affichage
 * de la fiche publique et la nature qui décide du ratio de pratique. Le module
 * serait ressorti « valide » et amputé.
 */
export const sequenceSchema = z.object({
  id: z.string().min(1),
  titre: z.string().min(1),
  description: z.string().optional(),
  dureeMin: z.number().int().positive().optional(),
  /** Repère d'affichage tel qu'écrit au catalogue (« 35' »). */
  temps: z.string().optional(),
  /** Nature pédagogique (cf. `FormationStepType`). */
  type: z.string().optional(),
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
 * Tolérance entre la somme des blocs et la durée annoncée d'un module.
 * Cinq minutes couvrent les arrondis d'un découpage réel ; au-delà, c'est le
 * programme minuté qui ment.
 */
export const TOLERANCE_DUREE_MODULE_MIN = 5;

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

/**
 * Natures de séquence qui consomment du temps de module sans être un des cinq
 * blocs : la pause, et le cadre (régimes d'usage, ce qui ne sort jamais,
 * obligation légale). Du temps de formation qui ne se démontre ni ne se
 * pratique.
 */
export const NATURES_HORS_BLOCS = ["cadre", "pause"] as const;

export interface DiagnosticModule {
  moduleId: string;
  titre: string;
  /** Le module respecte-t-il intégralement le Standard ? */
  complet: boolean;
  /** Blocs absents ou invalides — ce qu'il reste à écrire. */
  blocsManquants: BlocRequis[];
  /** La durée réelle est-elle renseignée ? Sinon le minutage est inventé. */
  dureeManquante: boolean;
  /**
   * La somme des cinq blocs s'écarte-t-elle de la durée annoncée du module ?
   *
   * 🔴 Défaut révélé par les tests : rien ne l'empêchait. Un module déclaré
   * 90 minutes pouvait contenir 100 minutes de blocs — le programme minuté
   * projeté en ouverture devenait alors faux, et le formateur décrochait du
   * timing dès le premier module.
   */
  dureeIncoherente: boolean;
  /** Somme réelle des blocs, en minutes (0 si aucun bloc lisible). */
  dureeBlocsMin: number;
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
      dureeIncoherente: false,
      dureeBlocsMin: 0,
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

  // Somme réelle des blocs, comparée à la durée annoncée du module.
  let dureeBlocsMin = 0;
  for (const bloc of BLOCS_REQUIS) {
    const v = (brut as Record<string, unknown>)[bloc] as { dureeMin?: unknown } | undefined;
    if (v && typeof v.dureeMin === "number" && Number.isFinite(v.dureeMin)) {
      dureeBlocsMin += v.dureeMin;
    }
  }
  /**
   * ⚠️ Les cinq blocs ne couvrent PAS tout le module, et c'est voulu.
   *
   * Une pause n'est pas un bloc pédagogique, et le cadre — les régimes d'usage,
   * ce qui ne sort jamais de l'entreprise, l'obligation légale — n'en est pas un
   * non plus : c'est du temps de formation qui ne se démontre ni ne se pratique.
   * Comparer les blocs à la durée BRUTE du module déclarerait incohérent tout
   * module correctement construit, et la garde serait désarmée dès le premier
   * contenu écrit. On retranche donc ce que les séquences hors blocs consomment.
   */
  const minutesHorsBlocs = base.data.sequences.reduce(
    (n, s) =>
      s.type !== undefined && (NATURES_HORS_BLOCS as readonly string[]).includes(s.type)
        ? n + (s.dureeMin ?? 0)
        : n,
    0,
  );
  const dureeAnnoncee = base.data.dureeMin;
  const dureeAttendueBlocs =
    dureeAnnoncee === undefined ? undefined : dureeAnnoncee - minutesHorsBlocs;
  const dureeIncoherente =
    dureeAttendueBlocs !== undefined &&
    blocsManquants.length === 0 &&
    Math.abs(dureeBlocsMin - dureeAttendueBlocs) > TOLERANCE_DUREE_MODULE_MIN;

  return {
    moduleId,
    titre,
    complet:
      blocsManquants.length === 0 &&
      notesIncompletes.length === 0 &&
      dureeAnnoncee !== undefined &&
      !dureeIncoherente,
    blocsManquants,
    dureeManquante: dureeAnnoncee === undefined,
    dureeIncoherente,
    dureeBlocsMin,
    notesIncompletes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostic au niveau FORMATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trois vérités qu'aucun module ne peut établir seul — et dont l'absence
 * rendait la promesse du modèle creuse :
 *
 *  1. **La couverture des objectifs** (indicateur 11). Un module peut déclarer
 *     servir « obj-42 » qui n'existe pas, et un objectif vendu peut n'être
 *     couvert par aucun module. Dans les deux cas le schéma passe, et la
 *     promesse « prouver que les objectifs déclarés ont été couverts » est
 *     vide. Il faut confronter modules et objectifs.
 *  2. **La durée réelle contre la durée vendue.** Le programme minuté est
 *     annoncé en ouverture et engage l'organisme : sept heures vendues, quatre
 *     heures de contenu, c'est un écart qu'un auditeur voit immédiatement.
 *  3. **Le ratio de pratique.** C'est le critère le plus lourd de la grille
 *     qualité (12 points sur 100) et la promesse commerciale affichée sur les
 *     fiches — « 100 % pratique ». Sans les durées par bloc, il n'était pas
 *     calculable.
 */
export interface DiagnosticFormation {
  /** Modules complets sur total. */
  modulesComplets: number;
  modulesTotal: number;
  /** Diagnostic détaillé, module par module. */
  modules: DiagnosticModule[];
  /** Objectifs vendus qu'AUCUN module ne couvre — indicateur 11 en défaut. */
  objectifsNonCouverts: string[];
  /** Renvois vers un objectif qui n'existe pas dans la formation. */
  renvoisOrphelins: Array<{ moduleId: string; objectifGlobalId: string }>;
  /** Somme des durées de modules, en minutes. */
  dureeContenuMin: number;
  /** Durée vendue, en minutes. */
  dureeVendueMin: number;
  /** Écart en minutes (positif = contenu plus long que vendu). */
  ecartDureeMin: number;
  /**
   * Part de pratique rapportée à la durée VENDUE, en pourcentage entier, ou
   * `null` quand le programme ne porte pas de durées — jamais zéro.
   */
  ratioPratiquePct: number | null;
  /** Seuil attendu pour cette durée vendue. */
  seuilPratiquePct: number;
  /** La formation peut-elle être publiée en l'état ? */
  publiable: boolean;
}

/**
 * Tolérance sur l'écart de durée : un quart d'heure d'imprécision sur une
 * journée est normal, une heure ne l'est pas. Assez large pour ne pas
 * harceler, assez serré pour attraper un module oublié.
 */
export const TOLERANCE_ECART_DUREE_MIN = 15;

/**
 * Diagnostic complet d'une formation. Ne lève jamais : une entrée aberrante
 * produit un diagnostic « rien n'est publiable », jamais une exception.
 */
export function diagnostiquerFormation(input: {
  modules: unknown[];
  /** Identifiants des objectifs pédagogiques déclarés de la formation. */
  objectifsIds: string[];
  /** Durée vendue, en heures. */
  dureeHeures: number;
}): DiagnosticFormation {
  const modules = (Array.isArray(input.modules) ? input.modules : []).map(diagnostiquerModule);
  const dureeVendueMin = Math.round((Number(input.dureeHeures) || 0) * 60);

  const declares = new Set(input.objectifsIds ?? []);
  const couverts = new Set<string>();
  const renvoisOrphelins: DiagnosticFormation["renvoisOrphelins"] = [];
  let dureeContenuMin = 0;

  for (const brut of Array.isArray(input.modules) ? input.modules : []) {
    const m = brut as Record<string, unknown> | null;
    if (m === null || typeof m !== "object") continue;

    const duree = m["dureeMin"];
    if (typeof duree === "number" && Number.isFinite(duree)) dureeContenuMin += duree;

    const objectif = m["objectif"] as
      { objectifGlobalId?: unknown; objectifsSecondairesIds?: unknown } | undefined;
    const secondaires = Array.isArray(objectif?.objectifsSecondairesIds)
      ? objectif.objectifsSecondairesIds
      : [];
    for (const lien of [objectif?.objectifGlobalId, ...secondaires]) {
      if (typeof lien !== "string" || lien === "") continue;
      if (declares.has(lien)) couverts.add(lien);
      else {
        const moduleId = typeof m["moduleId"] === "string" ? m["moduleId"] : "(sans identifiant)";
        renvoisOrphelins.push({ moduleId, objectifGlobalId: lien });
      }
    }
  }

  const objectifsNonCouverts = [...declares].filter((o) => !couverts.has(o));

  /**
   * 🔴 Le ratio était calculé ICI, et il divergeait de `ratio-pratique.ts` sur
   * les trois termes à la fois : il rapportait la pratique au temps PROGRAMMÉ
   * (un programme à moitié vide obtenait donc le meilleur score du catalogue),
   * ne comptait que le bloc `pratique` en ignorant `verification`, et se jugeait
   * sur un seuil fixe de 60 % quand l'autre module varie selon le format. Deux
   * écrans branchés l'un sur le diagnostic et l'autre sur le calcul auraient
   * affiché deux chiffres contradictoires pour la même formation — et l'un des
   * deux serait parti dans le programme opposable.
   *
   * Il n'y a plus qu'une source.
   */
  const ratio = calculerRatioPratiquePourMinutes(input.modules, dureeVendueMin);
  const ecartDureeMin = dureeContenuMin - dureeVendueMin;
  const modulesComplets = modules.filter((m) => m.complet).length;

  return {
    modulesComplets,
    modulesTotal: modules.length,
    modules,
    objectifsNonCouverts,
    renvoisOrphelins,
    dureeContenuMin,
    dureeVendueMin,
    ecartDureeMin,
    ratioPratiquePct: ratio.pct,
    seuilPratiquePct: ratio.seuilPct,
    publiable:
      modules.length > 0 &&
      modulesComplets === modules.length &&
      objectifsNonCouverts.length === 0 &&
      renvoisOrphelins.length === 0 &&
      Math.abs(ecartDureeMin) <= TOLERANCE_ECART_DUREE_MIN &&
      ratio.atteintSeuil,
  };
}

/**
 * La démonstration a-t-elle été vérifiée récemment ?
 *
 * Le Standard recommande une revue trimestrielle du catalogue : au-delà de
 * quatre-vingt-dix jours, captures et exemples sont réputés à revoir — les
 * interfaces des modèles changent en quelques semaines.
 */
export const FRAICHEUR_DEMO_JOURS = 90;

export function demonstrationPerimee(verifieLe: string, maintenant: Date): boolean {
  const d = new Date(`${verifieLe}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return true;
  return maintenant.getTime() - d.getTime() > FRAICHEUR_DEMO_JOURS * 86_400_000;
}
