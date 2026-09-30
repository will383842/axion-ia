// Service worker de l'enregistreur Meet (chantier visio, PR 5) : orchestration.
//
//   · reçoit les gestes du panneau latéral (démarrer, accord, refus, pause,
//     arrêter, nouvelle personne) et les niveaux du document offscreen ;
//   · applique la machine d'états PURE (`lib/etats-capture.js`) et exécute ses
//     actions ;
//   · vide la file d'envoi (`lib/file-envoi.js`) vers le site — RIEN ne part
//     avant l'accord — avec nouvel essai et délai doublé ;
//   · bat toutes les 5 minutes (versions, file locale ; aucun nom, aucun texte).
//
// Il ne connaît qu'une adresse : `lib/api.js` (https://axion-ia.com/api/enregistreur/).

import { appeler, urlDe } from "./lib/api.js";
import {
  DELAIS_LOCAUX,
  VERSION_CONTRAT,
  VERSION_EXTENSION,
  VERSION_TEXTE_ANNONCE,
} from "./lib/constantes.js";
import * as capture from "./lib/etats-capture.js";
import {
  capturesADetruire,
  classerReponse,
  delaiRenvoi,
  elementRefus,
  envoyablesMaintenant,
  interpreterReponseSession,
} from "./lib/file-envoi.js";
import { etatJeton, jetonRefuseParLeSite } from "./lib/jeton.js";
import { entetesDuMorceau } from "./lib/tranches.js";
import {
  ajouterALaFile,
  detruireCapture,
  ecrireCapture,
  lireCaptures,
  lireLaFile,
  mesurerLaFile,
  mettreAJourElement,
  retirerDeLaFile,
} from "./stockage-local.js";

const etat = {
  capture: capture.etatInitial(),
  jeton: null,
  jetonExpireLe: null,
  micId: null,
  rencontres: [],
  rencontreChoisie: null,
  ongletMeet: null,
  nbParticipants: 2,
  message: "",
  mode: null,
  miseAJourEnAttente: false,
};

// ── Réglages et état persistant ─────────────────────────────────────────────

async function chargerReglages() {
  const r = await chrome.storage.local.get(["jeton", "jetonExpireLe", "micId"]);
  etat.jeton = r.jeton ?? null;
  etat.jetonExpireLe = r.jetonExpireLe ?? null;
  etat.micId = r.micId ?? null;
  const s = await chrome.storage.session.get(["capture", "rencontreChoisie", "ongletMeet"]);
  if (s.capture) etat.capture = s.capture;
  etat.rencontreChoisie = s.rencontreChoisie ?? null;
  etat.ongletMeet = s.ongletMeet ?? null;
}

async function memoriser() {
  await chrome.storage.session.set({
    capture: etat.capture,
    rencontreChoisie: etat.rencontreChoisie,
    ongletMeet: etat.ongletMeet,
  });
}

function diffuser() {
  const j = etatJeton(etat.jeton, etat.jetonExpireLe, Date.now());
  chrome.runtime
    .sendMessage({
      type: "etat",
      capture: etat.capture,
      rencontres: etat.rencontres,
      rencontreChoisie: etat.rencontreChoisie,
      jeton: j,
      message: etat.message,
      mode: etat.mode,
    })
    .catch(() => undefined);
}

// ── Document offscreen ──────────────────────────────────────────────────────

async function assurerOffscreen() {
  const existe = await chrome.offscreen.hasDocument();
  if (existe) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification:
      "Enregistrer le son de l'onglet Meet et du micro, avec l'accord des participants.",
  });
}

function versOffscreen(message) {
  return chrome.runtime.sendMessage({ cible: "offscreen", ...message }).catch(() => undefined);
}

// ── Actions de la machine d'états ───────────────────────────────────────────

