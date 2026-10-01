// Machine d'états d'une capture — fonctions PURES (aucun appel à Chrome).
//
// Chaque fonction reçoit l'état et un instant, et rend `{ etat, actions }`.
// Les actions sont exécutées par le service worker : envoyer, détruire,
// couper le son, notifier, arrêter. Tout ce qui décide est ici, et testé.
//
// Règles (plan §3.7, ADR 0054) :
//   · la capture démarre `accord_en_attente` : RIEN ne part au site ;
//   · « Accord obtenu » dans les 3 min → `en_cours` ; sinon arrêt et
//     DESTRUCTION locale ; rappel à 2 min ;
//   · « Refus » : destruction immédiate ;
//   · pause = gain à zéro (jamais `MediaRecorder.pause`) ;
//   · piste client muette 60 s → badge ; silence des deux pistes : badge 3 min,
//     notification 5 min, arrêt 30 min (jamais avant) ;
//   · salle quittée depuis 2 min, ou 2 h 55 → arrêt ;
//   · une personne en plus : la fenêtre « hors accord » s'ouvre dès son
//     ARRIVÉE (une période de mesure plus tôt) et se ferme au clic « Nouvelle
//     personne : accord obtenu » ou à son départ ; tout ce qui y tombe est
//     exclu de la transcription (RGPD-01). Sans clic, le son est en plus coupé
//     au bout de 2 min (second filet) ;
//   · 3 participants ou plus → « à trois, Meet coupe à 1 h ».

import {
  DELAIS_LOCAUX,
  PARTICIPANTS_LIMITE_MEET,
  PERIODE_MESURE_SALLE_MS,
  SEUIL_SILENCE,
} from "./constantes.js";
import { etatJeton } from "./jeton.js";

/**
 * Types (JSDoc, lus par TypeScript côté tests ; aucune construction).
 * @typedef {Record<string, any>} EtatCapture
 * @typedef {{ type: string, [cle: string]: unknown }} Action
 * @typedef {{ etat: EtatCapture, actions: Action[] }} Resultat
 */

/**
 * DICTÉE après un appel (PR 7) : micro seul, sur une rencontre EXISTANTE, 5 min
 * au plus (le site l'attend entre 2 et 5 min). Pas d'étape de consentement :
 * c'est Williams, seul, qui résume. Le site la refuse (503) tant que la notice
 * ne l'annonce pas.
 */
export const DUREE_MAX_DICTEE_MS = 5 * 60 * 1000;

/**
 * Démarre une dictée. Refuse sans rencontre choisie ou sans jeton valable.
 * @param {{ jeton: string | null, jetonExpireLe: string | null, cleClient: string, rencontreId: string | null }} entree
 * @returns {Resultat}
 */
export function demarrerDictee(etat, entree, maintenantMs) {
  if (etat.phase !== "repos" && etat.phase !== "detruit" && etat.phase !== "termine") {
    return { etat, actions: [{ type: "refuser", message: "Une capture est déjà en cours." }] };
  }
  if (!entree.rencontreId) {
    return {
      etat,
      actions: [{ type: "refuser", message: "Choisissez d'abord le rendez-vous de l'appel." }],
    };
  }
  const j = etatJeton(entree.jeton, entree.jetonExpireLe, maintenantMs);
  if (!j.peutDemarrer) {
    return { etat, actions: [{ type: "refuser", message: j.message }] };
  }
  return {
    etat: {
      phase: "en_cours",
      nature: "dictee",
      cleClient: entree.cleClient,
      rencontreId: entree.rencontreId,
      enregistrementId: null,
      debutMs: maintenantMs,
      // Pas d'accord à attendre : le son part dès que la session existe.
      accordMs: maintenantMs,
      rappelAccordFait: true,
      enPause: false,
      nbParticipants: 1,
      participantsAccordes: 1,
      nouvellePersonneDepuisMs: null,
      sonCoupe: false,
      fenetresHorsAccord: [],
      dernierSonClientMs: maintenantMs,
      dernierSonAxionMs: maintenantMs,
      dernierSonMs: maintenantMs,
      notificationSilenceFaite: false,
      salleQuitteeDepuisMs: null,
      badges: [],
    },
    actions: [
      { type: "demarrer_capture", micSeul: true },
      { type: "creer_session", debutMs: maintenantMs, nature: "dictee" },
    ],
  };
}

