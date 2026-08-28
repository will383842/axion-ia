/**
 * Le catalogue décrit-il le code, ou ce qu'on croit du code ?
 *
 * ## Ce que ce fichier verrouille
 *
 * `catalogue.ts` déclare, pour chaque gabarit, LE FICHIER qui l'envoie. Cette
 * information est écrite à la main : rien dans le type ne l'attache au code
 * réel. Sans garde, elle serait juste le jour où on l'écrit, puis fausse — et
 * une page de console qui affirme « part le jour J-5 » pour un gabarit que plus
 * personne n'envoie est pire qu'une page vide : elle rassure.
 *
 * ## 🔑 Ce que la garde compare, dans les DEUX sens
 *
 *   · un gabarit déclaré `source: "…"` doit avoir un appelant réel dans ce
 *     fichier — sinon l'appelant a déménagé, ou n'a jamais existé ;
 *   · un gabarit déclaré `source: null` (dormant) ne doit avoir AUCUN appelant
 *     — sinon il a été branché depuis, et la console le dit encore mort.
 *
 * Le second sens est celui qu'on oublie. C'est pourtant le seul qui rattrape un
 * gabarit qui reprend du service.
 *
 * ## 🔴 CE QUE LE SCAN CHERCHE, ET POURQUOI PAS L'APPEL LITTÉRAL
 *
 * Deux motifs d'indirection sont légitimes et répandus dans ce dépôt :
 *
 * ```ts
 * // 1. le nom vient d'une table de configuration (rappels-appel.ts)
 * await enqueueEmail(p.job, ...)
 * // 2. le nom vient d'une correspondance par type de demande (unified-contact)
 * await enqueueEmail(TEMPLATE_PAR_TYPE[type], ...)
 * ```
 *
 * Chercher `enqueueEmail("nom")` en littéral déclare donc dormants des gabarits
 * qui partent tous les jours. Un premier jet de cette garde a fait exactement
 * cela : 6 faux positifs, dont les trois e-mails d'appel.
 *
 * Le critère retenu est l'ASSOCIATION : un fichier envoie un gabarit s'il
 * contient à la fois `enqueueEmail` ET le nom du gabarit entre guillemets.
 * Moins strict qu'un appel littéral, mais vrai — et c'est ce qui compte pour
 * répondre à « où est-ce envoyé ? ».
 *
 * ⚠️ Corollaire assumé : un fichier qui nommerait un gabarit sans l'envoyer,
 * tout en appelant `enqueueEmail` pour un AUTRE, passerait pour son émetteur.
 * Le cas ne se présente pas aujourd'hui ; s'il se présentait, il faudrait
 * remonter à l'analyse syntaxique plutôt que durcir le motif.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { CATALOGUE, DORMANTS } from "./catalogue";
import type { EmailJobName } from "@/server/queue/types";

const RACINE = join(process.cwd(), "src");

/**
 * Dossiers écartés du scan : ils ne contiennent que des données éditoriales.
 *
 * ⚠️ `src/content/villes` porte des milliers de fichiers ; les parcourir fait
 * passer ce test de 2 s à plusieurs minutes. Les écarter est un choix de
 * performance — s'il fallait un jour y chercher un envoi, ce serait le signe
 * qu'un appel d'e-mail a atterri là où il n'a rien à faire.
 */
const IGNORES = new Set(["content", "messages", "node_modules"]);

function fichiersSource(dossier: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      if (!IGNORES.has(entree)) fichiersSource(chemin, acc);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entree)) continue;
    if (/\.(spec|test)\.tsx?$/.test(entree)) continue;
    acc.push(chemin);
  }
  return acc;
}

const FICHIERS = fichiersSource(RACINE);

/**
 * nom de gabarit → chemins (relatifs à `src/`) qui l'envoient.
 *
 * Critère : le fichier appelle `enqueueEmail` ET nomme le gabarit. Voir l'en-tête
 * pour pourquoi ce n'est pas l'appel littéral qui est cherché.
 */
const APPELANTS = new Map<string, Set<string>>();
for (const f of FICHIERS) {
  // 🔴 Le catalogue lui-meme nomme les 44 gabarits ET cite `enqueueEmail` dans
  // sa documentation : sans cette exclusion, il se compte comme leur emetteur,
  // et les cinq dormants passent pour vivants. La garde se mesurait elle-meme.
  if (f.includes(join("email", "apercu"))) continue;
  const source = readFileSync(f, "utf8");
  if (!source.includes("enqueueEmail")) continue;
  const relatif = f
    .slice(RACINE.length + 1)
    .split(sep)
    .join("/");
  for (const m of source.matchAll(/["']([a-z][a-z0-9-]{4,})["']/g)) {
    const nom = m[1];
    if (!nom) continue;
    const set = APPELANTS.get(nom) ?? new Set<string>();
    set.add(relatif);
    APPELANTS.set(nom, set);
  }
}

const NOMS = Object.keys(CATALOGUE) as EmailJobName[];

describe("le catalogue décrit le code réel", () => {
  it("a bien scanné des fichiers — sinon la garde serait verte à vide", () => {
    // Le témoin qui distingue « rien à signaler » de « je n'ai rien lu ».
    expect(FICHIERS.length, "aucun fichier scanné").toBeGreaterThan(100);
  });

  it("le scan voit les envois INDIRECTS, pas seulement les appels littéraux", () => {
    // 🔴 Le cas qui empêche l'erreur du 2026-08-28 de revenir, sous ses deux
    // formes : l'appel multi-lignes (Qualiopi) et le nom qui vient d'une table
    // de configuration (les trois e-mails d'appel). Un motif littéral déclare
    // ces gabarits dormants alors qu'ils partent tous les jours.
    expect(APPELANTS.get("qualiopi-convocation"), "appel multi-lignes non vu").toBeDefined();
    expect(APPELANTS.get("appel-rappel"), "nom venu d une table non vu").toBeDefined();
    expect(
      APPELANTS.get("contact-confirmed"),
      "nom venu d une correspondance non vu",
    ).toBeDefined();
  });

  it.each(NOMS.filter((n) => CATALOGUE[n].source !== null))(
    "%s : le fichier déclaré l'envoie vraiment",
    (nom) => {
      const declare = CATALOGUE[nom].source as string;
      const reels = [...(APPELANTS.get(nom) ?? [])];
      expect(
        reels,
        `« ${nom} » déclare partir de « ${declare} », mais les appels réels sont : ` +
          `${reels.length ? reels.join(", ") : "AUCUN"}. L'appelant a déménagé, ou le ` +
          `gabarit est devenu dormant sans que le catalogue le dise.`,
      ).toContain(declare);
    },
  );

  it.each(DORMANTS.length ? DORMANTS : (["(aucun)"] as unknown as EmailJobName[]))(
    "%s : déclaré dormant, et vraiment sans appelant",
    (nom) => {
      if ((nom as string) === "(aucun)") return;
      const reels = [...(APPELANTS.get(nom) ?? [])];
      expect(
        reels,
        `« ${nom} » est affiché comme dormant dans la console alors qu'il est ` +
          `envoyé par ${reels.join(", ")}. La console ment sur un e-mail qui part.`,
      ).toEqual([]);
    },
  );

  it("les dormants sont ceux qu'on croit — ni plus, ni moins", () => {
    // Un compte figé attraperait un gabarit devenu dormant en silence : le
    // fichier qui l'envoyait a été supprimé, personne ne l'a vu.
    expect(DORMANTS.length, "le nombre de gabarits dormants a changé").toBe(5);
  });
});
