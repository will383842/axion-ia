// Découpage du son en TRANCHES autonomes de 180 s et en morceaux de 10 s
// (fonctions PURES).
//
// Le document offscreen ARRÊTE et RELANCE son `MediaRecorder` toutes les 180 s :
// chaque tranche est un fichier WebM complet, dont le premier morceau porte
// l'en-tête EBML (0x1A 0x45 0xDF 0xA3). Le serveur n'a besoin d'aucun `ffmpeg`
// pour les transcrire séparément (ADR 0055).

import { CONSTANTES_AUDIO, ENTETES_MORCEAU } from "./constantes.js";

export const DUREE_TRANCHE_MS = CONSTANTES_AUDIO.dureeTrancheS * 1000;
export const DUREE_MORCEAU_MS = CONSTANTES_AUDIO.dureeMorceauS * 1000;

/** Nombre de morceaux d'une tranche pleine. */
export const MORCEAUX_PAR_TRANCHE = DUREE_TRANCHE_MS / DUREE_MORCEAU_MS;

/** Faut-il clore la tranche commencée à `debutTrancheMs` ? */
export function doitChangerDeTranche(debutTrancheMs, maintenantMs) {
  return maintenantMs - debutTrancheMs >= DUREE_TRANCHE_MS;
}

/** Vrai si les octets commencent par l'en-tête EBML d'un fichier WebM. */
export function commenceParEnTeteWebM(octets) {
  return (
    octets.length >= 4 &&
    octets[0] === 0x1a &&
    octets[1] === 0x45 &&
    octets[2] === 0xdf &&
    octets[3] === 0xa3
  );
}

/**
 * Les en-têtes HTTP d'un morceau. L'heure de début de capture de la tranche
 * part avec chaque morceau (le serveur crée la tranche au premier reçu, quel
 * que soit l'ordre d'arrivée).
 */
export function entetesDuMorceau({ piste, tranche, seq, debutCaptureMs, empreinte }) {
  if (piste !== "client" && piste !== "axion") throw new Error("piste inconnue");
  if (!Number.isInteger(tranche) || tranche < 0 || tranche > 9999)
    throw new Error("tranche hors bornes");
  if (!Number.isInteger(seq) || seq < 0 || seq > 99999) throw new Error("morceau hors bornes");
  return {
    [ENTETES_MORCEAU.piste]: piste,
    [ENTETES_MORCEAU.tranche]: String(tranche),
    [ENTETES_MORCEAU.seq]: String(seq),
    [ENTETES_MORCEAU.debutCaptureMs]: String(debutCaptureMs),
    [ENTETES_MORCEAU.empreinte]: empreinte,
  };
}

/**
 * Le suivi d'une tranche en cours pour UNE piste : numéro, rang du prochain
 * morceau, octets cumulés (pour l'empreinte de fin), niveau de fin.
 */
export function nouvelleTranche(numero, debutCaptureMs, motifDebut) {
  return { numero, debutCaptureMs, motifDebut, seq: 0, octets: 0, dernierNiveau: 0 };
}

/** Ajoute un morceau à la tranche ; rend la tranche mise à jour et le rang du morceau. */
export function ajouterMorceau(tranche, tailleOctets) {
  return {
    tranche: { ...tranche, seq: tranche.seq + 1, octets: tranche.octets + tailleOctets },
    seq: tranche.seq,
  };
}

/**
 * V2, M2 — la fin d'une tranche se juge sur les 20 DERNIÈRES secondes, la
 * fenêtre de tolérance du serveur (`TOLERANCE_TRONCATURE_MS`), et non sur un
 * seul relevé de 43 ms à l'arrêt (une touche de clavier faisait croire à une
 * troncature). Un relevé par seconde est noté ; la fin est muette si moins
 * d'un quart des relevés de la fenêtre dépassent le seuil.
 */
export const FENETRE_FIN_MUETTE_MS = 20_000;
export const SEUIL_NIVEAU_MUET = 0.01;
export const PART_PARLANTE_MAX = 0.25;

/** Ajoute un relevé de niveau ; ne garde que la fenêtre. Fonction PURE. */
export function noterNiveau(historique, le, niveau) {
  return [...historique, { le, niveau }].filter((r) => r.le > le - FENETRE_FIN_MUETTE_MS);
}

/** Vrai si la fin de la tranche est muette sur la fenêtre (le relevé d'arrêt compris). */
export function finMuetteSur(historique, maintenant, niveauArret) {
  const fenetre = historique.filter((r) => r.le > maintenant - FENETRE_FIN_MUETTE_MS);
  const niveaux = [...fenetre.map((r) => r.niveau), niveauArret];
  if (niveaux.length === 1) return niveauArret <= SEUIL_NIVEAU_MUET;
  const parlants = niveaux.filter((n) => n > SEUIL_NIVEAU_MUET).length;
  return parlants / niveaux.length < PART_PARLANTE_MAX;
}

/** Le message de fin de tranche (`POST sessions/[id]/tranches`). */
export function finDeTranche(tranche, piste, { empreinte, dureeMs, finMuette }) {
  return {
    piste,
    numero: tranche.numero,
    motifDebut: tranche.motifDebut,
    debutCaptureEpochMs: tranche.debutCaptureMs,
    nbMorceaux: tranche.seq,
    empreinte,
    dureeMs,
    finMuette,
  };
}