/** L'état de repos (aucune capture). */
/** @returns {EtatCapture} */
export function etatInitial() {
  return { phase: "repos" };
}

/**
 * Démarre une capture. Refuse si le jeton ne le permet pas.
 * @param {{ jeton: string | null, jetonExpireLe: string | null, cleClient: string, rencontreId: string | null, nbParticipants?: number }} entree
 * @returns {Resultat}
 */
export function demarrer(etat, entree, maintenantMs) {
  if (etat.phase !== "repos" && etat.phase !== "detruit" && etat.phase !== "termine") {
    return { etat, actions: [{ type: "refuser", message: "Une capture est déjà en cours." }] };
  }
  const j = etatJeton(entree.jeton, entree.jetonExpireLe, maintenantMs);
  if (!j.peutDemarrer) {
    return { etat, actions: [{ type: "refuser", message: j.message }] };
  }
  const n = entree.nbParticipants ?? 2;
  return {
    etat: {
      phase: "accord_en_attente",
      cleClient: entree.cleClient,
      rencontreId: entree.rencontreId,
      enregistrementId: null,
      debutMs: maintenantMs,
      accordMs: null,
      rappelAccordFait: false,
      enPause: false,
      nbParticipants: n,
      participantsAccordes: n,
      nouvellePersonneDepuisMs: null,
      sonCoupe: false,
      fenetresHorsAccord: [],
      dernierSonClientMs: maintenantMs,
      dernierSonAxionMs: maintenantMs,
      dernierSonMs: maintenantMs,
      notificationSilenceFaite: false,
      salleQuitteeDepuisMs: null,
      badges: [],
    },
    actions: [{ type: "demarrer_capture" }, { type: "creer_session", debutMs: maintenantMs }],
  };
}

/** Vrai si le son de cette capture peut partir au site. */
export function peutEnvoyerDuSon(etat) {
  return etat.accordMs !== null && etat.accordMs !== undefined && etat.phase !== "detruit";
}

/** @returns {Resultat} */
export function accordObtenu(etat, maintenantMs) {
  if (etat.phase !== "accord_en_attente") return { etat, actions: [] };
  if (maintenantMs - etat.debutMs > DELAIS_LOCAUX.accordMaxMs) {
    return detruire(etat, "accord_hors_delai");
  }
  return {
    etat: { ...etat, phase: "en_cours", accordMs: maintenantMs },
    actions: [
      { type: "declarer_accord", accordLe: maintenantMs, nouvellePersonne: false },
      { type: "vider_file" },
    ],
  };
}

/** @returns {Resultat} */
export function refus(etat, maintenantMs) {
  if (etat.phase === "repos" || etat.phase === "detruit") return { etat, actions: [] };
  const r = detruire(etat, "refus");
  return {
    etat: r.etat,
    actions: [...r.actions, { type: "declarer_refus", refusLe: maintenantMs }],
  };
}

/** @returns {Resultat} */
function detruire(etat, motif) {
  return {
    etat: { ...etat, phase: "detruit", motif },
    actions: [{ type: "arreter_capture" }, { type: "detruire_local", cleClient: etat.cleClient }],
  };
}

/** @returns {Resultat} */
export function pause(etat) {
  if (etat.phase !== "en_cours") return { etat, actions: [] };
  return { etat: { ...etat, enPause: true }, actions: [{ type: "gain", valeur: 0 }] };
}

/** @returns {Resultat} */
export function reprendre(etat) {
  if (etat.phase !== "en_cours" || !etat.enPause) return { etat, actions: [] };
  return {
    etat: { ...etat, enPause: false },
    actions: etat.sonCoupe ? [] : [{ type: "gain", valeur: 1 }],
  };
}

/** @returns {Resultat} */
export function arreter(etat, maintenantMs, motif = "manuel") {
  if (etat.phase === "accord_en_attente") return detruire(etat, "arret_sans_accord");
  if (etat.phase !== "en_cours") return { etat, actions: [] };
  const fenetres = fermerFenetre(etat, maintenantMs);
  return {
    etat: { ...etat, phase: "termine", fenetresHorsAccord: fenetres },
    actions: [
      { type: "arreter_capture" },
      { type: "terminer_session", motif, finLe: maintenantMs, fenetresHorsAccord: fenetres },
    ],
  };
}

