/**
 * Qualiopi — Supports : MODÈLE DE DIAPORAMA DE PROJECTION (16:9).
 *
 * Module PUR (aucune I/O). Définit le modèle de slides projetable — distinct du
 * livret PDF A4. Un « deck » est une suite de slides destinées au vidéoprojecteur
 * le jour de la formation, conçues selon les meilleures pratiques 2026 :
 *
 *  - UNE idée par slide (jamais un mur de texte) ;
 *  - titre court et fort, ≤ 6 puces de quelques mots ;
 *  - le DÉTAIL (explications, corrigés, timing) va dans les NOTES ORATEUR, pas à
 *    l'écran (les stagiaires écoutent, ne lisent pas) ;
 *  - slides de section (respiration) + slides de synthèse + slides de quiz ;
 *  - un visuel d'illustration possible par slide de section (dual-coding).
 *
 * Le rendu concret (PDF 16:9 et PPTX éditable) consomme ce modèle → même contenu,
 * deux formats.
 */

export type SlideKind =
  | "cover" // page de garde
  | "agenda" // sommaire des modules
  | "jour" // ouverture d'une JOURNÉE (formations multi-jours)
  | "section" // ouverture d'un module (respiration + visuel)
  | "content" // une idée : titre + puces courtes
  | "quiz" // question de quiz (réponse en notes)
  | "synthese" // points clés d'un module
  | "closing"; // clôture

export interface Slide {
  kind: SlideKind;
  /** Titre affiché (court, lisible au fond de la salle). */
  titre: string;
  /** Sur-titre optionnel (ex. « Module 2 · Séquence 1 »). */
  eyebrow?: string;
  /** Puces à l'écran — COURTES (mots-clés), ≤ 6. Vide pour cover/section. */
  puces?: string[];
  /** Notes orateur (le détail : explications, exemple, corrigé, timing…). */
  notes?: string;
  /** Clé d'image d'illustration (gamme) pour les slides de section. */
  imageKey?: string;
}

export interface DeckModel {
  titreFormation: string;
  sousTitre?: string;
  modalite?: string;
  slides: Slide[];
}
