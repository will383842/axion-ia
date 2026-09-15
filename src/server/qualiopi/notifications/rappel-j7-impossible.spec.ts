/**
 * 🔴 UNE ALERTE NE DOIT PAS EXIGER UN GESTE QUI ÉTAIT IMPOSSIBLE.
 *
 * `rappel_j7_non_envoye` ne lisait que « la trace est nulle et la session a
 * commencé ». Elle ne demandait jamais si le rappel POUVAIT partir.
 *
 * Mesuré en production le 2026-09-13 : `AXI-SESS-2026-001`, créée le 04/09 à
 * 16:30 pour un début le 05/09 à 07:00 — **14,5 heures d'avance**. L'envoyeur
 * refuse de rappeler tant que la convocation n'a pas 24 h ; la session entière
 * tenait sous ce seuil. L'alerte demandait de consigner un écart pour un envoi
 * que rien ne pouvait produire.
 *
 * ## Ce que ce fichier garde, et pourquoi DEUX sens
 *
 * Un témoin négatif seul ne prouve rien : « plus de faux positif » se lit aussi
 * bien « corrigé » que « je ne mesure plus rien ». Une borne trop large
 * ÉTEINDRAIT la règle, et personne ne le verrait — elle rendrait simplement
 * zéro, ce qui ressemble à « rien à signaler ».
 *
 * D'où le témoin POSITIF, qui est le plus important des deux.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { trainingSession: { findMany: (...a: unknown[]) => findMany(...a) } },
}));
vi.mock("@/server/qualiopi/inscriptions/inscriptions-actives", () => ({
  inscriptionsActives: () => ({ statut: "inscrit" }),
}));

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { sessionsSansRappelJ7 } from "./rappel-j7-manquant";
import {
  DELAI_APRES_CONVOCATION_MS,
  PLAFOND_CONVOCATION_MS,
  PLAFOND_RAPPEL_J7_MS,
} from "./rappel-j7-possible";

const MAINTENANT = new Date("2026-09-13T09:00:00.000Z");

/**
 * Fabrique une session dont l'avance (en heures) est choisie explicitement.
 *
 * 2026-09-15 : l'unique inscrit porte la convocation qu'aurait posée le cron
 * horaire (l'heure pile suivant la création, pas avant J-5,5). La règle ne lit
 * plus une avance : elle rejoue les passages de l'envoyeur sur ces dates.
 */
function session(numero: string, avanceHeures: number, debut = "2026-09-05T07:00:00.000Z") {
  const dateDebut = new Date(debut);
  const createdAt = new Date(dateDebut.getTime() - avanceHeures * 60 * 60 * 1000);
  const HEURE = 60 * 60 * 1000;
  const plancher = Math.max(createdAt.getTime(), dateDebut.getTime() - 5.5 * 24 * HEURE);
  return {
    id: `id-${numero}`,
    numero,
    titreSession: "IA pour bien commencer",
    dateDebut,
    createdAt,
    enrollments: [
      {
        createdAt,
        convocationEnvoyeeAt: new Date(Math.floor(plancher / HEURE) * HEURE + HEURE + 5_000),
      },
    ],
  };
}

beforeEach(() => {
  findMany.mockReset();
});