async function executer(actions) {
  const c = etat.capture;
  for (const a of actions) {
    switch (a.type) {
      case "refuser":
        etat.message = a.message;
        break;
      case "demarrer_capture": {
        await assurerOffscreen();
        // Dictée (PR 7) : micro seul, aucun onglet capturé.
        const streamId = a.micSeul
          ? null
          : await chrome.tabCapture.getMediaStreamId({ targetTabId: etat.ongletMeet });
        const r = await versOffscreen({
          type: "demarrer",
          streamId,
          micSeul: a.micSeul === true,
          cleClient: c.cleClient,
          micId: etat.micId,
        });
        if (!r?.ok) {
          etat.message = "La capture n'a pas démarré (micro non autorisé ? voir les options).";
          await executer(
            capture.refus(c, Date.now()).actions.filter((x) => x.type !== "declarer_refus"),
          );
          etat.capture = capture.etatInitial();
        }
        break;
      }
      case "creer_session":
        await ecrireCapture({
          cleClient: c.cleClient,
          nature: a.nature === "dictee" ? "dictee" : "visio",
          rencontreId: c.rencontreId,
          enregistrementId: null,
          accordLe: null,
          debutMs: a.debutMs,
          finMs: null,
          detruit: false,
        });
        if (c.rencontreId) await mettreSessionEnFile(c.cleClient);
        break;
      case "declarer_accord": {
        const captures = await lireCaptures();
        const k = captures[c.cleClient];
        if (!k) break;
        if (!a.nouvellePersonne) await ecrireCapture({ ...k, accordLe: a.accordLe });
        // Sans session côté site, l'accord partira DANS la création (rejoué).
        if (k.enregistrementId || a.nouvellePersonne) {
          await ajouterALaFile({
            id: `${c.cleClient}:accord:${a.accordLe}`,
            type: "accord",
            cleClient: c.cleClient,
            creeLe: Date.now(),
            corps: {
              accordLe: new Date(a.accordLe).toISOString(),
              nbParticipants: etat.nbParticipants,
              versionTexte: VERSION_TEXTE_ANNONCE,
              nouvellePersonne: a.nouvellePersonne === true,
            },
            essais: 0,
          });
        }
        break;
      }
      case "declarer_refus": {
        const captures = await lireCaptures();
        const k = captures[c.cleClient];
        if (!k) break;
        // Marqué sur la capture : si la création de la session était en vol,
        // sa réponse (plus tard) déclenchera le refus de l'enregistrement créé.
        await ecrireCapture({ ...k, refuseLe: a.refusLe });
        if (k.enregistrementId) {
          // Un élément de file qui SURVIT à la destruction locale, renvoyé
          // jusqu'au 2xx (réseau coupé, site en déploiement, R2 en panne).
          await ajouterALaFile(elementRefus(k.enregistrementId, a.refusLe, Date.now()));
          viderFile();
        }
        break;
      }
      case "detruire_local":
        await versOffscreen({ type: "arreter" });
        await detruireCapture(a.cleClient);
        break;
      case "arreter_capture":
        await versOffscreen({ type: "arreter" });
        break;
      case "terminer_session": {
        const captures = await lireCaptures();
        const k = captures[c.cleClient];
        if (k) await ecrireCapture({ ...k, finMs: a.finLe });
        // La fin part APRÈS les derniers morceaux (tri par date de création).
        setTimeout(() => {
          ajouterALaFile({
            id: `${c.cleClient}:fin`,
            type: "fin",
            cleClient: c.cleClient,
            creeLe: Date.now(),
            corps: {
              finLe: new Date(a.finLe).toISOString(),
              motif: a.motif,
              perdus: [],
              fenetresHorsAccord: a.fenetresHorsAccord,
              evenements: (c.journal ?? []).slice(-2000),
            },
            essais: 0,
          }).then(viderFile);
        }, 4000);
        break;
      }
      case "gain":
        await versOffscreen({ type: "gain", valeur: a.valeur });
        break;
      case "notifier":
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icone.png",
          title: "Enregistreur Axion-IA",
          message: a.message,
        });
        break;
      case "journal":
        etat.capture = {
          ...etat.capture,
          journal: [
            ...(etat.capture.journal ?? []),
            { le: new Date().toISOString(), type: a.evenement },
          ],
        };
        break;
      case "vider_file":
        viderFile();
        break;
      default:
        break;
    }
  }
}

async function appliquer(resultat) {
  etat.capture = resultat.etat;
  await executer(resultat.actions);
  await memoriser();
  diffuser();
}

async function mettreSessionEnFile(cleClient) {
  await ajouterALaFile({
    id: `${cleClient}:session`,
    type: "session",
    cleClient,
    creeLe: Date.now(),
    essais: 0,
  });
  viderFile();
}

// ── File d'envoi ────────────────────────────────────────────────────────────

let envoiEnCours = false;

