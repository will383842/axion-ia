/**
 * CLIQUET — un appelant ne doit JAMAIS jeter le booléen d'envoi.
 *
 * ## Le contrat, tel qu'il est écrit dans le service
 *
 * `notifications-service.ts` le formule mot pour mot au-dessus de
 * `envoyerRappelJ7` :
 *
 *     Le contrat est donc : `true` = remis à la file, la trace peut être écrite.
 *     `false` = rien n'est parti, l'appelant NE DOIT PAS écrire la trace.
 *
 * Les sept fonctions de cette famille rendent `Promise<boolean>` et **ne lèvent
 * pas** quand l'envoi échoue : `enqueueEmail` retourne `{ enqueued: false }` si
 * la file est absente, et `{ enqueued: false, garePourValidation: true }` si une
 * règle `EmailAutomationSetting` gare le message en corbeille de validation.
 * Cinq chemins de `envoyerPositionnement` rendent `false` sans lever : stub,
 * déjà répondu, stagiaire sans adresse, file indisponible, garage en corbeille.
 *
 * ## Pourquoi ce cliquet est STATIQUE, et pas un test de comportement
 *
 * 🔴 2026-08-24 — LE CORRECTIF DE LA PR #764 N'A JAMAIS FRANCHI LA COUCHE ACTION.
 *
 * Cette PR a corrigé le worker : ses trois appels portent désormais
 * `if (!(await envoyerX(...))) { ko++; continue; }`. **Quatre appelants hors cron
 * ont été oubliés**, et le défaut est resté en production :
 *
 *   · `actions/qualiopi/questionnaires.ts` — envoi manuel depuis la console, et
 *     relance manuelle. Le retour est jeté, `envoyeAt` est écrit hors de tout
 *     test, et l'écran affiche « Lien envoyé au stagiaire ».
 *   · `actions/qualiopi/piece-signature.ts` — déclenchement du positionnement à
 *     la signature de la convention. Le commentaire au-dessus assume l'écriture
 *     de la trace sans la conditionner.
 *   · `notifications/notifications-service.ts` — la branche `positionnement` de
 *     `envoyerRelanceQuestionnaire`, SEULE des trois branches à ne pas lire son
 *     retour, quand ses deux sœurs testent `envoi.enqueued` et rendent `false`.
 *
 * 🔑 C'est un PRÉDICAT RECOPIÉ QUI DIVERGE : quatre appelants, quatre décisions
 * indépendantes de lire ou non le booléen, une seule corrigée. Trois gardes de
 * comportement existaient et étaient VERTES pendant que le défaut vivait —
 * l'une mockait `undefined` là où le contrat rend un booléen, une autre ne
 * testait que la levée, c'est-à-dire le seul mode d'échec qui ne peut PAS se
 * produire, la troisième mockait la fonction qu'elle prétendait garder.
 *
 * Le bon niveau de garde est donc l'ARCHITECTURE, pas le cas d'usage : une garde
 * par appelant aurait laissé passer le cinquième. Celle-ci refuse la FORME
 * fautive, quel que soit l'appelant, et elle attrapera le prochain.
 *
 * ## Ce qu'elle refuse exactement
 *
 * Un appel en **instruction nue** — `await envoyerX(...)` seul sur sa ligne —
 * jette la valeur de retour par construction. Toutes les autres formes la
 * lisent : `if (!(await envoyerX(...)))`, `const parti = await envoyerX(...)`,
 * `return envoyerX(...)`, `(await envoyerX(...)) === false`.
 *
 * ⚠️ Ce cliquet ne regarde donc PAS où la trace est écrite, et c'est délibéré :
 * chercher « une écriture de `envoyeAt` dominée par une garde » demanderait de
 * remonter un arbre de portées, produirait des faux positifs sur les enveloppes
 * conditionnelles, et se tromperait un jour. Refuser la forme qui jette la
 * valeur est plus étroit, mais c'est exact — et c'est suffisant, puisqu'un
 * appelant qui LIT le booléen ne peut plus écrire la trace par inadvertance.
 *
 * ⚠️ Mesuré au moment d'écrire : **6 appels nus sur 4 fichiers, et zéro faux
 * positif** — tous les autres sites du dépôt lisaient déjà leur booléen.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RACINE_SRC = join(process.cwd(), "src");

/**
 * Les sept fonctions dont le retour EST le contrat. Écrites une seule fois ici :
 * le jour où une huitième s'ajoute, on l'ajoute à cette liste, et le contre-
 * témoin ci-dessous vérifie qu'elles existent toutes réellement.
 */
