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
 * Ces fonctions **ne lèvent pas** quand l'envoi échoue : `enqueueEmail` retourne
 * `{ enqueued: false }` si la file est absente, et
 * `{ enqueued: false, garePourValidation: true }` si une règle
 * `EmailAutomationSetting` gare le message en corbeille de validation. Cinq
 * chemins de `envoyerPositionnement` rendent `false` sans lever : stub, déjà
 * répondu, stagiaire sans adresse, file indisponible, garage en corbeille.
 *
 * ## Pourquoi ce cliquet est STATIQUE, et pourquoi il DÉCOUVRE sa cible
 *
 * 🔴 2026-08-24 — LE CORRECTIF DE LA PR #764 N'A JAMAIS FRANCHI LA COUCHE ACTION.
 *
 * Cette PR a corrigé le worker : ses trois appels portent désormais
 * `if (!(await envoyerX(...))) { ko++; continue; }`. **Quatre appelants hors cron
 * ont été oubliés**, et le défaut est resté en production — envoi manuel depuis
 * la console, relance manuelle, déclenchement à la signature de la convention,
 * et la branche `positionnement` de `envoyerRelanceQuestionnaire`, SEULE des
 * trois branches à ne pas lire son retour.
 *
 * 🔴 ET LA PREMIÈRE VERSION DE CE FICHIER A RATÉ UN CINQUIÈME APPELANT, UNE HEURE
 * APRÈS AVOIR ÉTÉ ÉCRITE.
 *
 * Elle portait **sept noms en dur**. Il en existait une huitième au même
 * contrat, `envoyerAttestationDisponible`, dont l'appelant
 * (`evaluations/attestation-service.ts`) jetait le booléen : l'attestation était
 * générée et enregistrée, le stagiaire n'était **jamais prévenu** qu'elle
 * existait, et rien ne le rattrapait. Ce cliquet était vert.
 *
 * 🔑 UNE LISTE À MAINTENIR VIEILLIT TOUJOURS MAL — et le défaut d'origine était
 * précisément un correctif appliqué « à six sur sept ». Écrire la huitième à la
 * main aurait reproduit la faute au tour suivant. La liste est donc DÉRIVÉE de la
 * signature : toute fonction exportée dont le nom commence par `envoyer` et qui
 * rend `Promise<boolean>` porte le contrat, où qu'elle vive. La neuvième sera
 * couverte le jour de sa naissance, sans que personne n'y pense.
 *
 * ⚠️ Un cliquet du même genre existait déjà : `queue/workers/__tests__/
 * aucun-envoi-ignore.spec.ts`. Il ne lit **qu'un seul fichier** — le worker des
 * crons. C'est pour cela que les cinq appelants ci-dessus vivaient tranquillement
 * hors de son périmètre. Les deux sont complémentaires : celui-là couvre toutes
 * les fonctions `envoyer*` d'un fichier, celui-ci couvre toutes les fonctions à
 * contrat de tout `src`.
 *
 * ## Ce qu'il refuse exactement
 *
 * Un appel en **instruction nue** — `await envoyerX(...)` seul sur sa ligne —
 * jette la valeur de retour par construction. Toutes les autres formes la
 * lisent : `if (!(await envoyerX(...)))`, `const parti = await envoyerX(...)`,
 * `return envoyerX(...)`, `(await envoyerX(...)) === false`.
 *
 * ⚠️ Il ne regarde donc PAS où la trace est écrite, et c'est délibéré : chercher
 * « une écriture de `envoyeAt` dominée par une garde » demanderait de remonter un
 * arbre de portées, produirait des faux positifs sur les enveloppes
 * conditionnelles, et se tromperait un jour. Refuser la forme qui jette la valeur
 * est plus étroit, mais exact — et suffisant, puisqu'un appelant qui LIT le
 * booléen ne peut plus écrire la trace par inadvertance.
 *
 * ⚠️ Mesuré : **6 appels nus sur 4 fichiers** au premier passage, **1 de plus**
 * hors de la liste en dur, et **zéro faux positif** — tous les autres sites du
 * dépôt lisaient déjà leur booléen.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RACINE_SRC = join(process.cwd(), "src");

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
 * LE DEPOT EST LU UNE SEULE FOIS, ET C'EST DELIBERE.
 *
 * La premiere version lisait les ~700 sources DEUX fois : une passe pour
 * decouvrir les signatures, une seconde pour chercher les appels nus. Sous
 * `vitest` en parallele, ce doublon a suffi a faire rougir deux tests d une
 * autre suite, sensibles au temps (`content-publish-worker-throttle`), qui
 * passent en isolation. Une garde ne doit pas destabiliser les mesures
 * voisines pour se faire plaisir : on charge une fois, on reutilise.
 */
const CORPUS: ReadonlyArray<{ chemin: string; source: string }> = sources(RACINE_SRC).map(
  (chemin) => ({ chemin, source: readFileSync(chemin, "utf8") }),
);