async function envoyer(el, k) {
  const id = k?.enregistrementId ?? el.enregistrementId;
  switch (el.type) {
    case "refus":
      return appeler({ route: `sessions/${id}/refus`, jeton: etat.jeton, json: el.corps });
    case "session":
      return appeler({
        route: "sessions",
        jeton: etat.jeton,
        json: {
          cleClient: el.cleClient,
          rencontreId: k.rencontreId,
          nature: k.nature === "dictee" ? "dictee" : "visio",
          versionExtension: VERSION_EXTENSION,
          debutLe: new Date(k.debutMs).toISOString(),
          accordLocalLe: k.accordLe ? new Date(k.accordLe).toISOString() : null,
          nbParticipants: etat.nbParticipants,
        },
      });
    case "accord":
      return appeler({ route: `sessions/${id}/accord`, jeton: etat.jeton, json: el.corps });
    case "morceau":
      return appeler({
        route: `sessions/${id}/morceaux`,
        jeton: etat.jeton,
        methode: "PUT",
        octets: el.octets,
        entetes: entetesDuMorceau(el),
      });
    case "tranche":
      return appeler({ route: `sessions/${id}/tranches`, jeton: etat.jeton, json: el.corps });
    case "fin":
      return appeler({ route: `sessions/${id}/fin`, jeton: etat.jeton, json: el.corps });
    default:
      return { statut: 400, corps: null };
  }
}

async function viderFile() {
  if (envoiEnCours || !etat.jeton) return;
  envoiEnCours = true;
  try {
    const maintenant = Date.now();
    const captures = await lireCaptures();
    const vue = Object.fromEntries(
      Object.entries(captures).map(([cle, k]) => [
        cle,
        {
          // Une dictée (PR 7) n'a pas d'accord à attendre : son son part avec sa session.
          accord: !!k.accordLe || k.nature === "dictee",
          enregistrementId: k.enregistrementId,
          detruit: k.detruit,
        },
      ]),
    );
    const file = envoyablesMaintenant(await lireLaFile(), vue, maintenant);
    for (const el of file) {
      // Relu AVANT CHAQUE ENVOI : un refus a pu détruire la capture pendant
      // que la boucle travaillait sur sa copie (les PUT continuaient).
      const k = el.type === "refus" ? null : (await lireCaptures())[el.cleClient];
      if (el.type !== "refus" && (!k || k.detruit)) continue;
      const r = await envoyer(el, k);
      if (el.type === "session") {
        const s = interpreterReponseSession(r.statut, r.corps);
        if (s.etat === "ok") {
          const frais = (await lireCaptures())[el.cleClient] ?? k;
          // Jamais `{ ...k }` : ce serait ressusciter une capture détruite.
          captures[el.cleClient] = { ...frais, enregistrementId: s.enregistrementId };
          await ecrireCapture(captures[el.cleClient]);
          await retirerDeLaFile(el.id);
          if (frais.detruit && frais.refuseLe) {
            // Refus cliqué pendant que la création était en vol.
            await ajouterALaFile(elementRefus(s.enregistrementId, frais.refuseLe, Date.now()));
          }
          if (etat.capture.cleClient === el.cleClient) {
            etat.capture = { ...etat.capture, enregistrementId: s.enregistrementId };
          }
          // La vue a changé : on reprend la file avec le nouvel identifiant.
          envoiEnCours = false;
          return viderFile();
        }
        if (s.etat === "refuse") {
          etat.message =
            s.message || "Le site refuse d'enregistrer ce rendez-vous : le son est détruit.";
          if (etat.capture.cleClient === el.cleClient) {
            await appliquer({
              etat: { ...etat.capture, phase: "detruit" },
              actions: [{ type: "arreter_capture" }],
            });
          }
          await detruireCapture(el.cleClient);
          continue;
        }
      }
      const suite = classerReponse(el.type, r.statut, r.corps?.erreur);
      if (suite === "fait" || suite === "abandonner") {
        await retirerDeLaFile(el.id);
      } else if (suite === "detruire") {
        // La capture en cours s'arrête aussi (préavis d'un client actif,
        // enregistrement clos) : le message du site est montré tel quel.
        if (r.corps?.message) etat.message = r.corps.message;
        if (etat.capture.cleClient === el.cleClient && etat.capture.phase !== "detruit") {
          await appliquer({
            etat: { ...etat.capture, phase: "detruit" },
            actions: [{ type: "arreter_capture" }],
          });
        }
        await detruireCapture(el.cleClient);
      } else if (suite === "jeton") {
        if (jetonRefuseParLeSite(r.statut)) {
          etat.message = r.corps?.message ?? "Jeton refusé par le site.";
          await chrome.storage.local.set({ jetonExpireLe: new Date(0).toISOString() });
          etat.jetonExpireLe = new Date(0).toISOString();
        }
        break;
      } else {
        const essais = (el.essais ?? 0) + 1;
        await mettreAJourElement({
          ...el,
          essais,
          prochainEssaiMs: maintenant + delaiRenvoi(essais),
        });
      }
    }
    // Cas A : aucune rencontre autorisée 24 h après la fin → destruction.
    for (const cle of capturesADetruire(captures, maintenant)) await detruireCapture(cle);
  } finally {
    envoiEnCours = false;
    diffuser();
  }
}