const FONCTIONS_A_CONTRAT = [
  "envoyerConvocation",
  "envoyerPositionnement",
  "envoyerRappelJ7",
  "envoyerSatisfactionJ1",
  "envoyerSuiviJ30",
  "envoyerRelanceQuestionnaire",
  "envoyerEnqueteEntreprise",
] as const;

const SERVICE = join(RACINE_SRC, "server", "qualiopi", "notifications", "notifications-service.ts");

/** Tous les `.ts`/`.tsx` de production sous `src` — les specs sont hors sujet. */
function sources(dossier: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      if (entree === "__tests__") continue;
      trouves.push(...sources(chemin));
      continue;
    }
    if (!/\.tsx?$/.test(entree)) continue;
    // Une spec qui appelle à nu ne trompe personne : elle ne pose aucune trace.
    if (/\.(spec|test)\.tsx?$/.test(entree)) continue;
    trouves.push(chemin);
  }
  return trouves;
}

/**
 * `await envoyerX(` en TÊTE d'instruction. L'ancrage sur le début de ligne est
 * ce qui distingue l'appel jeté de l'appel lu : `if (!(await envoyerX(`,
 * `const parti = await envoyerX(` et `return envoyerX(` ne matchent pas.
 */
const APPEL_NU = new RegExp(`^\\s*await\\s+(${FONCTIONS_A_CONTRAT.join("|")})\\s*\\(`);

interface AppelNu {
  fichier: string;
  ligne: number;
  fonction: string;
  texte: string;
}

function appelsNus(): AppelNu[] {
  const trouves: AppelNu[] = [];
  for (const chemin of sources(RACINE_SRC)) {
    const lignes = readFileSync(chemin, "utf8").split(/\r?\n/);
    lignes.forEach((ligne, index) => {
      const m = APPEL_NU.exec(ligne);
      if (m) {
        trouves.push({
          fichier: relative(process.cwd(), chemin).replace(/\\/g, "/"),
          ligne: index + 1,
          fonction: m[1] ?? "?",
          texte: ligne.trim(),
        });
      }
    });
  }
  return trouves;
}

describe("un appelant ne jette pas le booléen d'envoi", () => {
  it("les sept fonctions à contrat existent bien, et rendent un booléen", () => {
    // Contre-témoin : une liste dont les noms ne correspondent à rien rendrait
    // le test suivant vert sans rien garder — c'est la panne exacte d'un autre
    // cliquet de ce dépôt, qui cherchait deux de ses trois aides au mauvais
    // chemin et se taisait sur l'absence.
    const service = readFileSync(SERVICE, "utf8");
    const absentes = FONCTIONS_A_CONTRAT.filter(
      (fn) => !new RegExp(`export async function ${fn}\\b`).test(service),
    );
    expect(
      absentes,
      `fonction(s) déclarée(s) ici mais absente(s) de notifications-service.ts : ` +
        `le motif de recherche ne trouverait plus rien et ce cliquet passerait au ` +
        `vert sans mesurer les appels de ces fonctions`,
    ).toEqual([]);

    const sansBooleen = FONCTIONS_A_CONTRAT.filter(
      (fn) =>
        !new RegExp(`export async function ${fn}\\([^)]*\\)\\s*:\\s*Promise<boolean>`, "s").test(
          service,
        ),
    );
    expect(
      sansBooleen,
      "fonction(s) qui ne rendent PAS `Promise<boolean>` : le contrat « false = " +
        "rien n'est parti » n'existe pas pour elles, et les exiger ici serait " +
        "une garde sur une règle imaginaire",
    ).toEqual([]);
  });

  it("des sources sont bien analysées", () => {
    // Second contre-témoin : un balayage vide rendrait le test suivant vert.
    expect(sources(RACINE_SRC).length, "aucune source trouvée sous src/").toBeGreaterThan(200);
  });

  it("aucun appel n'est en instruction nue", () => {
    const nus = appelsNus();
    expect(
      nus.map((a) => `${a.fichier}:${a.ligne} — ${a.texte}`),
      "Un `await envoyerX(...)` seul sur sa ligne JETTE le booléen du contrat. " +
        "Ces fonctions ne lèvent pas quand l'envoi échoue : elles rendent `false`. " +
        "L'appelant écrit alors sa trace (`envoyeAt`, `convocationEnvoyeeAt`, " +
        "`relanceCount`, `derniereRelanceAt`) pour un courrier qui n'est jamais " +
        "parti — et le filtre de rattrapage l'écarte ensuite définitivement. " +
        "Forme attendue : `if (!(await envoyerX(...))) { … }` ou " +
        "`const parti = await envoyerX(...)`. Le worker le fait déjà " +
        "(qualiopi-formation-crons-worker.ts) : c'est la même ligne à recopier.",
    ).toEqual([]);
  });
});
