/**
 * Génère la valeur de `QUALIOPI_REOUVERTURE_MDP` à coller dans Coolify
 * (application WEB, scope RUN), puis redémarrer. Procédure complète :
 * `docs/runbooks/R35-dossier-de-session-rouvrir-mot-de-passe-interrupteur.md`.
 *
 * Usage : pnpm tsx scripts/qualiopi/empreinte-mot-de-passe-reouverture.ts
 * Le mot de passe est lu sur l'entrée standard, SANS écho à l'écran, DEUX fois
 * (« Mot de passe » puis « Confirmez ») : une faute de frappe invisible
 * produirait une empreinte que personne ne sait reproduire, et le dossier ne
 * pourrait plus être rouvert. Il ne passe jamais en argument (il resterait dans
 * l'historique du shell), ne s'affiche pas et n'est jamais écrit sur disque.
 * Seule l'empreinte sort, sur la sortie standard ; les invites vont sur la
 * sortie d'erreur.
 *
 * Le mot de passe est haché TEL QUEL, comme l'action le vérifie : pas de
 * `trim()`, sinon un mot de passe bordé d'espaces ne serait jamais reconnu.
 *
 * Code de sortie 1 (et aucune empreinte) si les deux saisies diffèrent, si le
 * mot de passe fait moins de 12 caractères, ou si l'entrée se ferme avant la
 * seconde saisie.
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

const rl = createInterface({
  input: process.stdin,
  output: sortie,
  terminal: Boolean(process.stdin.isTTY),
});

/** Les lignes lues, dans l'ordre — une file, pour servir aussi une entrée redirigée. */
const lignes: string[] = [];
const attentes: Array<(ligne: string | null) => void> = [];
rl.on("line", (ligne) => {
  const attente = attentes.shift();
  if (attente) attente(ligne);
  else lignes.push(ligne);
});
rl.on("close", () => {
  for (const attente of attentes.splice(0)) attente(null);
});

function saisir(invite: string): Promise<string | null> {
  process.stderr.write(invite);
  muet = true;
  return new Promise((resoudre) => {
    const suivante = lignes.shift();
    if (suivante !== undefined) resoudre(suivante);
    else attentes.push(resoudre);
  }).then((ligne) => {
    muet = false;
    process.stderr.write("\n");
    return ligne as string | null;
  });
}

function refuser(message: string): never {
  process.stderr.write(`Refusé : ${message} Aucune empreinte produite.\n`);
  process.exit(1);
}

async function principal(): Promise<void> {
  const mdp = await saisir("Mot de passe de réouverture (la saisie ne s'affiche pas) : ");
  if (mdp === null) refuser("entrée fermée avant la saisie.");
  if (mdp.length < LONGUEUR_MIN) refuser(`${LONGUEUR_MIN} caractères au moins.`);
  const confirmation = await saisir("Confirmez le mot de passe : ");
  rl.close();
  if (confirmation === null) refuser("entrée fermée avant la confirmation.");
  if (confirmation !== mdp) refuser("les deux saisies diffèrent.");
  process.stdout.write(`${empreinteMotDePasse(mdp, randomBytes(16).toString("hex"))}\n`);
}

void principal();
