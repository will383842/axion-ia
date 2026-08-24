/**
 * Garde — tout ce que le refus de validation d'off.32 ⭐ REPROCHE doit être
 * saisissable depuis l'écran de la revue de direction.
 *
 * ## Le défaut, mesuré sur la PRODUCTION le 2026-08-23
 *
 * `updateRevueDirectionAction` refuse de déclarer une revue « validée » tant que
 * `evaluerCouvertureOff32` n'est pas satisfait, et son message nomme précisément
 * ce qui manque. C'est la bonne conception — sauf si l'opérateur ne peut pas
 * réparer ce qu'on lui reproche.
 *
 * C'était le cas, et cela verrouillait le dernier super-indicateur ouvert :
 *
 * - la revue 2026 de production est `statut = "validee"` avec `participants: []` ;
 * - le panneau d'édition renvoie **toujours** `statut` (initialisé depuis la
 *   ligne, donc `"validee"`), ce qui déclenche la garde à chaque enregistrement ;
 * - il ne renvoie **pas** `participants` — l'action retombe alors sur la valeur
 *   stockée, c'est-à-dire `[]` ;
 * - `RevueDirectionForm` n'écrit `participants` qu'à la **création** ;
 * - `annee` est `@unique` : pas de seconde revue 2026 ;
 * - aucune action de **suppression** de revue n'existe.
 *
 * Donc : l'opérateur remplit les douze responsables et échéances, enregistre, et
 * se fait refuser sur « Aucun participant nommé » — un manque qu'AUCUN écran ne
 * sait corriger. off.32 était devenu impossible à verdir depuis la console. C'est
 * le motif « balayage des exports sans appelant », déjà payé trois fois ici, et
 * pour la troisième fois sur un super-indicateur.
 *
 * ## Pourquoi cette garde est STATIQUE et DÉRIVÉE
 *
 * L'invariant n'est pas « le champ `participants` est présent » — ce serait une
 * garde sur le défaut d'hier. L'invariant est **architectural** :
 *
 *   > tout champ que `evaluerCouvertureOff32` lit pour prononcer un manque doit
 *   > être écrit par l'écran d'édition.
 *
 * La liste des champs est donc **dérivée** de l'interface `RevueAnnuelleLue`,
 * jamais recopiée : un prédicat recopié diverge, ce dépôt l'a payé quatre fois.
 * Le jour où le prédicat lira un cinquième champ, cette garde rougira toute
 * seule tant que l'écran ne saura pas l'écrire.
 *
 * Le comportement du prédicat, lui, est gardé par `plan-actions.spec.ts` ; le
 * refus au moment du geste par `validation-revue-exige-un-plan.spec.ts`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sansCommentaires } from "./sans-commentaires";

const RACINE = process.cwd();

const SOURCE_PREDICAT = "src/server/qualiopi/revues/plan-actions.ts";
const ECRAN = "src/components/admin/qualiopi/RevueDirectionRowActions.tsx";
const PAGE = "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/revue-direction/page.tsx";

/**
 * `annee` est le seul champ de `RevueAnnuelleLue` qui n'est pas un manque
 * réparable : il identifie la revue (contrainte `@unique`), il ne se corrige pas,
 * et le prédicat ne le transforme jamais en reproche — il le cite dans une preuve.
 * Exclu explicitement, avec sa raison, plutôt que silencieusement.
 */
const NON_REPARABLE = new Set(["annee"]);

function lire(chemin: string): string {
  return sansCommentaires(readFileSync(join(RACINE, chemin), "utf8"));
}

/** Le corps `{ … }` qui suit `ancre`, par appariement d'accolades. */
function blocApres(source: string, ancre: string): string | null {
  const depart = source.indexOf(ancre);
  if (depart === -1) return null;
  const ouvrante = source.indexOf("{", depart + ancre.length);
  if (ouvrante === -1) return null;

  let profondeur = 0;
  for (let i = ouvrante; i < source.length; i += 1) {
    const c = source[i];
    if (c === "{") profondeur += 1;
    else if (c === "}") {
      profondeur -= 1;
      if (profondeur === 0) return source.slice(ouvrante + 1, i);
    }
  }
  return null;
}

/**
 * Les noms de propriétés déclarés au premier niveau d'un corps d'objet/interface.
 *
 * ⚠️ Les deux formes comptent, et l'oubli de la seconde a fabriqué un faux rouge
 * pendant l'écriture de cette garde :
 *   - `nom: valeur` — propriété nommée (interfaces, objets) ;
 *   - `nom,`        — **propriété abrégée**, la forme qu'ESLint impose quand la
 *                     variable porte déjà le nom du champ (`object-shorthand`).
 * Une garde qui ne lit que la première accuse un fichier parfaitement correct.
 * Un corps d'interface ne peut pas produire de faux positif ici : une ligne
 * `nom,` n'y est pas du TypeScript valide.
 */
