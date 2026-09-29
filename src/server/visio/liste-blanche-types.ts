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
 * Module PUR : aucun accès à la base, utilisable par le worker.
 */

import { estAppelApporteur } from "@/server/calendly/appel-apporteur";

/**
 * Les débuts de nom (normalisés) des types Calendly CLIENTS. Ajouter un type
 * au dossier client = une ligne ici, dans une PR relue.
 */
export const TYPES_CALENDLY_DU_DOSSIER: readonly string[] = ["discutons de votre projet"];

/** « Discutons  de votre Projet IA » → « discutons de votre projet ia ». */
export function normaliserNomDeType(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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
}

/**
 * Ce rendez-vous Calendly entre-t-il au dossier client ? Le type doit être de
 * la liste blanche ET le rendez-vous ne doit pas être un entretien.
 */
export function estRendezVousDuDossier(ev: RendezVousCalendlyAClasser): boolean {
  if (ev.linkedJobApplicationId) return false;
  return estTypeDuDossier(ev.eventTypeName);
}