describe("sessionsSansRappelJ7 — le rappel devait être possible", () => {
  it("N'ALERTE PAS sur le cas réel : 14,5 h d'avance, rappel impossible", async () => {
    // Les chiffres viennent de la production, pas d'une intuition.
    findMany.mockResolvedValue([session("AXI-SESS-2026-001", 14.5)]);
    await expect(sessionsSansRappelJ7(MAINTENANT)).resolves.toEqual([]);
  });

  it("🔑 ALERTE TOUJOURS quand le rappel était possible — 30 jours d'avance", async () => {
    // LE TÉMOIN QUI COMPTE. Sans lui, une borne trop large éteindrait la règle
    // en rendant zéro, et « zéro » se lit « rien à signaler ».
    findMany.mockResolvedValue([session("AXI-SESS-2026-042", 24 * 30)]);
    const r = await sessionsSansRappelJ7(MAINTENANT);
    expect(r).toHaveLength(1);
    expect(r[0]?.numero).toBe("AXI-SESS-2026-042");
  });

  it("discrimine dans un même lot, au lieu de tout garder ou tout jeter", async () => {
    // Une borne qui laisse passer les deux, ou qui coupe les deux, passerait
    // chacun des tests précédents pris séparément.
    findMany.mockResolvedValue([session("IMPOSSIBLE", 14.5), session("POSSIBLE", 24 * 10)]);
    const r = await sessionsSansRappelJ7(MAINTENANT);
    expect(r.map((s) => s.numero)).toEqual(["POSSIBLE"]);
  });

  it("exactement 24 h ne suffit pas", async () => {
    // À 24 h pile, la convocation atteint tout juste son seuil au moment où la
    // session commence : l'envoyeur n'a aucun passage pour tirer.
    findMany.mockResolvedValue([session("PILE", 24)]);
    await expect(sessionsSansRappelJ7(MAINTENANT)).resolves.toEqual([]);
  });

  it("ne rend jamais `createdAt` — il sert au filtre, pas à l'affichage", async () => {
    findMany.mockResolvedValue([session("AXI-SESS-2026-042", 24 * 30)]);
    const r = await sessionsSansRappelJ7(MAINTENANT);
    expect(r[0]).not.toHaveProperty("createdAt");
  });

  it("demande bien `createdAt` à la base — sinon le filtre mesurerait `undefined`", async () => {
    // Un filtre sur un champ non sélectionné ne rougit pas : il rend NaN, donc
    // `false`, donc une liste vide qui ressemble à « rien à signaler ».
    findMany.mockResolvedValue([]);
    await sessionsSansRappelJ7(MAINTENANT);
    expect(findMany.mock.calls[0]?.[0]?.select?.createdAt).toBe(true);
  });
});

/**
 * 🔑 LES BORNES NE SONT PAS À MOI — elles sont celles des CRONS, relues depuis
 * le lecteur.
 *
 * L'envoyeur du rappel lit `rappelJ7EnvoyableA` et `PLAFOND_RAPPEL_J7_MS` : le
 * témoin vérifie qu'il n'a pas recopié ses propres bornes à côté. Le cron de
 * convocation, lui, garde son plafond de 5,5 jours en ligne — la règle en
 * dérive la première convocation possible d'un inscrit jamais convoqué, donc le
 * témoin relit la valeur et nomme les deux fichiers.
 */
describe("les bornes restent celles des crons", () => {
  const worker = readFileSync(
    join(process.cwd(), "src/server/queue/workers/qualiopi-formation-crons-worker.ts"),
    "utf8",
  );
  const corps = (nom: string) => {
    const debut = worker.indexOf(`async function ${nom}(`);
    expect(debut, `\`${nom}\` a disparu du worker`).toBeGreaterThan(-1);
    const fin = worker.indexOf(String.fromCharCode(10) + "async function ", debut + 1);
    return worker.slice(debut, fin === -1 ? undefined : fin).replace(/\s+/g, " ");
  };

  it("l'envoyeur décide par le prédicat partagé, sans seuil recopié", () => {
    const rappel = corps("handleRappelJ7");
    expect(rappel).toContain("rappelJ7EnvoyableA(now,");
    expect(rappel).toContain("now.getTime() + PLAFOND_RAPPEL_J7_MS");
    expect(
      /24 \* 60 \* 60 \* 1000|7\.5 \* 24/.test(rappel),
      "l'envoyeur a de nouveau un seuil en ligne : la règle d'alerte ne le lirait pas.",
    ).toBe(false);
    expect(DELAI_APRES_CONVOCATION_MS).toBe(24 * 60 * 60 * 1000);
    expect(PLAFOND_RAPPEL_J7_MS).toBe(7.5 * 24 * 60 * 60 * 1000);
  });

  it("le cron de convocation convoque toujours à 5,5 j au plus tôt", () => {
    const heures = /now\.getTime\(\) \+ ([\d.]+) \* 24 \* 60 \* 60 \* 1000/.exec(
      corps("handleConvocationJ5"),
    )?.[1];
    expect(
      Number(heures) * 24 * 60 * 60 * 1000,
      "le plafond de `handleConvocationJ5` a changé : `PLAFOND_CONVOCATION_MS` " +
        "(rappel-j7-possible.ts) doit suivre.",
    ).toBe(PLAFOND_CONVOCATION_MS);
  });
});
