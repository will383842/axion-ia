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

import { sessionsSansRappelJ7, AVANCE_MINIMALE_HEURES } from "./rappel-j7-manquant";

const MAINTENANT = new Date("2026-09-13T09:00:00.000Z");

/** Fabrique une session dont l'avance (en heures) est choisie explicitement. */
function session(numero: string, avanceHeures: number, debut = "2026-09-05T07:00:00.000Z") {
  const dateDebut = new Date(debut);
  return {
    id: `id-${numero}`,
    numero,
    titreSession: "IA pour bien commencer",
    dateDebut,
    createdAt: new Date(dateDebut.getTime() - avanceHeures * 60 * 60 * 1000),
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

  it("la borne est STRICTE : exactement 24 h ne suffisait pas", async () => {
    // À 24 h pile, la convocation atteint tout juste son seuil au moment où la
    // session commence : l'envoyeur n'a aucun passage pour tirer.
    findMany.mockResolvedValue([session("PILE", AVANCE_MINIMALE_HEURES)]);
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
 * 🔑 LA BORNE N'EST PAS À MOI — elle est celle de l'ENVOYEUR, relue depuis le
 * lecteur.
 *
 * `AVANCE_MINIMALE_HEURES` vaut 24 parce que
 * `qualiopi-formation-crons-worker.ts` refuse de rappeler tant que la
 * convocation de chaque inscrit n'a pas 24 h (`seuilConvocation24h`, correctif
 * S5). Le jour où l'envoyeur change ce seuil, ma borne devient fausse — et
 * silencieusement : la règle continuerait de rendre des listes plausibles.
 *
 * Ce témoin NOMME les deux fichiers et la valeur. Il ne mesure pas un seuil,
 * il mesure un ACCORD entre deux endroits.
 */
describe("le seuil de 24 h reste celui de l'envoyeur", () => {
  it("l'envoyeur exige toujours 24 h de convocation, et notre borne l'égale", () => {
    const worker = readFileSync(
      join(process.cwd(), "src/server/queue/workers/qualiopi-formation-crons-worker.ts"),
      "utf8",
    );
    const ligne = worker
      .split(String.fromCharCode(10))
      .find((l) => l.includes("seuilConvocation24h") && l.includes("now.getTime()"));
    expect(
      ligne,
      "`seuilConvocation24h` a disparu ou changé de forme dans l'envoyeur. " +
        "La borne d'impossibilité du rappel J-7 en dérive : relire les deux ensemble.",
    ).toBeDefined();
    // Normalisé : Prettier peut reformater, la valeur ne doit pas bouger sans qu'on le sache.
    const heuresEnvoyeur = /(\d+)\s*\*\s*60\s*\*\s*60\s*\*\s*1000/.exec(
      (ligne ?? "").replace(/\s+/g, " "),
    )?.[1];
    expect(
      Number(heuresEnvoyeur),
      "l'envoyeur n'attend plus 24 h avant de rappeler : `AVANCE_MINIMALE_HEURES` " +
        "doit suivre, sinon la règle écarterait les mauvaises sessions.",
    ).toBe(AVANCE_MINIMALE_HEURES);
  });
});