// ── Mesures pendant la capture ──────────────────────────────────────────────

function compterParticipants() {
  const ids = new Set();
  for (const n of document.querySelectorAll("[data-participant-id]")) {
    ids.add(n.getAttribute("data-participant-id"));
  }
  return ids.size;
}

async function mesurerLaSalle() {
  if (!etat.ongletMeet) return { dansLaSalle: false, nb: etat.nbParticipants };
  try {
    const onglet = await chrome.tabs.get(etat.ongletMeet);
    const dansLaSalle = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/.test(
      onglet.url ?? "",
    );
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: etat.ongletMeet },
      func: compterParticipants,
    });
    const nb = typeof res?.result === "number" && res.result > 0 ? res.result : etat.nbParticipants;
    return { dansLaSalle, nb };
  } catch {
    return { dansLaSalle: false, nb: etat.nbParticipants };
  }
}

let derniereMesureSalle = 0;
let derniereSalle = { dansLaSalle: true, nb: 2 };
let dernierBattementSession = 0;

async function surNiveaux(msg) {
  const maintenant = Date.now();
  if (maintenant - derniereMesureSalle > 15000) {
    derniereMesureSalle = maintenant;
    derniereSalle = await mesurerLaSalle();
    etat.nbParticipants = derniereSalle.nb;
  }
  const r = capture.tic(
    etat.capture,
    {
      niveauClient: msg.niveauClient,
      niveauAxion: msg.niveauAxion,
      nbParticipants: derniereSalle.nb,
      dansLaSalle: derniereSalle.dansLaSalle,
    },
    maintenant,
  );
  if (r.actions.length > 0 || r.etat.phase !== etat.capture.phase) await appliquer(r);
  else etat.capture = r.etat;
  chrome.runtime
    .sendMessage({
      type: "niveaux",
      niveauClient: msg.niveauClient,
      niveauAxion: msg.niveauAxion,
      badges: etat.capture.badges ?? [],
    })
    .catch(() => undefined);

  // Battement de session (hors file : un battement perdu ne se rejoue pas).
  if (
    etat.capture.enregistrementId &&
    maintenant - dernierBattementSession > DELAIS_LOCAUX.battementSessionMs
  ) {
    dernierBattementSession = maintenant;
    appeler({
      route: `sessions/${etat.capture.enregistrementId}/battement`,
      jeton: etat.jeton,
      json: { le: new Date(maintenant).toISOString(), enPause: etat.capture.enPause === true },
    });
  }
}

// ── Gestes du panneau ───────────────────────────────────────────────────────

async function ongletMeetActif() {
  const [onglet] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
    url: "https://meet.google.com/*",
  });
  return onglet?.id ?? null;
}

async function actualiserRencontres() {
  if (!etat.jeton) return;
  const r = await appeler({ route: "rencontres-du-jour", jeton: etat.jeton });
  if (r.statut === 200 && r.corps) {
    etat.rencontres = r.corps.rencontres ?? [];
    etat.mode = r.corps.mode ?? null;
    etat.jetonExpireLe = r.corps.jetonExpireLe ?? etat.jetonExpireLe;
    await chrome.storage.local.set({ jetonExpireLe: etat.jetonExpireLe });
    etat.message = "";
  } else if (jetonRefuseParLeSite(r.statut)) {
    etat.message = r.corps?.message ?? "Jeton refusé par le site.";
  } else if (r.statut === 503) {
    etat.message = r.corps?.message ?? "L'enregistrement n'est pas ouvert sur le site.";
  } else if (r.statut === 0) {
    etat.message = "Site injoignable : la capture reste possible, l'envoi attendra.";
  }
  diffuser();
}

