// Document OFFSCREEN : les deux enregistreurs (chantier visio, PR 5).
//
//   · piste « client » : le son de l'onglet Meet (`chrome.tabCapture`), REBRANCHÉ
//     vers les haut-parleurs par un AudioContext — sinon Will n'entend plus
//     personne dès que la capture démarre ;
//   · piste « axion » : le micro de Will (`getUserMedia`, autorisé une fois
//     dans les options : un document offscreen ne peut pas demander la
//     permission lui-même).
//
// Chaque piste passe par un nœud de GAIN : la pause (et la coupure « personne
// sans accord ») met le gain à zéro — jamais `MediaRecorder.pause()`, qui
// décalerait les horodatages. `MediaRecorder` en `audio/webm;codecs=opus` à
// 32 kbit/s, un morceau toutes les 10 s, et il est ARRÊTÉ puis RELANCÉ toutes
// les 180 s : chaque tranche est un fichier WebM autonome.
//
// Les morceaux sont écrits dans l'IndexedDB (`stockage-local.js`) ; le service
// worker décide seul de ce qui part, et quand (rien avant l'accord).

import { CONSTANTES_AUDIO } from "./lib/constantes.js";
import {
  ajouterMorceau,
  doitChangerDeTranche,
  finDeTranche,
  finMuetteSur,
  noterNiveau,
  nouvelleTranche,
  DUREE_MORCEAU_MS,
} from "./lib/tranches.js";
import { ajouterALaFile } from "./stockage-local.js";

let contexte = null;
let session = null; // { cleClient, pistes: { client: Piste, axion: Piste } }

function niveau(analyseur, tampon) {
  analyseur.getFloatTimeDomainData(tampon);
  let somme = 0;
  for (const v of tampon) somme += v * v;
  return Math.sqrt(somme / tampon.length);
}

