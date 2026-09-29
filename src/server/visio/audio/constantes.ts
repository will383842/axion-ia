/**
 * Découpage du son — constantes du circuit visio (ADR 0055 §1.2).
 *
 * Pourquoi 180 s : `gpt-4o-transcribe-diarize` rend au plus 2 000 jetons de
 * sortie par requête (≈ 8 à 10 minutes de parole dense) et accepte au plus
 * 25 Mo par fichier. Une tranche de 180 s à 32 kbit/s pèse ≈ 720 Ko et tient
 * largement dans les deux limites. L'extension arrête et relance son
 * `MediaRecorder` toutes les `DUREE_TRANCHE_S` secondes : chaque tranche est un
 * fichier WebM autonome (aucun `ffmpeg` côté serveur).
 *
 * Ces valeurs sont RECOPIÉES dans le contrat de l'extension
 * (`extensions/enregistreur-meet/contrat.json`, généré en PR 5) : un changement
 * d'un seul côté y rougira.
 */

/** Durée d'une tranche autonome, par piste. */
export const DUREE_TRANCHE_S = 180;

/** Durée d'un morceau envoyé au site (une tranche = 18 morceaux). */
export const DUREE_MORCEAU_S = 10;

/** Débit audio demandé au `MediaRecorder`. */
export const DEBIT_AUDIO_BPS = 32_000;

/** Plafond d'une tranche, sous la limite de 25 Mo de l'API de transcription. */
export const TAILLE_MAX_TRANCHE_OCTETS = 24 * 1024 * 1024;
