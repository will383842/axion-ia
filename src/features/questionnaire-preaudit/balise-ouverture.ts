/**
 * La balise d'OUVERTURE du questionnaire avant audit (2026-10-27) — module PUR.
 *
 * Quelques lignes de JavaScript ajoutées à la page (aucune bibliothèque, aucun traceur tiers) :
 *   · rien tant que la page n'est pas chargée (`load`) ET visible depuis 3 s : un scanner de
 *     messagerie qui télécharge le lien sans exécuter le script, un préchargement, un onglet
 *     ouvert en arrière-plan et jamais regardé ne se signalent pas ;
 *   · `navigator.webdriver` (navigateur piloté) : rien ;
 *   · étape 1 une fois, puis étape 2 au premier champ touché ;
 *   · le corps : `{ m, s, etape, t }` — le code et le parcours du LIEN (comme le brouillon) et le
 *     temps écoulé depuis le chargement. Ni cookie, ni stockage, ni identifiant.
 * Envoi en `text/plain` (requête simple, sans prévol) vers l'adresse du questionnaire.
 */

import { DELAI_MIN_MS } from "./ouvertures";

/** JSON sûr dans un `<script>` (même règle que `html.ts`). */
function jsonSur(valeur: unknown): string {
  return JSON.stringify(valeur)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(new RegExp(" ", "g"), "\\u2028")
    .replace(new RegExp(" ", "g"), "\\u2029");
}

export function scriptBaliseOuverture(endpoint: string): string {
  return (
    "<script>(function(){try{" +
    `var E=${jsonSur(endpoint)},D=${DELAI_MIN_MS},u=new URLSearchParams(location.search),vu={},pret=0,touche=0,minuteur=0;` +
    "if(navigator.webdriver)return;" +
    'function envoyer(e){if(vu[e])return;vu[e]=1;try{fetch(E,{method:"POST",keepalive:true,' +
    'headers:{"Content-Type":"text/plain"},body:JSON.stringify({m:u.get("m")||"",' +
    's:u.get("s")||u.get("mode")||"",etape:e,t:Math.round(performance.now())})})' +
    "['catch'](function(){})}catch(x){}}" +
    "function attendre(){if(pret||minuteur||document.visibilityState!=='visible')return;" +
    "minuteur=setTimeout(function(){minuteur=0;if(document.visibilityState!=='visible')return;" +
    "pret=1;envoyer(1);if(touche)envoyer(2)},D)}" +
    "function premier(){touche=1;if(pret)envoyer(2)}" +
    "document.addEventListener('visibilitychange',function(){if(document.visibilityState!=='visible'&&minuteur){clearTimeout(minuteur);minuteur=0}attendre()});" +
    "document.addEventListener('input',premier,true);document.addEventListener('change',premier,true);" +
    "if(document.readyState==='complete')attendre();else addEventListener('load',attendre);" +
    "}catch(x){}})();</script>"
  );
}

const echapper = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Ce qui s'ajoute en bas de la page : la notice du suivi (si elle a des phrases) et la balise
 * (si une adresse est donnée). Vide quand les deux interrupteurs sont éteints.
 */
export function ajoutsSuivi(o: {
  readonly endpoint: string | null;
  readonly titre: string;
  readonly phrases: ReadonlyArray<string>;
}): string {
  const notice =
    o.phrases.length === 0
      ? ""
      : '<aside role="note" aria-label="' +
        echapper(o.titre) +
        '" style="max-width:760px;margin:24px auto;padding:12px 16px;border-top:1px solid #ddd;' +
        'color:#555;font:400 13px/1.5 system-ui,sans-serif"><strong>' +
        echapper(o.titre) +
        "</strong>" +
        o.phrases.map((p) => `<p style="margin:6px 0 0">${echapper(p)}</p>`).join("") +
        "</aside>";
  return notice + (o.endpoint === null ? "" : scriptBaliseOuverture(o.endpoint));
}