/**
 * V2, N4 — les fenêtres hors accord portées par le battement de session :
 * fermées telles quelles, l'ouverte arrêtée à maintenant et marquée
 * `ouverte` (le site la fait courir jusqu'à la fin si le contact se perd).
 */
export function fenetresAuBattement(etat, maintenantMs) {
  const t = maintenantMs - etat.debutMs;
  return (etat.fenetresHorsAccord ?? []).map((x) =>
    x.finMs === null || x.finMs === undefined
      ? { debutMs: x.debutMs, finMs: Math.max(x.debutMs, t), ouverte: true }
      : { debutMs: x.debutMs, finMs: x.finMs },
  );
}

function fermerFenetre(etat, maintenantMs) {
  const t = maintenantMs - etat.debutMs;
  return etat.fenetresHorsAccord.map((x) => ({ debutMs: x.debutMs, finMs: x.finMs ?? t }));
}

/**
 * « Nouvelle personne : accord obtenu » : la fenêtre ouverte à l'arrivée se
 * ferme à l'heure du clic, le son revient s'il avait été coupé.
 * @returns {Resultat}
 */
export function nouvellePersonneAccord(etat, maintenantMs) {
  if (etat.phase !== "en_cours") return { etat, actions: [] };
  const fenetres = fermerFenetre(etat, maintenantMs);
  return {
    etat: {
      ...etat,
      participantsAccordes: etat.nbParticipants,
      nouvellePersonneDepuisMs: null,
      sonCoupe: false,
      fenetresHorsAccord: fenetres,
    },
    actions: [
      ...(etat.sonCoupe && !etat.enPause ? [{ type: "gain", valeur: 1 }] : []),
      { type: "declarer_accord", accordLe: maintenantMs, nouvellePersonne: true },
    ],
  };
}

/**
 * Le tic d'une seconde : niveaux mesurés, participants vus, présence dans la salle.
 * @param {{ niveauClient: number, niveauAxion: number, nbParticipants: number, dansLaSalle: boolean }} mesure
 * @returns {Resultat}
 */