async function empreinteHex(octets) {
  const h = await crypto.subtle.digest("SHA-256", octets);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function concatener(liste) {
  const total = liste.reduce((n, b) => n + b.byteLength, 0);
  const sortie = new Uint8Array(total);
  let pos = 0;
  for (const b of liste) {
    sortie.set(new Uint8Array(b), pos);
    pos += b.byteLength;
  }
  return sortie;
}

function creerPiste(nom, flux, versHautParleurs) {
  const source = contexte.createMediaStreamSource(flux);
  const gain = contexte.createGain();
  const analyseur = contexte.createAnalyser();
  analyseur.fftSize = 2048;
  const destination = contexte.createMediaStreamDestination();
  source.connect(gain);
  gain.connect(analyseur);
  gain.connect(destination);
  if (versHautParleurs) source.connect(contexte.destination);
  return {
    nom,
    flux,
    source,
    gain,
    analyseur,
    tampon: new Float32Array(analyseur.fftSize),
    sortie: destination.stream,
    enregistreur: null,
    tranche: null,
    octetsTranche: [],
    numero: 0,
    // V2, M2 — un relevé par seconde, sur les 20 dernières secondes.
    niveaux: [],
  };
}

function demarrerTranche(piste, motifDebut) {
  // Tout ce qui décrit CETTE tranche vit dans la fermeture : à la relance,
  // `onstop` de l’ancien enregistreur arrive APRÈS le démarrage du nouveau.
  const cleClient = session.cleClient;
  let tranche = nouvelleTranche(piste.numero, Date.now(), motifDebut);
  const octetsTranche = [];
  piste.tranche = tranche;
  const rec = new MediaRecorder(piste.sortie, {
    mimeType: CONSTANTES_AUDIO.typeMime,
    audioBitsPerSecond: CONSTANTES_AUDIO.debitAudioBps,
  });
  let ecritures = Promise.resolve();
  rec.ondataavailable = (ev) => {
    if (!ev.data || ev.data.size === 0) return;
    // Les morceaux s’écrivent DANS L’ORDRE : le rang est pris à la réception.
    const t = ajouterMorceau(tranche, ev.data.size);
    tranche = t.tranche;
    if (piste.tranche && piste.tranche.numero === tranche.numero) piste.tranche = tranche;
    const seq = t.seq;
    const numero = tranche.numero;
    const debutCaptureMs = tranche.debutCaptureMs;
    ecritures = ecritures.then(async () => {
      const octets = await ev.data.arrayBuffer();
      octetsTranche[seq] = octets;
      await ajouterALaFile({
        id: `${cleClient}:${piste.nom}:${numero}:${seq}`,
        type: "morceau",
        cleClient,
        creeLe: Date.now(),
        piste: piste.nom,
        tranche: numero,
        seq,
        debutCaptureMs,
        empreinte: await empreinteHex(octets),
        octets,
        essais: 0,
      });
    });
  };
  rec.onstop = () => {
    const finMuette = finMuetteSur(
      piste.niveaux,
      Date.now(),
      niveau(piste.analyseur, piste.tampon),
    );
    ecritures = ecritures.then(async () => {
      const tout = concatener(octetsTranche.filter(Boolean));
      await ajouterALaFile({
        id: `${cleClient}:${piste.nom}:${tranche.numero}:fin`,
        type: "tranche",
        cleClient,
        creeLe: Date.now(),
        corps: finDeTranche(tranche, piste.nom, {
          empreinte: await empreinteHex(tout),
          dureeMs: Date.now() - tranche.debutCaptureMs,
          finMuette,
        }),
        essais: 0,
      });
      chrome.runtime.sendMessage({ type: "tranche_terminee", cleClient });
    });
  };
  rec.start(DUREE_MORCEAU_MS);
  piste.enregistreur = rec;
}

function relancerSiBesoin(piste) {
  if (!piste.tranche || !piste.enregistreur) return;
  if (!doitChangerDeTranche(piste.tranche.debutCaptureMs, Date.now())) return;
  piste.enregistreur.stop();
  piste.numero += 1;
  demarrerTranche(piste, "nouvelle_tranche");
}

// V2, M7 — le micro décroché (casque Bluetooth, câble) termine sa piste ; la
// destination audio, elle, continue : l'enregistreur ne s'arrête jamais.
// On redemande le micro, on rebranche la NOUVELLE source sur le nœud de gain
// existant (pause et coupure restent en place), et une tranche
// `micro_reconnecte` s'ouvre. Micro pas encore revenu : un `devicechange`
// relancera la reprise.
let micDemande = null;
let repriseEnCours = false;

function surveillerMicro(p) {
  for (const piste of p.flux.getAudioTracks()) {
    piste.onended = () => {
      void rebrancherMicro(p);
    };
  }
}

function microMort(p) {
  return p.flux.getAudioTracks().every((piste) => piste.readyState === "ended");
}

async function rebrancherMicro(p) {
  if (!session || session.pistes.axion !== p || repriseEnCours) return;
  repriseEnCours = true;
  try {
    let flux = null;
    for (const audio of micDemande ? [micDemande, true] : [true]) {
      try {
        flux = await navigator.mediaDevices.getUserMedia({ audio, video: false });
        break;
      } catch {
        flux = null;
      }
    }
    if (!flux || !session || session.pistes.axion !== p) return;
    p.source.disconnect();
    p.source = contexte.createMediaStreamSource(flux);
    p.source.connect(p.gain);
    p.flux = flux;
    surveillerMicro(p);
    if (p.enregistreur && p.enregistreur.state !== "inactive") p.enregistreur.stop();
    p.numero += 1;
    demarrerTranche(p, "micro_reconnecte");
  } finally {
    repriseEnCours = false;
  }
}

async function demarrer({ streamId, cleClient, micId, micSeul }) {
  contexte = new AudioContext();
  // Dictée (PR 7) : le micro SEUL, aucune capture d'onglet (piste « axion »).
  const fluxOnglet = micSeul
    ? null
    : await navigator.mediaDevices.getUserMedia({
        audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
        video: false,
      });
  micDemande = micId ? { deviceId: { exact: micId } } : null;
  const fluxMicro = await navigator.mediaDevices.getUserMedia({
    audio: micDemande ?? true,
    video: false,
  });
  session = {
    cleClient,
    pistes: {
      ...(fluxOnglet ? { client: creerPiste("client", fluxOnglet, true) } : {}),
      axion: creerPiste("axion", fluxMicro, false),
    },
  };
  for (const p of Object.values(session.pistes)) demarrerTranche(p, "demarrage");
  surveillerMicro(session.pistes.axion);
  session.minuteur = setInterval(() => {
    if (!session) return;
    const maintenant = Date.now();
    const mesures = {};
    for (const p of Object.values(session.pistes)) {
      mesures[p.nom] = niveau(p.analyseur, p.tampon);
      p.niveaux = noterNiveau(p.niveaux, maintenant, mesures[p.nom]);
    }
    for (const p of Object.values(session.pistes)) relancerSiBesoin(p);
    chrome.runtime.sendMessage({
      type: "niveaux",
      cleClient,
      niveauClient: mesures.client ?? 0,
      niveauAxion: mesures.axion ?? 0,
    });
  }, 1000);
  // Micro débranché puis rebranché : s'il est toujours mort, on le reprend.
  navigator.mediaDevices.addEventListener("devicechange", () => {
    if (!session) return;
    const p = session.pistes.axion;
    if (microMort(p)) void rebrancherMicro(p);
  });
}

function arreter() {
  if (!session) return;
  clearInterval(session.minuteur);
  for (const p of Object.values(session.pistes)) {
    if (p.enregistreur && p.enregistreur.state !== "inactive") p.enregistreur.stop();
    for (const t of p.flux.getTracks()) t.stop();
  }
  const fin = session;
  // Laisser partir les derniers `ondataavailable` / `onstop` avant d'oublier la session.
  setTimeout(() => {
    if (session === fin) session = null;
    if (contexte) contexte.close();
    contexte = null;
  }, 2000);
}

function gain(valeur) {
  if (!session) return;
  for (const p of Object.values(session.pistes)) p.gain.gain.value = valeur;
}

chrome.runtime.onMessage.addListener((msg, _envoyeur, repondre) => {
  if (msg?.cible !== "offscreen") return false;
  if (msg.type === "demarrer") {
    demarrer(msg)
      .then(() => repondre({ ok: true }))
      .catch((e) => repondre({ ok: false, message: String(e?.message ?? e) }));
    return true;
  }
  if (msg.type === "arreter") arreter();
  if (msg.type === "gain") gain(msg.valeur);
  repondre({ ok: true });
  return false;
});
