// Banc @formateurs (missions) — les SEULS modules remplacés dans le processus serveur.
//
// Le processus `tsx` du banc charge le code RÉEL des actions de la console et de
// l'espace formateur. Trois choses n'existent pas hors d'une requête Next, et
// elles seules sont remplacées :
//   · `@/auth` (la session de la console) → l'administrateur FICTIF du banc ;
//   · `next/headers` (cookies, en-têtes) → le cookie de session formateur que le
//     banc a SIGNÉ avec la vraie fonction (`signFormateurSession`), et aucun en-tête ;
//   · `next/cache` (revalidation de pages) → sans effet : il n'y a pas de page.
// `server-only` est neutralisé : il ne fait que refuser d'être chargé hors de Next.
//
// Rien d'autre : ni horloge, ni base, ni file, ni réseau ne passe par ici.
// Chargé par `--import` AVANT le module serveur (`missions-serveur.ts`).

import { registerHooks } from "node:module";

const ici = (nom) => new URL(`./missions-bouchons/${nom}`, import.meta.url).href;

const BOUCHONS = {
  "@/auth": ici("auth.mjs"),
  "next/headers": ici("next-headers.mjs"),
  "next/headers.js": ici("next-headers.mjs"),
  "next/cache": ici("next-cache.mjs"),
  "next/cache.js": ici("next-cache.mjs"),
  "server-only": ici("server-only.mjs"),
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    const bouchon = BOUCHONS[specifier];
    if (bouchon !== undefined) return { url: bouchon, format: "module", shortCircuit: true };
    const resolu = nextResolve(specifier, context);
    // `src/auth.ts` importé par un chemin relatif (`../auth`) : même remplacement.
    if (resolu.url.endsWith("/src/auth.ts")) {
      return { url: BOUCHONS["@/auth"], format: "module", shortCircuit: true };
    }
    return resolu;
  },
});