export function tic(etat, mesure, maintenantMs) {
  if (etat.phase !== "accord_en_attente" && etat.phase !== "en_cours") return { etat, actions: [] };
  // Dictée : ni piste client, ni salle, ni participants — seulement la durée.
  if (etat.nature === "dictee") {
    if (etat.phase === "en_cours" && maintenantMs - etat.debutMs >= DUREE_MAX_DICTEE_MS) {
      return arreter(etat, maintenantMs, "duree_max");
    }
    return { etat, actions: [] };
  }
  const actions = [];
  let e = { ...etat };

  // 1. Accord : rappel à 2 min, destruction à 3 min.
  if (e.phase === "accord_en_attente") {
    const ecoule = maintenantMs - e.debutMs;
    if (ecoule > DELAIS_LOCAUX.accordMaxMs) return detruire(e, "accord_absent");
    if (ecoule >= DELAIS_LOCAUX.rappelAccordMs && !e.rappelAccordFait) {
      e.rappelAccordFait = true;
      actions.push({
        type: "notifier",
        message: "L'accord n'est pas encore cliqué : il reste une minute.",
      });
    }
  }

  // 2. Niveaux.
  const sonClient = mesure.niveauClient > SEUIL_SILENCE;
  const sonAxion = mesure.niveauAxion > SEUIL_SILENCE;
  if (sonClient) e.dernierSonClientMs = maintenantMs;
  if (sonAxion || e.dernierSonAxionMs === undefined) e.dernierSonAxionMs = maintenantMs;
  if (sonClient || sonAxion) {
    e.dernierSonMs = maintenantMs;
    e.notificationSilenceFaite = false;
  }
  const badges = new Set();
  if (maintenantMs - e.dernierSonClientMs >= DELAIS_LOCAUX.badgePisteClientMuetteMs)
    badges.add("piste_client_muette");
  // V2, M7 — le micro ne capte rien depuis 60 s alors que le client parle :
  // casque décroché, micro débranché. Le document offscreen tente de le
  // reprendre ; le badge le dit à Will.
  if (
    !e.enPause &&
    sonClient &&
    maintenantMs - e.dernierSonAxionMs >= DELAIS_LOCAUX.badgePisteClientMuetteMs
  )
    badges.add("micro_muet");
  const silence = maintenantMs - e.dernierSonMs;
  if (!e.enPause && silence >= DELAIS_LOCAUX.badgeSilenceMs) badges.add("silence");
  if (!e.enPause && silence >= DELAIS_LOCAUX.notificationSilenceMs && !e.notificationSilenceFaite) {
    e.notificationSilenceFaite = true;
    actions.push({
      type: "notifier",
      message: "Aucun son depuis 5 minutes : l'enregistrement continue.",
    });
  }

  // 3. Participants.
  if (mesure.nbParticipants >= PARTICIPANTS_LIMITE_MEET) badges.add("limite_meet");
  e.nbParticipants = mesure.nbParticipants;
  if (e.phase === "en_cours" && mesure.nbParticipants > e.participantsAccordes) {
    if (e.nouvellePersonneDepuisMs === null) {
      // RGPD-01 : la fenêtre hors accord s'ouvre à l'ARRIVÉE, pas à la coupure.
      // Le compte n'est relu que toutes les 15 s : on remonte d'une période.
      e.nouvellePersonneDepuisMs = maintenantMs;
      e.fenetresHorsAccord = [
        ...e.fenetresHorsAccord,
        {
          debutMs: Math.max(0, maintenantMs - e.debutMs - PERIODE_MESURE_SALLE_MS),
          finMs: null,
        },
      ];
      actions.push(
        {
          type: "notifier",
          message:
            "Une personne de plus : obtenez son accord (« Nouvelle personne : accord obtenu »).",
        },
        { type: "journal", evenement: "personne_sans_accord_arrivee" },
      );
    } else if (
      !e.sonCoupe &&
      maintenantMs - e.nouvellePersonneDepuisMs >= DELAIS_LOCAUX.coupureNouvellePersonneMs
    ) {
      // Second filet : le son lui-même cesse d'être enregistré.
      e.sonCoupe = true;
      actions.push(
        { type: "gain", valeur: 0 },
        { type: "journal", evenement: "son_coupe_personne_sans_accord" },
      );
    }
  } else if (mesure.nbParticipants <= e.participantsAccordes) {
    // Départ : la fenêtre se ferme ; et l'accord ne couvre plus que ceux qui
    // restent — un inconnu qui prend la place d'un accordé rouvre une fenêtre.
    if (e.phase === "en_cours") e.participantsAccordes = mesure.nbParticipants;
    if (e.nouvellePersonneDepuisMs !== null || e.sonCoupe) {
      e.fenetresHorsAccord = fermerFenetre(e, maintenantMs);
    }
    e.nouvellePersonneDepuisMs = null;
    if (e.sonCoupe) {
      e.sonCoupe = false;
      if (!e.enPause) actions.push({ type: "gain", valeur: 1 });
    }
  }
  if (e.sonCoupe) badges.add("son_coupe");
  e.badges = [...badges];

  // 4. Salle quittée, durée maximale, silence prolongé : arrêt.
  if (!mesure.dansLaSalle) {
    e.salleQuitteeDepuisMs = e.salleQuitteeDepuisMs ?? maintenantMs;
  } else {
    e.salleQuitteeDepuisMs = null;
  }
  if (e.phase === "en_cours") {
    if (
      e.salleQuitteeDepuisMs !== null &&
      maintenantMs - e.salleQuitteeDepuisMs >= DELAIS_LOCAUX.arretSalleQuitteeMs
    ) {
      const r = arreter(e, maintenantMs, "salle_quittee");
      return { etat: r.etat, actions: [...actions, ...r.actions] };
    }
    if (maintenantMs - e.debutMs >= DELAIS_LOCAUX.dureeMaxMs) {
      const r = arreter(e, maintenantMs, "duree_max");
      return { etat: r.etat, actions: [...actions, ...r.actions] };
    }
    if (!e.enPause && silence >= DELAIS_LOCAUX.arretSilenceMs) {
      const r = arreter(e, maintenantMs, "inconnu");
      return {
        etat: r.etat,
        actions: [...actions, { type: "journal", evenement: "arret_silence_30_min" }, ...r.actions],
      };
    }
  }
  return { etat: e, actions };
}
