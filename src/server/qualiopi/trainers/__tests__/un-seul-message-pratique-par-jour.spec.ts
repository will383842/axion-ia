/**
 * 🔴 DEUX MESSAGES IDENTIQUES LE MÊME JOUR, ET UN RAPPEL QUI SE TROMPE DE JOUR.
 *
 * Deux défauts d'une même famille, trouvés le 2026-09-04 en terminant les
 * « reste Will » du cycle formateur. Ils vivent dans deux fichiers que rien ne
 * reliait, et aucun test ne les voyait.
 *
 * ## 1. Le doublon
 *
 * `formateur-convocation-j7` (quotidien, fenêtre 7,5 j) et `formateur-rappel-j1`
 * (horaire, fenêtre 36 h) sélectionnent indépendamment, sur deux colonnes
 * distinctes, dans deux fenêtres qui se CHEVAUCHENT. Une affectation posée à
 * J-1 tombe dans les deux, et les deux gabarits rendent le même
 * `InfosPratiquesFormateurBloc` : le formateur reçoit deux fois le même contenu
 * dans la journée.
 *
 * Rien ne manque jamais — c'est vérifié plus bas, et c'est ce qui rend le
 * défaut supportable. Ce qui se perd est le crédit de l'expéditeur : le message
 * de la veille au soir, le seul qu'on veut vraiment voir lu, arrive derrière un
 * doublon.
 *
 * ## 2. Le rappel qui dit « demain » alors que c'est après-demain
 *
 * Sa fenêtre est de 36 h, pas de 24 : pour une session le 15 à 09:00, elle
 * s'ouvre le 13 à 21:00. Le gabarit écrivait pourtant « démarre demain » EN DUR.
 * C'est le défaut exact fermé le 2026-09-03 sur la convocation (« DANS UNE
 * SEMAINE » pour une session du lendemain) — laissé ouvert sur son jumeau.
 * Les deux dérivent désormais du MÊME `libelleDelaiConvocation`, ce qui est la
 * seule façon qu'ils ne redivergent pas.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { libelleDelaiConvocation } from "@/lib/email/templates/formateur-convocation-j7";

const CRONS = readFileSync(
  join(process.cwd(), "src/server/queue/workers/qualiopi-formation-crons-worker.ts"),
  "utf8",
);
const RAPPEL = readFileSync(
  join(process.cwd(), "src/lib/email/templates/formateur-rappel-j1.tsx"),
  "utf8",
);
const CONVOCATION = readFileSync(
  join(process.cwd(), "src/lib/email/templates/formateur-convocation-j7.tsx"),
  "utf8",
);

/** Le corps de la sélection, isolé de ses voisines. */
function selection(): string {
  const debut = CRONS.indexOf("async function affectationsAConvoquer");
  expect(debut, "la sélection a disparu").toBeGreaterThan(-1);
  const suivante = CRONS.indexOf("\nasync function ", debut + 20);
  return CRONS.slice(debut, suivante > debut ? suivante : CRONS.length);
}

describe("🔴 un seul message d'infos pratiques par jour", () => {
  it("le RAPPEL se tait si la convocation est partie il y a moins de 24 h", () => {
    const bloc = selection();
    expect(bloc).toContain("DELAI_ANTI_DOUBLON_MS");
    expect(bloc).toContain('trace === "rappelJ1EnvoyeAt"');
    // Le seuil se SOUSTRAIT de `now` : un `+` enverrait le doublon et tairait
    // le rappel légitime, et les deux fautes se compensent à la lecture.
    expect(bloc).toMatch(/now\.getTime\(\)\s*-\s*DELAI_ANTI_DOUBLON_MS/);
    // La convocation jamais partie ne doit PAS bloquer le rappel.
    expect(bloc).toContain("convocationJ7EnvoyeeAt: null");
  });

  it("la CONVOCATION se tait dès que le rappel est parti, sans condition de délai", () => {
    // Le rappel ne part qu'à moins de 36 h du début : une convocation qui
    // suivrait arriverait forcément après lui. Aucun délai ne la rend utile.
    expect(selection()).toContain("{ rappelJ1EnvoyeAt: null }");
  });

  it("le délai anti-doublon vaut 24 h", () => {
    expect(CRONS).toMatch(/const DELAI_ANTI_DOUBLON_MS = 24 \* 60 \* 60 \* 1000;/);
  });

  it("🔴 la règle filtre à la SÉLECTION, elle ne pose pas une trace mensongère", () => {
    // Écrire `rappelJ1EnvoyeAt` sans avoir envoyé de rappel ferait mentir la
    // seule colonne où l'on relit ce que le formateur a reçu — et elle est lue
    // ailleurs, notamment par `session_contact_sur_place_absent`.
    const bloc = selection();
    expect(bloc).not.toMatch(/update|rappelJ1EnvoyeAt:\s*new Date/);
  });
});

describe("🔴 le rappel dit le délai RÉEL, il ne dit plus « demain » en dur", () => {
  it("il dérive du même libellé que la convocation", () => {
    expect(RAPPEL).toContain("libelleDelaiConvocation");
    expect(CONVOCATION).toContain("export function libelleDelaiConvocation");
  });

  it("plus aucun « demain » écrit en dur dans le gabarit", () => {
    // Ni dans l'objet, ni dans le titre, ni dans le corps. Le mot ne peut plus
    // venir que de la fonction partagée.
    expect(RAPPEL).not.toContain("C'est demain");
    expect(RAPPEL).not.toContain("À demain");
    expect(RAPPEL).not.toContain("démarre demain");
    expect(RAPPEL).not.toContain("Tomorrow —");
  });

  it("l'objet et le titre sortent du MÊME appel de délai", () => {
    // Un titre qui contredirait la ligne d'objet ferait douter du reste.
    expect(RAPPEL).toContain("const { prefixeObjet } = libelleDelaiConvocation(p.joursAvantDebut");
    expect(RAPPEL).toContain("const { titre, quand } = libelleDelaiConvocation(p.joursAvantDebut");
  });

  it("🔴 `quand` est utilisable DANS une phrase, aux trois délais qui comptent", () => {
    // C'est le champ que le corps insère : « démarre {quand}, le 15/09 ».
    expect(libelleDelaiConvocation(0, "fr").quand).toBe("aujourd'hui");
    expect(libelleDelaiConvocation(1, "fr").quand).toBe("demain");
    expect(libelleDelaiConvocation(2, "fr").quand).toBe("dans 2 jours");
  });

  it("un délai absent ne fabrique AUCUNE promesse de jour", () => {
    // Une valeur par défaut refabriquerait le défaut qu'on ferme.
    expect(libelleDelaiConvocation(undefined, "fr").quand).toBe("prochainement");
    expect(libelleDelaiConvocation(undefined, "fr").quand).not.toContain("demain");
  });

  it("la phrase ne suppose plus un premier envoi", () => {
    // « une dernière fois » est faux quand le rappel est le SEUL message parti
    // — exactement le cas d'une affectation posée à la dernière minute.
    expect(RAPPEL).not.toContain("une dernière fois");
  });
});

describe("ce qui NE DOIT PAS changer : le rappel reste complet", () => {
  it("il porte le même bloc pratique que la convocation", () => {
    // C'est ce qui rend le doublon supportable et le filtrage sans risque :
    // quel que soit celui des deux messages qui part, rien ne manque.
    expect(RAPPEL).toContain("InfosPratiquesFormateurBloc");
    expect(CONVOCATION).toContain("InfosPratiquesFormateurBloc");
  });
});
