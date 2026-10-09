/**
 * LE SCRIPT DE LA PAGE DE DÉPÔT d'un lien privé (Candidatures unifiées L5b).
 *
 * Servi à part par `/api/partage/script-depot` (même origine, `script-src 'self'`),
 * chargé SEULEMENT par la page `…/deposer` — jamais par la page de
 * téléchargement, qui reste sans script. Écrit en JavaScript simple, sans
 * dépendance ni React : il n'entre dans aucun paquet du site et pèse quelques ko.
 *
 * Ce qu'il fait :
 *   1. refuse sur place un fichier de plus de 4 Go (le serveur le refuse aussi,
 *      AVANT le premier morceau) ;
 *   2. `commencer` (nom, taille, 16 premiers octets) → `signer` par lots de 24
 *      → envoi des morceaux de 64 Mio en `PUT` direct vers le stockage, trois à la
 *      fois, chaque morceau retenté trois fois → `terminer` ;
 *   3. une coupure : « Envoyer » une seconde fois appelle `reprendre`, et seuls
 *      les morceaux manquants repartent. Si la reprise échoue (réseau, 429,
 *      5xx), l'envoi est gardé pour le clic suivant ; seul un refus du serveur
 *      (400/404 : envoi introuvable ou terminé) en ouvre un nouveau, et le
 *      serveur plafonne les envois par lien (`DEPOTS_PAR_LIEN_MAX`).
 *
 * Aucun cookie (`credentials: "omit"`), aucun référent (`no-referrer`) : le jeton
 * du lien ne quitte jamais l'adresse de la page.
 */

