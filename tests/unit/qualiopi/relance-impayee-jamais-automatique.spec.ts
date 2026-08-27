/**
 * 🛑 GARDE — une relance d'impayé ne part JAMAIS toute seule.
 *
 * Ordre permanent de Will, 2026-08-27 : « les relances d'impayés doivent être
 * manuelles et jamais automatiques ».
 *
 * ## Pourquoi cette garde existe
 *
 * L'état du dépôt respectait déjà la consigne au moment où elle a été donnée —
 * et c'est exactement la situation dans laquelle une consigne se perd. Le cron
 * `formation-crons.factures-retard` PROPOSE une relance dans le hub de
 * facturation ; l'envoi part d'un clic humain (`envoyerRelanceAction`), derrière
 * une confirmation où l'admin coche « j'ai vérifié mon relevé bancaire ».
 *
 * Rien n'empêchait qu'on ajoute un jour un envoi automatique « pour gagner du
 * temps » : la consigne ne vivait que dans un message. Le dépôt a déjà payé ce
 * défaut ailleurs (cf. `le-ppt-projete-nest-jamais-genere.spec.ts`, où une
 * décision est restée six semaines hors du code pendant que le système faisait
 * l'inverse en silence). Celle-ci rougit.
 *
 * ## Ce qui est verrouillé, et pourquoi c'est CE critère
 *
 * Le critère n'est pas « quel fichier envoie », qui se contournerait par un
 * renommage. C'est **d'où** part l'envoi : un module de file d'attente
 * (`src/server/queue/**`) ou un script planifié s'exécute SANS personne devant
 * l'écran — c'est la définition même d'un envoi automatique. Une Server Action
 * ne s'exécute que sur une action d'utilisateur.
 *
 * ## Ce que cette garde ne couvre PAS
 *
 * Elle ne dit rien de la RÉDACTION de la relance, ni des paliers, ni du choix du
 * débiteur (subrogation OPCO) — verrouillés dans
 * `qualiopi-formation-crons-worker.spec.ts`. Elle ne couvre pas non plus les
 * relances qui ne portent pas sur un impayé (questionnaires, positionnement,
 * enquêtes), qui SONT automatiques et doivent le rester.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const GABARIT = "qualiopi-relance-impayee";

/**
 * Le gabarit cité en PREMIER ARGUMENT d'un appel — c'est cela, envoyer.
 *
 * 🔑 Premier jet : `source.includes('"' + GABARIT + '"')`. Il rougissait sur
 * `src/server/queue/types.ts`, où le gabarit n'est qu'un membre de l'union des
 * types d'e-mails — une DÉCLARATION, pas un envoi. Une garde qui accuse une
 * déclaration de type se fait désarmer à la première lecture, et l'ordre
 * permanent part avec elle.
 *
 * La forme retenue attrape n'importe quel expéditeur, y compris un futur qui ne
 * s'appellerait pas `enqueueEmail`.
 */
const ENVOI = new RegExp(`\\w+\\(\\s*["']${GABARIT}["']`);

/** Le seul endroit du dépôt d'où cet e-mail a le droit de partir. */
const EXPEDITEUR_AUTORISE = "src/server/actions/qualiopi/facturation-hub.ts";

/**
 * Répertoires dont le code tourne SANS personne devant l'écran. Un envoi qui
 * part d'ici est automatique par construction, quel que soit son nom.
 */
const AUTOMATES = ["src/server/queue", "scripts"];

function fichiersTs(racine: string): string[] {
  const sortie: string[] = [];
  const parcourir = (dossier: string): void => {
    let entrees: string[];
    try {
      entrees = readdirSync(dossier);
    } catch {
      return; // répertoire absent : traité par le contre-témoin ci-dessous
    }
    for (const nom of entrees) {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) {
        parcourir(chemin);
        continue;
      }
      if (!/\.tsx?$/.test(nom) || /\.spec\.tsx?$/.test(nom)) continue;
      sortie.push(chemin);
    }
  };
  parcourir(join(process.cwd(), racine));
  return sortie;
}

describe("🛑 une relance d'impayé est TOUJOURS déclenchée à la main", () => {
  it("aucun automate (file d'attente, script planifié) n'expédie le gabarit", () => {
    const fautifs: string[] = [];
    let scannes = 0;

    for (const racine of AUTOMATES) {
      const fichiers = fichiersTs(racine);
      // 🔑 CONTRE-TÉMOIN. Une énumération qui ne lit rien passe ce test à la
      // perfection — c'est le mode d'échec le plus fréquent d'une garde
      // statique, et il ne se voit pas dans un rapport vert. On exige donc que
      // le balayage ait effectivement trouvé du code.
      expect(
        fichiers.length,
        `Aucun fichier scanné sous « ${racine} » : cette garde ne mesure plus ` +
          `rien. Le répertoire a-t-il été déplacé ? Corriger AUTOMATES.`,
      ).toBeGreaterThan(5);
      scannes += fichiers.length;

      for (const chemin of fichiers) {
        const source = readFileSync(chemin, "utf8");
        if (ENVOI.test(source)) {
          fautifs.push(chemin.replace(process.cwd(), "").replace(/\\/g, "/"));
        }
      }
    }

    expect(scannes).toBeGreaterThan(20);
    expect(
      fautifs,
      `Un automate expédie « ${GABARIT} » :\n  ${fautifs.join("\n  ")}\n\n` +
        `Une relance d'impayé ne part JAMAIS seule (ordre permanent de Will, ` +
        `2026-08-27). Un cron PROPOSE dans le hub de facturation ; l'envoi est ` +
        `un clic humain, derrière la confirmation « j'ai vérifié mon relevé ». ` +
        `Si la décision a changé, c'est ce commentaire qu'il faut réécrire — ` +
        `pas l'assertion qu'il faut supprimer.`,
    ).toEqual([]);
  });

  it("🔑 l'expéditeur humain existe TOUJOURS — sinon plus personne ne relance", () => {
    // Sans ce second témoin, supprimer purement et simplement l'envoi ferait
    // passer le test ci-dessus au vert : « aucun automate n'envoie » serait
    // vrai, et plus AUCUNE relance ne partirait. Un impayé cesserait d'être
    // réclamé, ce qui est le défaut opposé — et le plus coûteux des deux.
    const source = readFileSync(join(process.cwd(), EXPEDITEUR_AUTORISE), "utf8");
    expect(
      source.includes(`"${GABARIT}"`),
      `« ${GABARIT} » n'est plus expédié depuis ${EXPEDITEUR_AUTORISE} : ` +
        `plus aucune relance d'impayé ne peut partir. Si l'envoi a déménagé, ` +
        `mettre à jour EXPEDITEUR_AUTORISE — et vérifier que le nouveau lieu ` +
        `est bien une action déclenchée par un humain.`,
    ).toBe(true);
  });

  it("🔑 le cron des factures en retard tourne bien SANS personne — il PROPOSE", () => {
    // Le troisième témoin ancre la raison d'être des deux autres : ce cron
    // existe, il traite les impayés, et il écrit dans `relanceProposee`. C'est
    // ce qui rend la garde nécessaire plutôt que théorique.
    const source = readFileSync(
      join(process.cwd(), "src/server/queue/workers/qualiopi-formation-crons-worker.ts"),
      "utf8",
    );
    expect(
      source.includes("relanceProposee.create"),
      "Le cron des factures en retard ne propose plus rien : soit il a " +
        "déménagé, soit les impayés ne remontent plus à l'écran du tout.",
    ).toBe(true);
  });
});
