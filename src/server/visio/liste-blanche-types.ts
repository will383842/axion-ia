/**
 * LISTE BLANCHE des rendez-vous Calendly qui entrent au dossier client
 * (chantier visio, PR 4 ; principe PA-9 du plan, ADR 0053).
 *
 * ## Pourquoi une liste blanche, et pas une liste noire
 *
 * Le compte Calendly porte des rendez-vous de trois mondes : les prospects
 * (« Discutons de votre projet IA »), les candidats apporteurs (« Échange
 * apporteur d'affaires ») et, un jour, des entretiens. Seul le premier est un
 * rendez-vous CLIENT. Une liste noire (« tout sauf les apporteurs ») ferait
 * entrer au dossier client — puis, un jour, dans un enregistrement — tout type
 * nouveau créé dans Calendly sans que personne ait décidé de l'y mettre. Ici,
 * un type nouveau est HORS du dossier tant qu'une ligne de code ne l'y a pas
 * ajouté.
 *
 * ## La clé : le NOM du type, normalisé
 *
 * Un `scheduled_event` Calendly ne porte ni le slug ni l'URL de son type,
 * seulement son nom (`calendly/appel-apporteur.ts` en tire la même
 * conclusion). On compare donc le nom, sans accents, en minuscules, espaces
 * resserrés, au DÉBUT du nom : « Discutons de votre projet IA (45 min) »
 * passe, « Ne pas confondre : discutons… » ne passe pas.
 *
 * Trois refus, quel que soit le nom :
 *   · un échange apporteur (`estAppelApporteur`) ;
 *   · un rendez-vous rattaché à une candidature (`linkedJobApplicationId`) :
 *     c'est un entretien, jamais un rendez-vous client ;
 *   · un nom vide.
 *
 * ## 2026-10-04 — deux rendez-vous clients, et le TYPE d'abord
 *
 * Chantier « Types de rendez-vous » (L2) : le dossier client accueille le
 * « Diagnostic IA » ET l'« Échange projet » (ex-« Discutons de votre projet
 * IA »). Quand le rendez-vous porte son `typeRendezVous` (classé par l'URI du
 * type, lot L1), c'est LUI qui décide — renommer un type chez Calendly ne le
 * fait plus sortir du dossier. Sans type (ou `autre`), repli sur le nom.
 *
 * ⚠️ Les appelants du WORKER ne sélectionnent pas encore `typeRendezVous` : le
 * worker atterrit ~50 min avant la migration (AGENTS.md). Le repli par nom
 * couvre les trois noms (« discutons de votre projet », « échange projet »,
 * « diagnostic ia ») — le renommage chez Calendly reste donc sans effet.
 *
 * Module PUR : aucun accès à la base, utilisable par le worker.
 */

import { estAppelApporteur } from "@/server/calendly/appel-apporteur";
import type { TypeRendezVous } from "@/server/calendly/type-rendez-vous";

/**
 * Les débuts de nom (normalisés) des types Calendly CLIENTS. Ajouter un type
 * au dossier client = une ligne ici, dans une PR relue.
 */
export const TYPES_CALENDLY_DU_DOSSIER: readonly string[] = [
  "discutons de votre projet",
  "echange projet",
  "diagnostic ia",
  // Slug du type Échange projet, écrit tel quel par la capture de l'iframe.
  "premier contact",
];

/** Les types de rendez-vous CLIENTS — décisifs quand le rendez-vous les porte. */
export const TYPES_RENDEZ_VOUS_DU_DOSSIER: readonly TypeRendezVous[] = [
  "diagnostic",
  "echange_projet",
];

/** « Discutons  de votre Projet IA » → « discutons de votre projet ia ». */
export function normaliserNomDeType(nom: string): string {
  return (
    nom
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      // Le slug (« diagnostic-ia ») qu'écrit la capture de l'iframe vaut le nom.
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Ce type d'événement Calendly entre-t-il au dossier client ? */
export function estTypeDuDossier(nomDuType: string | null | undefined): boolean {
  if (!nomDuType || nomDuType.trim() === "") return false;
  if (estAppelApporteur(nomDuType)) return false;
  const n = normaliserNomDeType(nomDuType);
  return TYPES_CALENDLY_DU_DOSSIER.some((debut) => n.startsWith(debut));
}

/** Ce qu'il faut savoir d'un rendez-vous Calendly pour décider. */
export interface RendezVousCalendlyAClasser {
  readonly eventTypeName: string | null;
  readonly linkedJobApplicationId?: string | null;
  /** Le type classé par l'URI (lot L1), quand l'appelant l'a lu. */
  readonly typeRendezVous?: TypeRendezVous | null;
}

/**
 * Ce rendez-vous Calendly entre-t-il au dossier client ? Le type doit être de
 * la liste blanche ET le rendez-vous ne doit pas être un entretien.
 */
export function estRendezVousDuDossier(ev: RendezVousCalendlyAClasser): boolean {
  if (ev.linkedJobApplicationId) return false;
  const type = ev.typeRendezVous;
  if (type && type !== "autre") {
    // Le type décide. Garde de sûreté : un nom d'échange apporteur ne passe
    // jamais, quel que soit le type écrit.
    if (ev.eventTypeName && estAppelApporteur(ev.eventTypeName)) return false;
    return TYPES_RENDEZ_VOUS_DU_DOSSIER.includes(type);
  }
  return estTypeDuDossier(ev.eventTypeName);
}