async function surGeste(msg) {
  const maintenant = Date.now();
  switch (msg.type) {
    case "lire_etat":
      diffuser();
      return;
    case "actualiser":
      await actualiserRencontres();
      return;
    case "choisir_rencontre": {
      etat.rencontreChoisie = msg.rencontreId;
      // Capture commencée sans rencontre : elle s'y rattache, rien n'est perdu.
      const c = etat.capture;
      if (c.cleClient && !c.rencontreId && c.phase !== "detruit") {
        etat.capture = { ...c, rencontreId: msg.rencontreId };
        const captures = await lireCaptures();
        const k = captures[c.cleClient];
        if (k) {
          await ecrireCapture({ ...k, rencontreId: msg.rencontreId });
          await mettreSessionEnFile(c.cleClient);
        }
      }
      await memoriser();
      diffuser();
      return;
    }
    case "demarrer": {
      await chargerReglages();
      etat.ongletMeet = await ongletMeetActif();
      if (!etat.ongletMeet) {
        etat.message = "Ouvrez d'abord l'onglet Google Meet de l'appel.";
        diffuser();
        return;
      }
      await appliquer(
        capture.demarrer(
          etat.capture,
          {
            jeton: etat.jeton,
            jetonExpireLe: etat.jetonExpireLe,
            cleClient: crypto.randomUUID(),
            rencontreId: etat.rencontreChoisie,
            nbParticipants: 2,
          },
          maintenant,
        ),
      );
      return;
    }
    case "demarrer_dictee": {
      await chargerReglages();
      await appliquer(
        capture.demarrerDictee(
          etat.capture,
          {
            jeton: etat.jeton,
            jetonExpireLe: etat.jetonExpireLe,
            cleClient: crypto.randomUUID(),
            rencontreId: etat.rencontreChoisie,
          },
          maintenant,
        ),
      );
      return;
    }
    case "accord":
      await appliquer(capture.accordObtenu(etat.capture, maintenant));
      return;
    case "refus":
      await appliquer(capture.refus(etat.capture, maintenant));
      return;
    case "pause":
      await appliquer(capture.pause(etat.capture));
      return;
    case "reprendre":
      await appliquer(capture.reprendre(etat.capture));
      return;
    case "arreter":
      await appliquer(capture.arreter(etat.capture, maintenant));
      if (etat.miseAJourEnAttente) chrome.runtime.reload();
      return;
    case "nouvelle_personne":
      await appliquer(capture.nouvellePersonneAccord(etat.capture, maintenant));
      return;
    case "ouvrir_console": {
      const suffixe =
        msg.rencontreId && /^[0-9a-f-]{36}$/.test(msg.rencontreId)
          ? `?rencontre=${msg.rencontreId}`
          : "";
      chrome.tabs.create({ url: urlDe("ouvrir") + suffixe });
      return;
    }
    default:
      return;
  }
}

// ── Écouteurs ───────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
  chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" }).catch(() => undefined);
  chrome.alarms.create("battement-appareil", {
    periodInMinutes: DELAIS_LOCAUX.battementAppareilMs / 60000,
  });
  chrome.alarms.create("file", { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(() => {
  chargerReglages().then(viderFile);
});

chrome.alarms.onAlarm.addListener(async (alarme) => {
  await chargerReglages();
  if (alarme.name === "file") viderFile();
  if (alarme.name === "battement-appareil" && etat.jeton) {
    const f = await mesurerLaFile(Date.now());
    const r = await appeler({
      route: "appareil/battement",
      jeton: etat.jeton,
      json: {
        versionExtension: VERSION_EXTENSION,
        versionContrat: VERSION_CONTRAT,
        fileEnAttente: f.fileEnAttente,
        agePlusVieuxMs: f.agePlusVieuxMs,
        sessionActive:
          etat.capture.phase === "en_cours" || etat.capture.phase === "accord_en_attente",
      },
    });
    if (r.statut === 200 && r.corps?.jetonExpireLe) {
      etat.jetonExpireLe = r.corps.jetonExpireLe;
      await chrome.storage.local.set({ jetonExpireLe: etat.jetonExpireLe });
    }
  }
});

// Une mise à jour de l'extension attend la fin de la capture.
chrome.runtime.onUpdateAvailable.addListener(() => {
  const active = etat.capture.phase === "en_cours" || etat.capture.phase === "accord_en_attente";
  if (active) etat.miseAJourEnAttente = true;
  else chrome.runtime.reload();
});

// Messages INTERNES seulement (panneau, options, offscreen). Aucun
// `onMessageExternal` : aucune page web ne peut piloter l'enregistreur.
chrome.runtime.onMessage.addListener((msg, envoyeur, repondre) => {
  if (envoyeur.id !== chrome.runtime.id || msg?.cible === "offscreen") return false;
  const traitement =
    msg.type === "niveaux"
      ? surNiveaux(msg)
      : msg.type === "tranche_terminee"
        ? viderFile()
        : surGeste(msg);
  Promise.resolve(traitement).finally(() => repondre({ ok: true }));
  return true;
});

chargerReglages();
