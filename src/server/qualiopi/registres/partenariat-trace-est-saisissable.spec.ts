/**
 * Garde — toute trace d'échange déclarée sur un partenariat doit être
 * SAISISSABLE depuis les deux écrans, et ARRIVER jusqu'à la base.
 *
 * ## Le défaut, mesuré sur la PRODUCTION le 2026-08-24
 *
 * `off.26` (situations de handicap) est un **super-indicateur** : une NC y est
 * majeure. Le moteur le déclare couvert dès qu'un partenariat de type
 * `reseau_handicap` existe et que le référent handicap porte un e-mail.
 *
 * Or le registre ne portait que `nom / type / objet / dates / actif`. `objet`
 * est du texte libre écrit par l'organisme lui-même : une DÉCLARATION, jamais
 * une preuve. Les trois fiches « réseau handicap » de production affirmaient
 * donc un relais mobilisable sans qu'aucune trace d'échange ne vive nulle part
 * — alors que l'échange existait réellement (réponse nominative d'une
 * conseillère RHF, reçue le 04/08/2026). La preuve dormait dans une boîte mail,
 * et a dû être recopiée en prose dans `objet`, faute de champ pour l'accueillir.
 *
 * L'auditeur ne demande pas « avez-vous une ligne dans votre logiciel ». Il
 * demande **qui**, **quand**, et **où est la pièce**.
 *
 * ## Pourquoi cette garde est STATIQUE et DÉRIVÉE
 *
 * L'invariant n'est pas « le champ `interlocuteurNom` existe » — ce serait une
 * garde sur le défaut d'aujourd'hui. L'invariant est architectural :
 *
 *   > tout champ de `TracePartenariatInput` doit être (1) transmis par le
 *   > service, (2) accepté par les DEUX schémas d'action, (3) envoyé par les
 *   > DEUX écrans, et (4) déclaré au schéma Prisma.
 *
 * La liste est donc **dérivée de l'interface**, jamais recopiée. Le jour où un
 * cinquième champ de trace apparaît, cette garde rougit toute seule tant que
 * l'un des cinq maillons l'ignore.
 *
 * Le point (3) est le cœur : ce dépôt a payé quatre fois un prédicat recopié
 * qui diverge, et trois fois une fonctionnalité complète que personne
 * n'appelait — dont deux sur un super-indicateur.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sansCommentaires } from "../revues/sans-commentaires";

const RACINE = process.cwd();

const SERVICE = "src/server/qualiopi/registres/partenariats-service.ts";
const ACTIONS = "src/server/actions/qualiopi/partenariats.ts";
const ECRAN_CREATION = "src/components/admin/qualiopi/PartenariatForm.tsx";
const ECRAN_EDITION = "src/components/admin/qualiopi/PartenariatRowActions.tsx";
const SCHEMA_PRISMA = "prisma/schema.prisma";

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

const sourceService = lire(SERVICE);

/**
 * La liste de référence — DÉRIVÉE de l'interface, jamais écrite à la main.
 * Si l'interface disparaît ou change de nom, le test échoue ici plutôt que de
 * passer sur une liste vide (un `[]` rendrait toutes les assertions triviales).
 */
const CHAMPS_TRACE: string[] = (() => {
  const bloc = blocApres(sourceService, "export interface TracePartenariatInput");
  if (bloc === null) return [];
  return [...bloc.matchAll(/^\s*(\w+)\??\s*:/gm)].map((m) => m[1] as string);
})();

describe("Trace d'échange des partenariats (off.26 ⭐)", () => {
  it("la liste de champs est bien dérivée de l'interface, et non vide", () => {
    // Témoin : sans lui, toutes les assertions ci-dessous passeraient à vide.
    expect(CHAMPS_TRACE.length).toBeGreaterThanOrEqual(3);
    expect(CHAMPS_TRACE).toContain("interlocuteurNom");
  });

  it("le service transmet CHAQUE champ à Prisma, sans en perdre un en route", () => {
    const fragment = blocApres(sourceService, "function fragmentTrace");
    expect(fragment).not.toBeNull();
    const manquants = CHAMPS_TRACE.filter((c) => !(fragment as string).includes(c));
    expect(manquants, `champs absents de fragmentTrace : ${manquants.join(", ")}`).toEqual([]);
  });

  it("le service passe par fragmentTrace à la création ET à la mise à jour", () => {
    // Les deux chemins doivent partager le mapping. S'ils le recopiaient, le
    // premier champ ajouté ne serait câblé que d'un côté — en silence.
    const creation = blocApres(sourceService, "export async function creerPartenariat");
    const maj = blocApres(sourceService, "export async function updatePartenariat");
    expect(creation).toContain("fragmentTrace(input)");
    expect(maj).toContain("fragmentTrace(input)");
  });

  it("les DEUX schémas Zod acceptent chaque champ de trace", () => {
    const source = lire(ACTIONS);
    for (const nom of ["creerPartenariatSchema", "updatePartenariatSchema"]) {
      const bloc = blocApres(source, `const ${nom} = z.object`);
      expect(bloc, `${nom} introuvable`).not.toBeNull();
      const manquants = CHAMPS_TRACE.filter((c) => !(bloc as string).includes(c));
      expect(manquants, `${nom} ignore : ${manquants.join(", ")}`).toEqual([]);
    }
  });

  it("les DEUX écrans envoient chaque champ de trace à leur action", () => {
    const ecrans: Array<[string, string]> = [
      [ECRAN_CREATION, "await creerAction("],
      [ECRAN_EDITION, "await updateAction("],
    ];
    for (const [chemin, ancre] of ecrans) {
      const source = lire(chemin);
      const appel = blocApres(source, ancre);
      expect(appel, `${chemin} : appel « ${ancre} » introuvable`).not.toBeNull();
      const manquants = CHAMPS_TRACE.filter((c) => !(appel as string).includes(c));
      expect(manquants, `${chemin} n'envoie pas : ${manquants.join(", ")}`).toEqual([]);
    }
  });

  it("vider un champ à l'écran EFFACE la valeur — jamais un undefined silencieux", () => {
    // `undefined` laisserait l'ancienne trace en base alors que l'écran affiche
    // un champ vide : la console mentirait sur ce qu'elle montre.
    const edition = blocApres(lire(ECRAN_EDITION), "await updateAction(") as string;
    for (const champ of CHAMPS_TRACE) {
      const ligne = edition.split("\n").find((l) => l.trim().startsWith(`${champ}:`));
      expect(ligne, `${champ} : ligne d'envoi introuvable`).toBeDefined();
      expect(ligne, `${champ} doit envoyer null quand le champ est vide`).toContain("null");
    }
  });

  it("le modèle Prisma déclare chaque champ de trace", () => {
    const bloc = blocApres(lire(SCHEMA_PRISMA), "model Partenariat");
    expect(bloc).not.toBeNull();
    const manquants = CHAMPS_TRACE.filter((c) => !(bloc as string).includes(c));
    expect(manquants, `modèle Partenariat sans : ${manquants.join(", ")}`).toEqual([]);
  });
});