export const SCRIPT_DEPOT = String.raw`(function () {
  "use strict";
  var form = document.getElementById("depot");
  if (!form || !window.fetch || !window.Promise) return;
  var action = form.getAttribute("data-action");
  var max = Number(form.getAttribute("data-max"));
  var champ = document.getElementById("fichier");
  var bouton = document.getElementById("envoyer");
  var barre = document.getElementById("barre");
  var etat = document.getElementById("etat");
  var PARALLELES = 3, LOT = 24, ESSAIS = 3;
  var courant = null;
  var actif = false;

  function dire(t) { etat.textContent = t; }
  function attendre(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function lisible(o) {
    function f(n, d) { return n.toLocaleString("fr-FR", { maximumFractionDigits: d }); }
    if (o >= 1e9) return f(o / 1e9, 1) + " Go";
    if (o >= 1e6) return f(o / 1e6, o >= 1e8 ? 0 : 1) + " Mo";
    if (o >= 1e3) return f(o / 1e3, 0) + " ko";
    return o + " octets";
  }
  function base64(buf) {
    var a = new Uint8Array(buf), s = "";
    for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return btoa(s);
  }
  function lireDebut(fichier) {
    var b = fichier.slice(0, 16);
    if (b.arrayBuffer) return b.arrayBuffer();
    return new Promise(function (ok, ko) {
      var r = new FileReader();
      r.onload = function () { ok(r.result); };
      r.onerror = function () { ko(new Error("Ce fichier ne peut pas être lu.")); };
      r.readAsArrayBuffer(b);
    });
  }
  function appeler(corps) {
    return fetch(action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer"
    }).then(function (r) {
      return r.json().then(function (j) {
        if (j && typeof j === "object") j.statut = r.status;
        return j;
      }, function () {
        return { ok: false, statut: r.status, erreur: "Le service ne répond pas pour le moment." };
      });
    }, function () {
      return { ok: false, statut: 0, erreur: "La connexion a été interrompue." };
    });
  }
  function exiger(r) {
    if (!r || !r.ok) throw new Error((r && r.erreur) || "Une erreur est survenue.");
    return r;
  }
  function envoyerMorceau(url, morceau, essai) {
    return fetch(url, { method: "PUT", body: morceau, credentials: "omit", referrerPolicy: "no-referrer" })
      .then(function (r) { if (!r.ok) throw new Error("stockage " + r.status); })
      .then(null, function () {
        if (essai + 1 >= ESSAIS) throw new Error("La connexion a été interrompue pendant l'envoi.");
        return attendre(2000 * (essai + 1)).then(function () { return envoyerMorceau(url, morceau, essai + 1); });
      });
  }
  function commencer(fichier) {
    return lireDebut(fichier).then(function (b) {
      return appeler({ etape: "commencer", nom: fichier.name, taille: fichier.size, entete: base64(b) });
    }).then(exiger).then(function (r) {
      courant = { fichier: fichier, id: r.fichierId };
      return { id: r.fichierId, tailleMorceau: r.tailleMorceau, n: r.nombreMorceaux, recus: [] };
    });
  }
  function demarrer(fichier) {
    if (!courant || courant.fichier !== fichier) return commencer(fichier);
    var id = courant.id;
    return appeler({ etape: "reprendre", fichierId: id }).then(function (r) {
      if (!r || !r.ok) {
        // Le serveur dit que cet envoi ne se reprend plus (introuvable, terminé,
        // expiré) : on en ouvre UN nouveau — le serveur en borne le nombre par lien.
        if (r && (r.statut === 400 || r.statut === 404)) { courant = null; return commencer(fichier); }
        // Coupure, trop de demandes, panne passagère : l'envoi en cours est
        // GARDÉ, le prochain clic le reprend. Jamais un nouvel envoi par échec.
        exiger(r);
      }
      return { id: id, tailleMorceau: r.tailleMorceau, n: r.nombreMorceaux, recus: r.recus || [] };
    });
  }
  function envoyer(fichier, plan) {
    function tailleDe(k) { return k < plan.n ? plan.tailleMorceau : fichier.size - (plan.n - 1) * plan.tailleMorceau; }
    var restants = [], faits = 0, i;
    for (i = 1; i <= plan.n; i++) {
      if (plan.recus.indexOf(i) < 0) restants.push(i); else faits += tailleDe(i);
    }
    function progres() {
      barre.hidden = false;
      barre.value = Math.floor((faits * 100) / fichier.size);
      dire("Envoi en cours : " + barre.value + " % (" + lisible(faits) + " sur " + lisible(fichier.size) + "). Gardez cette page ouverte.");
    }
    progres();
    var lots = [];
    for (i = 0; i < restants.length; i += LOT) lots.push(restants.slice(i, i + LOT));
    return lots.reduce(function (p, lot) {
      return p.then(function () {
        return appeler({ etape: "signer", fichierId: plan.id, numeros: lot }).then(exiger).then(function (r) {
          var file = r.morceaux.slice();
          function suivant() {
            var m = file.shift();
            if (!m) return Promise.resolve();
            var debut = (m.numero - 1) * plan.tailleMorceau;
            return envoyerMorceau(m.url, fichier.slice(debut, debut + tailleDe(m.numero)), 0).then(function () {
              faits += tailleDe(m.numero);
              progres();
              return suivant();
            });
          }
          var w = [];
          for (var k = 0; k < PARALLELES; k++) w.push(suivant());
          return Promise.all(w);
        });
      });
    }, Promise.resolve());
  }
  function fin() { actif = false; bouton.disabled = false; champ.disabled = false; }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (actif) return;
    var fichier = champ.files && champ.files[0];
    if (!fichier) { dire("Choisissez d'abord un fichier."); return; }
    if (fichier.size > max) { dire("Ce fichier dépasse 4 Go : il ne peut pas être déposé ici. Écrivez-nous pour convenir d'un autre moyen."); return; }
    if (fichier.size < 1) { dire("Ce fichier est vide."); return; }
    if (fichier.size > 500000000 && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || "") &&
        !window.confirm("Ce fichier pèse " + lisible(fichier.size) + ". Sur un téléphone, restez en Wi-Fi et gardez l'écran allumé pendant l'envoi. Continuer ?")) return;
    actif = true; bouton.disabled = true; champ.disabled = true;
    dire("Préparation de l'envoi…");
    demarrer(fichier).then(function (plan) {
      return envoyer(fichier, plan).then(function () {
        dire("Vérification du fichier reçu…");
        return appeler({ etape: "terminer", fichierId: plan.id }).then(exiger);
      });
    }).then(function () {
      courant = null;
      barre.value = 100;
      dire("Merci : votre fichier est bien arrivé. L'équipe Axion-IA le regardera après son analyse antivirus.");
      form.reset();
      fin();
    }, function (e) {
      dire(e.message + " Cliquez à nouveau sur « Envoyer » pour reprendre.");
      fin();
    });
  });
  window.addEventListener("beforeunload", function (e) {
    if (actif) { e.preventDefault(); e.returnValue = ""; }
  });
})();
`;
