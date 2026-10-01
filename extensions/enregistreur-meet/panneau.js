// Panneau latéral de l'enregistreur : il reste ouvert pendant que Will clique
// dans Meet. Il n'envoie que des GESTES au service worker, qui décide.

import { bandeauPreavis } from "./lib/bandeau-preavis.js";
import { DELAIS_LOCAUX } from "./lib/constantes.js";
import { messageInformation, phraseAnnonce } from "./lib/message-information.js";

const $ = (id) => document.getElementById(id);
let dernierEtat = null;

const LIBELLE_BADGE = {
  piste_client_muette: "Le son du client n'est pas capté.",
  micro_muet: "Votre micro ne capte rien depuis une minute : vérifiez le casque ou le micro.",
  silence: "Aucun son depuis 3 minutes.",
  limite_meet: "À trois, Meet coupe à 1 h : relancez une réunion et recliquez Démarrer.",
  son_coupe: "Son coupé : une personne n'a pas donné son accord.",
};

function geste(type, extra = {}) {
  return chrome.runtime.sendMessage({ type, ...extra });
}

function afficher(id, visible) {
  $(id).classList.toggle("cache", !visible);
}

function rendreRencontres(e) {
  const choix = $("rencontre");
  const actuel = e.rencontreChoisie;
  choix.textContent = "";
  const vide = document.createElement("option");
  vide.value = "";
  vide.textContent = e.rencontres.length
    ? "— Choisir le rendez-vous —"
    : "Aucun rendez-vous aujourd'hui";
  choix.append(vide);
  for (const r of e.rencontres) {
    const o = document.createElement("option");
    o.value = r.rencontreId;
    const heure = r.debutPrevu
      ? new Date(r.debutPrevu).toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Paris",
        })
      : "";
    o.textContent = `${heure} ${r.personne ?? r.titre}${r.entrepriseDeclaree ? ` (${r.entrepriseDeclaree})` : ""}`;
    choix.append(o);
  }
  // Pré-sélection : le rendez-vous choisi, sinon le plus proche de maintenant.
  if (actuel) choix.value = actuel;
  else if (e.rencontres.length) {
    const proche = [...e.rencontres].sort(
      (a, b) =>
        Math.abs(Date.parse(a.debutPrevu ?? 0) - Date.now()) -
        Math.abs(Date.parse(b.debutPrevu ?? 0) - Date.now()),
    )[0];
    choix.value = proche.rencontreId;
    geste("choisir_rencontre", { rencontreId: proche.rencontreId });
  }
  const r = e.rencontres.find((x) => x.rencontreId === choix.value);
  const alerte = $("alerte-rencontre");
  const preavis = bandeauPreavis(r);
  if (preavis) {
    // Client actif sous préavis : le site refuserait, on le dit avant.
    alerte.textContent = preavis;
    afficher("alerte-rencontre", true);
  } else if (r && (r.nonSurCalendly || r.refusAnterieur)) {
    alerte.textContent = r.nonSurCalendly
      ? `Réponse « ${r.reponseCalendly} » à la question sur l'enregistrement : ne pas enregistrer sans un accord explicite.`
      : "Un refus a déjà été exprimé par ce client : ne pas enregistrer sans un accord explicite.";
    afficher("alerte-rencontre", true);
  } else afficher("alerte-rencontre", false);
}

function rendre(e) {
  dernierEtat = e;
  const j = e.jeton;
  $("jeton").textContent = j.message;
  $("jeton").className =
    `bandeau ${j.niveau === "orange" ? "orange" : "rouge"}${j.message ? "" : " cache"}`;
  $("message").textContent = e.message ?? "";
  afficher("message", !!e.message);
  rendreRencontres(e);
  const phase = e.capture.phase;
  afficher("repos", phase === "repos" || phase === "termine" || phase === "detruit");
  afficher("dictee", phase === "repos" || phase === "termine" || phase === "detruit");
  afficher("attente", phase === "accord_en_attente");
  afficher("encours", phase === "en_cours");
  const choisie = e.rencontres.find((x) => x.rencontreId === $("rencontre").value);
  $("demarrer").disabled = !j.peutDemarrer || bandeauPreavis(choisie) !== null;
  // « Oui, enregistrer » cliqué dans la console : le bouton est mis en avant,
  // rien ne démarre sans ce clic (annonce + accord avant toute capture).
  $("demarrer").classList.toggle("mis-en-avant", e.miseEnAvant === true);
  afficher("prepare", e.miseEnAvant === true && phase === "repos");
  $("pause").textContent = e.capture.enPause ? "Reprendre" : "Pause";
  $("badges").textContent = "";
  for (const b of e.capture.badges ?? []) {
    const d = document.createElement("div");
    d.className = "bandeau orange";
    d.textContent = LIBELLE_BADGE[b] ?? b;
    $("badges").append(d);
  }
}

function tic() {
  const c = dernierEtat?.capture;
  if (c?.phase === "accord_en_attente") {
    const reste = Math.max(0, DELAIS_LOCAUX.accordMaxMs - (Date.now() - c.debutMs));
    const s = Math.ceil(reste / 1000);
    $("rebours").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "etat") rendre(msg);
  if (msg?.type === "niveaux") {
    $("vu-client").value = msg.niveauClient;
    $("vu-axion").value = msg.niveauAxion;
  }
});

$("phrase").textContent = phraseAnnonce();
$("actualiser").addEventListener("click", () => geste("actualiser"));
$("rencontre").addEventListener("change", (ev) =>
  geste("choisir_rencontre", { rencontreId: ev.target.value || null, manuel: true }),
);
$("creer").addEventListener("click", () => geste("ouvrir_console", { rencontreId: null }));
$("demarrer").addEventListener("click", () => {
  const r = dernierEtat?.rencontres.find((x) => x.rencontreId === $("rencontre").value);
  if (r && (r.nonSurCalendly || r.refusAnterieur)) {
    // Confirmation de plus : le client a dit « non » par écrit, ou a déjà refusé.
    if (
      !window.confirm(
        "Ce client a refusé l'enregistrement par écrit ou lors d'un rendez-vous précédent. Démarrer quand même, pour lui demander à nouveau ?",
      )
    )
      return;
  }
  geste("demarrer");
});
$("dicter").addEventListener("click", () => geste("demarrer_dictee"));
$("accord").addEventListener("click", () => geste("accord"));
$("refus").addEventListener("click", () => geste("refus"));
$("refus2").addEventListener("click", () => geste("refus"));
$("pause").addEventListener("click", () =>
  geste(dernierEtat?.capture.enPause ? "reprendre" : "pause"),
);
$("nouvelle").addEventListener("click", () => geste("nouvelle_personne"));
$("arreter").addEventListener("click", () => geste("arreter"));
$("copier").addEventListener("click", async () => {
  await navigator.clipboard.writeText(messageInformation());
  $("copier").textContent = "Copié : collez-le dans le chat Meet";
  setTimeout(() => ($("copier").textContent = "Copier le message d'information"), 3000);
});

setInterval(tic, 500);
geste("lire_etat");
geste("actualiser");
