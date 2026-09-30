/**
 * Génère la valeur de `QUALIOPI_REOUVERTURE_MDP` à coller dans Coolify
 * (application WEB, scope RUN), puis redémarrer.
 *
 * Usage : pnpm tsx scripts/qualiopi/empreinte-mot-de-passe-reouverture.ts
 * Le mot de passe est lu sur l'entrée standard : il ne passe jamais en argument
 * (il resterait dans l'historique du shell) et n'est jamais écrit sur disque.
 */

import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";

import { empreinteMotDePasse } from "../../src/server/qualiopi/sessions/mot-de-passe-reouverture";

const rl = createInterface({ input: process.stdin, output: process.stderr });
rl.question("Mot de passe de réouverture : ", (mdp) => {
  rl.close();
  if (mdp.trim().length < 8) {
    process.stderr.write("Refusé : 8 caractères au moins.\n");
    process.exit(1);
  }
  process.stdout.write(`${empreinteMotDePasse(mdp.trim(), randomBytes(16).toString("hex"))}\n`);
});
