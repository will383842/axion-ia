/**
 * Garde — un écran qui ANNONCE servir un indicateur doit être celui qui le sert.
 *
 * ## Le défaut que cette garde ferme (2026-09-02, audit certificateur)
 *
 * Deux écrans de la console nommaient, dans leur sous-titre — la première ligne
 * que lit l'auditrice après le titre — un indicateur qui n'est pas le leur :
 *
 *   - **Partenariats** : « Réseau de partenaires Qualiopi (off.25 — indicateur
 *     25), dont partenaires réseau handicap ». L'indicateur 25 est la veille sur
 *     les innovations pédagogiques. Le réseau handicap, c'est le **26**, et le 26
 *     est un SUPER-indicateur. Le fichier le savait : un commentaire, cent lignes
 *     plus bas, écrit « off.26 est un super-indicateur ». Le sous-titre, lui,
 *     envoyait chercher la preuve au mauvais endroit.
 *   - **Formateurs** : « vérification data.gouv.fr (off.6/19) ». L'indicateur 6
 *     porte sur les contenus, le 19 sur les ressources pédagogiques. La
 *     vérification data.gouv est la vigilance de l'indicateur **27**, et le
 *     registre des intervenants sert 17, 21, 22 et 27 — jamais 6 ni 19.
 *
 * Un numéro faux dans un sous-titre ne se voit pas : il se lit, il est cru, et
 * il oriente une recherche de preuve. Ce dépôt sait déjà ce que coûte un chiffre
 * faux devant un auditeur — « un constat qui porte un chiffre faux se fait
 * démonter en séance et emporte les points solides avec lui ».
 *
 * ## Comment la garde décide
 *
 * Elle DÉRIVE des deux sources qui font foi et n'en recopie aucune :
 *   - la liste des écrans, par balayage du répertoire des routes Qualiopi ;
 *   - la correspondance indicateur → écran, dans `REGISTRES_PAR_INDICATEUR`.
 *
 * Elle ne lit que le SOUS-TITRE (`description` d'`AdminPageHeader`), c'est-à-dire
 * ce que l'écran affirme à son lecteur — pas les commentaires, qui discutent
 * souvent d'autres indicateurs à bon droit.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, it, expect } from "vitest";

import { REGISTRES_PAR_INDICATEUR } from "./registres-par-indicateur";

const RACINE_QUALIOPI = join(
  process.cwd(),
  "src",
  "app",
  "[locale]",
  "(admin)",
  "[adminPrefix]",
  "qualiopi",
);

/** Toutes les `page.tsx` sous les routes Qualiopi, balayées — jamais listées. */
function pagesQualiopi(dossier: string): string[] {
  const trouvees: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      trouvees.push(...pagesQualiopi(chemin));
    } else if (entree === "page.tsx") {
      trouvees.push(chemin);
    }
  }
  return trouvees;
}

/**
 * La route de console d'une page, telle que `REGISTRES_PAR_INDICATEUR` l'écrit :
 * `/qualiopi/<segments>`, les segments dynamiques inclus tels quels.
 */
function routeDe(cheminFichier: string): string {
  const rel = relative(RACINE_QUALIOPI, cheminFichier).replace(/\\/g, "/");
  const sansPage = rel.replace(/\/?page\.tsx$/, "");
  return sansPage === "" ? "/qualiopi" : `/qualiopi/${sansPage}`;
}

/** Le sous-titre affiché par l'écran, ou `null` s'il n'en a pas. */
function descriptionAffichee(source: string): string | null {
  const guillemets = /description="([^"]*)"/.exec(source);
  if (guillemets?.[1] !== undefined) return guillemets[1];
  const gabarit = /description=\{`([\s\S]*?)`\}/.exec(source);
  if (gabarit?.[1] !== undefined) return gabarit[1];
  return null;
}

/** Les numéros d'indicateur qu'un sous-titre revendique. */
function indicateursAnnonces(description: string): number[] {
  const numeros = new Set<number>();
  // « off.26 », « off.17/18/19 », « off.23/24/25 »
  for (const m of description.matchAll(/off\.(\d+(?:\s*\/\s*\d+)*)/gi)) {
    for (const n of (m[1] ?? "").split("/")) numeros.add(Number(n.trim()));
  }
  // « indicateur 27 », « indicateurs 23-25 »
  for (const m of description.matchAll(/indicateurs?\s+(\d+)(?:\s*-\s*(\d+))?/gi)) {
    const debut = Number(m[1]);
    const fin = m[2] !== undefined ? Number(m[2]) : debut;
    for (let n = debut; n <= fin; n += 1) numeros.add(n);
  }
  return [...numeros].filter((n) => Number.isInteger(n) && n >= 1 && n <= 32).sort((a, b) => a - b);
}

/** Les écrans que le registre rattache à un indicateur. */
function ecransDe(numero: number): string[] {
  return (REGISTRES_PAR_INDICATEUR[numero] ?? []).map((r) => r.chemin);
}

describe("indicateurs annoncés par les écrans de la console", () => {
  const pages = pagesQualiopi(RACINE_QUALIOPI);

  it("balaie réellement les écrans Qualiopi (témoin de non-vacuité)", () => {
    expect(pages.length).toBeGreaterThan(40);
  });

  it("aucun écran n'annonce un indicateur que le registre ne lui rattache pas", () => {
    const fautes: string[] = [];
    for (const page of pages) {
      const description = descriptionAffichee(readFileSync(page, "utf8"));
      if (description === null) continue;
      const route = routeDe(page);
      for (const numero of indicateursAnnonces(description)) {
        if (!ecransDe(numero).includes(route)) {
          fautes.push(
            `${route} annonce l'indicateur ${numero}, que REGISTRES_PAR_INDICATEUR rattache à ${JSON.stringify(ecransDe(numero))}`,
          );
        }
      }
    }
    expect(fautes).toEqual([]);
  });

  it("le contrôle porte bien sur quelque chose : des écrans annoncent des indicateurs", () => {
    // Sans ce témoin, un jour où `descriptionAffichee` cesserait de reconnaître
    // le gabarit du sous-titre, la garde deviendrait verte sur le vide.
    const annoncants = pages.filter((p) => {
      const d = descriptionAffichee(readFileSync(p, "utf8"));
      return d !== null && indicateursAnnonces(d).length > 0;
    });
    expect(annoncants.length).toBeGreaterThanOrEqual(6);
  });
});