function proprietes(bloc: string): string[] {
  const noms: string[] = [];
  let profondeur = 0;
  for (const ligne of bloc.split("\n")) {
    if (profondeur === 0) {
      const m = /^\s*([A-Za-z_$][\w$]*)\s*\??\s*:/.exec(ligne);
      if (m?.[1] !== undefined) noms.push(m[1]);
      const abrege = /^\s*([A-Za-z_$][\w$]*)\s*,\s*$/.exec(ligne);
      if (abrege?.[1] !== undefined) noms.push(abrege[1]);
    }
    profondeur += (ligne.match(/[{[(]/g) ?? []).length;
    profondeur -= (ligne.match(/[}\])]/g) ?? []).length;
    if (profondeur < 0) profondeur = 0;
  }
  return noms;
}

/**
 * Les champs de la revue que le prédicat de couverture lit — dérivés de
 * l'interface, jamais recopiés.
 */
function champsLusParLePredicat(): string[] {
  const bloc = blocApres(lire(SOURCE_PREDICAT), "interface RevueAnnuelleLue");
  expect(
    bloc,
    `🔴 L'interface « RevueAnnuelleLue » est introuvable dans ${SOURCE_PREDICAT}.\n` +
      "   Cette garde DÉRIVE d'elle la liste des champs à rendre saisissables.\n" +
      "   Sans elle, la garde deviendrait verte par vacuité : elle ne vérifierait plus rien.",
  ).not.toBeNull();

  return proprietes(bloc as string).filter((c) => !NON_REPARABLE.has(c));
}

describe("off.32 ⭐ — l'écran sait écrire tout ce que le refus reproche", () => {
  const champs = champsLusParLePredicat();

  it("la liste des champs dérivée du prédicat n'est pas vide", () => {
    // Sans ce test, une extraction cassée rendrait `[]`, tous les `it.each`
    // ci-dessous disparaîtraient, et la suite serait verte sans rien mesurer.
    expect(
      champs.length,
      `🔴 Aucun champ réparable extrait de « RevueAnnuelleLue » (${SOURCE_PREDICAT}).\n` +
        "   L'extraction est cassée : les vérifications suivantes ne portent sur rien.",
    ).toBeGreaterThan(0);
  });

  it.each(champs)("le panneau d'édition ENVOIE « %s » à la Server Action", (champ) => {
    const payload = blocApres(lire(ECRAN), "updateAction(");
    expect(payload, `🔴 Aucun appel « updateAction({ … }) » trouvé dans ${ECRAN}.`).not.toBeNull();

    expect(
      proprietes(payload as string),
      `🔴 Le panneau d'édition n'envoie pas « ${champ} » à updateRevueDirectionAction.\n` +
        `   ${ECRAN}\n` +
        "\n" +
        `   « ${champ} » est lu par evaluerCouvertureOff32 : il peut donc apparaître dans\n` +
        "   le message de REFUS de validation. L'action retombant sur la valeur stockée\n" +
        "   pour tout champ non envoyé, l'opérateur se voit reprocher un manque qu'aucun\n" +
        "   écran ne sait corriger — et off.32 ⭐ (NC majeure) devient impossible à verdir\n" +
        "   depuis la console. Mesuré en production le 2026-08-23 sur « participants ».",
    ).toContain(champ);
  });

  it.each(champs)("le panneau d'édition REÇOIT « %s » dans ses props", (champ) => {
    const bloc = blocApres(lire(ECRAN), "interface RevueDirectionRowActionsProps");
    expect(
      bloc,
      `🔴 L'interface « RevueDirectionRowActionsProps » est introuvable dans ${ECRAN}.`,
    ).not.toBeNull();
    const revue = blocApres(bloc as string, "revue");
    expect(revue, `🔴 La prop « revue » est introuvable dans ${ECRAN}.`).not.toBeNull();

    expect(
      proprietes(revue as string),
      `🔴 Le panneau d'édition ne reçoit pas « ${champ} » : il ne peut donc ni l'afficher,\n` +
        "   ni le renvoyer. Un champ qu'on n'a pas sous les yeux ne se corrige pas.",
    ).toContain(champ);
  });

  it.each(champs)("la page TRANSMET « %s » au panneau d'édition", (champ) => {
    const monte = blocApres(lire(PAGE), "revue={");
    expect(
      monte,
      `🔴 Le montage « <RevueDirectionRowActions revue={{ … }} /> » est introuvable dans ${PAGE}.`,
    ).not.toBeNull();

    expect(
      proprietes(monte as string),
      `🔴 La page ne transmet pas « ${champ} » au panneau d'édition.\n` +
        `   ${PAGE}\n` +
        "   Le champ est déclaré dans les props mais jamais alimenté : l'écran afficherait\n" +
        "   un champ vide et écraserait la donnée en base au premier enregistrement.",
    ).toContain(champ);
  });
});
