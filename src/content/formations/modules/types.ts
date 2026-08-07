/**
 * CONTENU PÉDAGOGIQUE RÉDIGÉ — la matière que le catalogue ne porte pas.
 *
 * ## Pourquoi un fichier séparé du catalogue
 *
 * `catalog-v2.ts` décrit ce qui est VENDU et PUBLIÉ : le titre de chaque module,
 * le minutage, la nature des séquences. C'est ce qu'un client lit et ce qu'un
 * auditeur ouvre. Le contenu rédigé — le prompt exact de la démonstration, la
 * consigne de l'atelier, ce que le formateur dit quand l'outil tombe en panne —
 * est d'un autre ordre : dix fois plus volumineux, jamais publié tel quel, et
 * révisé à un autre rythme. Le mêler au catalogue rendrait celui-ci illisible.
 *
 * ## Pourquoi une clé de rattachement plutôt qu'une copie
 *
 * Un enrichissement ne redit JAMAIS le titre, la durée ou le découpage : il
 * s'accroche à un `moduleId` du catalogue. C'est la seule façon d'empêcher les
 * deux fichiers de diverger — et ils divergeraient, puisqu'ils sont modifiés par
 * des gestes différents : ajuster un minutage n'est pas réécrire une consigne.
 *
 * `enrichissements.spec.ts` refuse tout `moduleId` qui ne correspond à aucun
 * module du catalogue.
 *
 * ## Ce que le contenu devient
 *
 * L'import le fusionne dans `Formation.programmeDetaille`. De là partent le
 * diaporama projeté, le guide d'animation du formateur, le livret stagiaire et
 * le cahier d'exercices — tous depuis la même matière, jamais recopiée.
 */

import type { z } from "zod";

import type {
  blocObjectifSchema,
  blocDemonstrationSchema,
  blocPratiqueSchema,
  blocVerificationSchema,
  blocSyntheseSchema,
} from "../../../server/qualiopi/formations/module-pedagogique";

/**
 * ⚠️ `z.input` et non `z.infer`. `z.infer` décrit la SORTIE de la validation,
 * où les valeurs par défaut sont déjà appliquées : `objectifsSecondairesIds` y
 * est un tableau requis, `faq` et `blocages` aussi. Un fichier de contenu écrit
 * à la main est une ENTRÉE — il doit pouvoir omettre ce qui a un défaut, sinon
 * chaque module devrait déclarer trois tableaux vides pour rien.
 */
export type BlocObjectif = z.input<typeof blocObjectifSchema>;
export type BlocDemonstration = z.input<typeof blocDemonstrationSchema>;
export type BlocPratique = z.input<typeof blocPratiqueSchema>;
export type BlocVerification = z.input<typeof blocVerificationSchema>;
export type BlocSynthese = z.input<typeof blocSyntheseSchema>;

/**
 * Le contenu rédigé d'UN module, rattaché au catalogue par `moduleId`.
 *
 * Les cinq blocs sont tous requis. Un module à quatre blocs n'est pas un module
 * « en cours » : c'est un module qui produira un support amputé sans que rien ne
 * le signale.
 */
export interface EnrichissementModule {
  /** Identifiant du module au catalogue (« mod-1 », « mod-2 »…). */
  moduleId: string;
  objectif: BlocObjectif;
  demonstration: BlocDemonstration;
  pratique: BlocPratique;
  verification: BlocVerification;
  synthese: BlocSynthese;
}

/** Le contenu rédigé d'une formation, module par module. */
export type EnrichissementFormation = readonly EnrichissementModule[];