/** Coupure de ligne, tolerante aux fins de ligne Windows. */
const SAUT_DE_LIGNE = new RegExp(String.fromCharCode(13) + "?" + String.fromCharCode(10));

/**
 * Les fonctions dont le retour EST le contrat — découvertes par leur signature.
 *
 * `export async function envoyerX(...): Promise<boolean>`. Le `[^)]*` suffit :
 * aucune de ces signatures ne porte de parenthèse imbriquée dans ses paramètres,
 * et le contre-témoin ci-dessous rougirait si le motif cessait de trouver.
 */
function fonctionsAContrat(): string[] {
  const noms = new Set<string>();
  const DECLARATION =
    /export\s+async\s+function\s+(envoyer\w+)\s*\([^)]*\)\s*:\s*Promise<boolean>/g;
  for (const { source } of CORPUS) {
    for (const m of source.matchAll(DECLARATION)) {
      if (m[1] !== undefined) noms.add(m[1]);
    }
  }
  return [...noms].sort();
}

/**
 * `await envoyerX(` en TÊTE d'instruction. L'ancrage sur le début de ligne est ce
 * qui distingue l'appel jeté de l'appel lu.
 */
function motifAppelNu(noms: string[]): RegExp {
  return new RegExp(`^\\s*await\\s+(${noms.join("|")})\\s*\\(`);
}

interface AppelNu {
  fichier: string;
  ligne: number;
  fonction: string;
  texte: string;
}

function appelsNus(noms: string[]): AppelNu[] {
  const trouves: AppelNu[] = [];
  const motif = motifAppelNu(noms);
  for (const { chemin, source } of CORPUS) {
    const lignes = source.split(SAUT_DE_LIGNE);
    lignes.forEach((ligne, index) => {
      const m = motif.exec(ligne);
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
  it("la découverte trouve bien les fonctions à contrat", () => {
    // 🔑 CONTRE-TÉMOIN INDISPENSABLE. Si le motif de signature cessait de
    // trouver — un `Promise<boolean>` reformaté, un `export` déplacé — la liste
    // serait vide, le motif d'appel nu ne matcherait plus rien, et ce cliquet
    // rendrait un VERT sans avoir mesuré un seul appel. C'est exactement la
    // panne qu'un autre cliquet de ce dépôt a vécue en cherchant deux de ses
    // trois aides au mauvais chemin, et celle du script d'inventaire d'audit qui
    // rendait le vide en annonçant le succès.
    const noms = fonctionsAContrat();
    expect(
      noms.length,
      "la découverte par signature ne trouve (presque) rien : le motif est cassé, " +
        "et ce cliquet ne mesure plus aucun appel. Vérifier la forme " +
        "`export async function envoyerX(...): Promise<boolean>`.",
    ).toBeGreaterThanOrEqual(7);

    // Deux jalons connus, l'un du premier lot corrigé, l'autre du huitième
    // appelant qui avait échappé à la liste en dur. Leur absence signalerait un
    // renommage, pas un progrès.
    expect(noms, "`envoyerConvocation` a disparu de la découverte").toContain("envoyerConvocation");
    expect(
      noms,
      "`envoyerAttestationDisponible` a disparu : c'est elle que la liste en dur " +
        "avait manquée, et sa présence ici est la preuve que la découverte " +
        "couvre plus large qu'une énumération",
    ).toContain("envoyerAttestationDisponible");
  });

  it("des sources sont bien analysées", () => {
    // Second contre-témoin : un balayage vide rendrait le test suivant vert.
    expect(CORPUS.length, "aucune source trouvée sous src/").toBeGreaterThan(200);
  });

  it("aucun appel n'est en instruction nue", () => {
    const nus = appelsNus(fonctionsAContrat());
    expect(
      nus.map((a) => `${a.fichier}:${a.ligne} — ${a.texte}`),
      "Un `await envoyerX(...)` seul sur sa ligne JETTE le booléen du contrat. " +
        "Ces fonctions ne lèvent pas quand l'envoi échoue : elles rendent `false`. " +
        "L'appelant écrit alors sa trace (`envoyeAt`, `convocationEnvoyeeAt`, " +
        "`rappelJ7EnvoyeAt`, `relanceCount`, `derniereRelanceAt`) pour un courrier " +
        "qui n'est jamais parti — et le filtre de rattrapage l'écarte ensuite " +
        "définitivement. Ou bien, comme pour l'attestation, personne n'est prévenu " +
        "et rien ne le dit. Forme attendue : `if (!(await envoyerX(...))) { … }` " +
        "ou `const parti = await envoyerX(...)`. Le worker le fait déjà " +
        "(qualiopi-formation-crons-worker.ts) : c'est la même ligne à recopier.",
    ).toEqual([]);
  });
});
