/**
 * Génère la valeur de `QUALIOPI_REOUVERTURE_MDP` à coller dans Coolify
 * (application WEB, scope RUN), puis redémarrer.
 *
 * Usage : pnpm tsx scripts/qualiopi/empreinte-mot-de-passe-reouverture.ts
 * Le mot de passe est lu sur l'entrée standard, SANS écho à l'écran : il ne
 * passe jamais en argument (il resterait dans l'historique du shell), ne
 * s'affiche pas et n'est jamais écrit sur disque. Seule l'empreinte sort.
 *
 * Le mot de passe est haché TEL QUEL, comme l'action le vérifie : pas de
 * `trim()`, sinon un mot de passe bordé d'espaces ne serait jamais reconnu.
 */

import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";

import { empreinteMotDePasse } from "../../src/server/qualiopi/sessions/mot-de-passe-reouverture";

/** Longueur minimale : l'action est limitée à 5 essais par heure, mais un mot court reste devinable. */
const LONGUEUR_MIN = 12;

let muet = false;
const sortie = new Writable({
  write(morceau: Buffer | string, _enc, fin) {
    if (!muet) process.stderr.write(morceau);
    fin();
  },
});

const rl = createInterface({ input: process.stdin, output: sortie, terminal: true });
process.stderr.write("Mot de passe de réouverture (la saisie ne s'affiche pas) : ");
muet = true;
rl.question("", (mdp) => {
  muet = false;
  rl.close();
  process.stderr.write("\n");
  if (mdp.length < LONGUEUR_MIN) {
    process.stderr.write(`Refusé : ${LONGUEUR_MIN} caractères au moins.\n`);
    process.exit(1);
  }
  process.stdout.write(`${empreinteMotDePasse(mdp, randomBytes(16).toString("hex"))}\n`);
});
