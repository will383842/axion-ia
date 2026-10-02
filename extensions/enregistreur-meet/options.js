// Options de l'extension : le jeton (relié à la console en un clic — 1.4.0 —
// ou collé à la main, gardé dans `chrome.storage.local`, lisible par
// l'extension seule), l'autorisation du micro, le choix du micro et un test de
// 5 secondes avec vumètre.

import { etatJeton } from "./lib/jeton.js";
import { CLE_LIE_RECEMMENT, lancerLiaison } from "./lib/liaison.js";

const $ = (id) => document.getElementById(id);

async function afficherJeton() {
  const r = await chrome.storage.local.get(["jeton", "jetonExpireLe"]);
  const e = etatJeton(r.jeton, r.jetonExpireLe, Date.now());
  $("etat-jeton").textContent = e.message || "Jeton enregistré.";
  $("etat-jeton").className = e.peutDemarrer ? "ok" : "ko";
}

async function listerMicros() {
  const appareils = await navigator.mediaDevices.enumerateDevices();
  const { micId } = await chrome.storage.local.get(["micId"]);
  const choix = $("micro");
  choix.textContent = "";
  for (const a of appareils.filter((x) => x.kind === "audioinput")) {
    const o = document.createElement("option");
    o.value = a.deviceId;
    o.textContent = a.label || "Micro";
    choix.append(o);
  }
  if (micId) choix.value = micId;
}

$("enregistrer").addEventListener("click", async () => {
  const jeton = $("jeton").value.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(jeton)) {
    $("etat-jeton").textContent = "Ce n'est pas un jeton : 64 caractères de 0 à 9 et de a à f.";
    $("etat-jeton").className = "ko";
    return;
  }
  // Un nouveau jeton efface la date d'expiration de l'ancien : le site la redonnera.
  await chrome.storage.local.set({ jeton, jetonExpireLe: null });
  $("jeton").value = "";
  await afficherJeton();
});

$("relier").addEventListener("click", () => {
  lancerLiaison().catch(() => {
    $("etat-jeton").textContent = "Impossible d'ouvrir la console : réessayez.";
    $("etat-jeton").className = "ko";
  });
});

/** Juste après une liaison : dire l'étape suivante (le micro, imposé par Chrome). */
async function etapeSuivante() {
  const s = await chrome.storage.session.get([CLE_LIE_RECEMMENT]);
  if (!s[CLE_LIE_RECEMMENT]) return;
  await chrome.storage.session.set({ [CLE_LIE_RECEMMENT]: false });
  $("etape-suivante").textContent =
    "Relié à la console. Étape suivante : cliquez « Autoriser le micro », puis lancez le test de 5 secondes.";
  $("etape-suivante").hidden = false;
  $("autoriser").focus();
}

chrome.storage.onChanged.addListener((changements, zone) => {
  if (zone === "local" && changements.jeton) afficherJeton();
  if (zone === "session" && changements[CLE_LIE_RECEMMENT]?.newValue) etapeSuivante();
});

$("autoriser").addEventListener("click", async () => {
  try {
    const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const t of flux.getTracks()) t.stop();
    await listerMicros();
    $("resultat-test").textContent = "Micro autorisé.";
  } catch {
    $("resultat-test").textContent = "Micro refusé : autorisez-le dans les réglages de Chrome.";
  }
});

$("micro").addEventListener("change", (ev) => chrome.storage.local.set({ micId: ev.target.value }));

$("tester").addEventListener("click", async () => {
  const { micId } = await chrome.storage.local.get(["micId"]);
  const flux = await navigator.mediaDevices.getUserMedia({
    audio: micId ? { deviceId: { exact: micId } } : true,
  });
  const ctx = new AudioContext();
  const analyseur = ctx.createAnalyser();
  ctx.createMediaStreamSource(flux).connect(analyseur);
  const tampon = new Float32Array(analyseur.fftSize);
  let maximum = 0;
  const debut = Date.now();
  const minuteur = setInterval(() => {
    analyseur.getFloatTimeDomainData(tampon);
    let s = 0;
    for (const v of tampon) s += v * v;
    const n = Math.sqrt(s / tampon.length);
    maximum = Math.max(maximum, n);
    $("vu").value = n;
    if (Date.now() - debut > 5000) {
      clearInterval(minuteur);
      for (const t of flux.getTracks()) t.stop();
      ctx.close();
      $("resultat-test").textContent =
        maximum > 0.01 ? "Le micro vous entend." : "Aucun son capté : vérifiez le micro choisi.";
    }
  }, 100);
});

afficherJeton();
etapeSuivante();
listerMicros().catch(() => undefined);
