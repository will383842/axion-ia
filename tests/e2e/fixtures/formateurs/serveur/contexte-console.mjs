// Banc @formateurs — le CONTEXTE d'une action de console, pour l'exécuteur `tsx`.
//
// Les actions de la console (« Ajouter un candidat », « Retenu », « Contresigner »…)
// sont appelées TELLES QUELLES : leur garde de session, leurs habilitations, leurs
// transactions et leurs envois s'exécutent. Seul ce qu'une action reçoit de Next
// est remplacé, parce qu'il n'existe pas hors d'une requête :
//   · `server-only` → module vide (le marqueur lève hors du bundler) ;
//   · `@/auth`      → la session déclarée par le spec (`doublures/auth.mjs`) ;
//   · `next/headers`, `next/cache` → une requête sans cookie, une invalidation vide.
// Ni l'horloge ni le réseau ne passent par ici.
import { register } from "node:module";

const ICI = new URL("./doublures/", import.meta.url).href;
const code = `
const DOUBLURES = {
  "server-only": "data:text/javascript,",
  "next/headers": "${ICI}next-headers.mjs",
  "next/headers.js": "${ICI}next-headers.mjs",
  "next/cache": "${ICI}next-cache.mjs",
  "next/cache.js": "${ICI}next-cache.mjs",
  "@/auth": "${ICI}auth.mjs",
};
export async function resolve(s, c, n) {
  if (Object.prototype.hasOwnProperty.call(DOUBLURES, s)) {
    return { url: DOUBLURES[s], shortCircuit: true, format: "module" };
  }
  const r = await n(s, c);
  if (r.url && /\\/src\\/auth\\.tsx?$/.test(r.url)) {
    return { url: DOUBLURES["@/auth"], shortCircuit: true, format: "module" };
  }
  return r;
}`;
register("data:text/javascript," + encodeURIComponent(code));
