// @vitest-environment node
/**
 * « Défaire » REFUSE, en le disant, les cinq liens que la base refuserait au
 * COMMIT (vérification V1, V1-04) — un cas par test :
 *
 *   (a) un rendez-vous rendu, rangé depuis dans un projet de la fiche restée ;
 *   (b) une personne de la fiche restée ajoutée à un rendez-vous rendu ;
 *   (c) une personne de la fiche restée avec un rôle dans un projet rendu ;
 *   (d) un fait d'un rendez-vous de la fiche restée rangé dans un projet rendu ;
 *   (e) un fait rendu dont la personne (sujet ou locuteur) est de la fiche restée.
 *
 * Avant : ces cinq cas passaient les contrôles, puis la transaction échouait
 * au COMMIT (clés « même client », trigger AXV03) et Will lisait le message
 * brut de Postgres. Dernier filet : une violation 23503 / AXV03 venue de la
 * base devient un refus motivé.
 *
 * Mutation qui rougit : retirer un des contrôles (a) à (e) de `defaireFusion`
 * (son test ne voit plus de refus) ; retirer `traduireRefusDeLaBase` (le
 * dernier test voit le message SQL).
 * Contre-témoin : `defaire-refuse-si-un-element-a-servi-depuis-sur-l-absorbante.spec.ts`
 * (sans lien nouveau, « Défaire » passe).
 */

import { describe, expect, it } from "vitest";

import { defaireFusion, ErreurDefaireFusion } from "../defaire-fusion";
import { fusionnerFiches } from "../fusionner";
import type { Ligne } from "./_prisma-en-memoire";
import { id } from "./_dossier-en-memoire";
import { ADMIN, MOTIF, sceneFusion } from "./_scene-fusion";

const MOTIF_DEFAIRE = "Erreur de fusion, fiches à séparer.";

type Scene = ReturnType<typeof sceneFusion>;

/** Fusionne, puis ajoute sur la fiche restée ce que `apres` y pose. */
async function fusionPuis(apres: (s: Scene, t: Record<string, Ligne[]>) => void) {
  const s = sceneFusion();
  const r = await fusionnerFiches(s.base.client as never, {
    absorbeeId: s.absorbeeId,
    absorbanteId: s.absorbanteId,
    motif: MOTIF,
    reporterSiren: false,
    parAdminId: ADMIN,
  });
  apres(s, s.base.tables);
  const e = await defaireFusion(s.base.client as never, {
    fusionId: r.fusionId,
    motif: MOTIF_DEFAIRE,
    parAdminId: ADMIN,
  }).catch((x: unknown) => x);
  return { s, e };
}

/** Une personne créée sur la fiche restée après la fusion. */
function personneRestee(s: Scene, t: Record<string, Ligne[]>): string {
  const c = id(7);
  t["clientContact"]?.push({ id: c, clientId: s.absorbanteId, nom: "Dominique", statut: "actif" });
  return c;
}

function attendreRefus(x: { s: Scene; e: unknown }, motif: RegExp) {
  expect(x.e).toBeInstanceOf(ErreurDefaireFusion);
  expect((x.e as ErreurDefaireFusion).liens.join(" ; ")).toMatch(motif);
  expect(x.s.base.tables["clientFusion"]?.[0]?.["defaiteLe"]).toBeNull();
}

describe("⛔ « Défaire » refuse chaque lien vers la fiche restée, en le disant", () => {
  it("(a) un rendez-vous rendu rangé dans un projet de la fiche restée", async () => {
    const x = await fusionPuis((s, t) => {
      const p = id(8);
      t["projet"]?.push({
        id: p,
        clientId: s.absorbanteId,
        numero: "AXI-PRJ-2026-009",
        titre: "Audit",
      });
      const rdv = t["rencontre"]?.find((l) => l["id"] === s.rencontreId);
      if (rdv) rdv["projetId"] = p;
    });
    attendreRefus(x, /rendez-vous à rendre a été rangé dans un projet de la fiche restée/);
  });

  it("(b) une personne de la fiche restée ajoutée à un rendez-vous rendu", async () => {
    const x = await fusionPuis((s, t) => {
      const c = personneRestee(s, t);
      t["rencontreParticipant"]?.push({
        id: id(9),
        rencontreId: s.rencontreId,
        role: "client",
        clientId: s.absorbanteId,
        contactId: c,
      });
    });
    attendreRefus(x, /personne de la fiche restée participe à un rendez-vous à rendre/);
  });

  it("(c) une personne de la fiche restée a un rôle dans un projet rendu", async () => {
    const x = await fusionPuis((s, t) => {
      const c = personneRestee(s, t);
      (t["projetContact"] ??= []).push({
        projetId: s.projetId,
        contactId: c,
        clientId: s.absorbanteId,
        role: "decideur",
      });
    });
    attendreRefus(x, /personne de la fiche restée a un rôle dans un projet à rendre/);
  });

  it("(d) un fait d'un rendez-vous de la fiche restée rangé dans un projet rendu", async () => {
    const x = await fusionPuis((s, t) => {
      const rdv = id(5);
      t["rencontre"]?.push({
        id: rdv,
        source: "saisie_manuelle",
        type: "visio",
        titre: "Après",
        clientId: s.absorbanteId,
        rattachementStatut: "valide",
        estTestInterne: false,
      });
      t["fait"]?.push({
        id: id(6),
        clientId: s.absorbanteId,
        portee: "projet",
        projetId: s.projetId,
        type: "besoin",
        cle: "auditer",
        enonce: "",
        rencontreId: rdv,
        statut: "valide",
      });
    });
    attendreRefus(
      x,
      /fait d'un rendez-vous de la fiche restée a été rangé dans un projet à rendre/,
    );
  });

  it("(e) un fait rendu dont la personne est de la fiche restée", async () => {
    const x = await fusionPuis((s, t) => {
      const c = personneRestee(s, t);
      const f = t["fait"]?.find((l) => l["id"] === s.faitId);
      if (f) f["contactSujetId"] = c;
    });
    attendreRefus(x, /fait à rendre cite une personne de la fiche restée/);
  });

  it("dernier filet : une violation de clé venue de la base devient un refus motivé", async () => {
    const violation = Object.assign(
      new Error(
        'insert or update on table "rencontres" violates foreign key constraint "rencontres_projet_meme_client"',
      ),
      { code: "P2003" },
    );
    const db = {
      $transaction: async () => {
        throw violation;
      },
    };
    const e = await defaireFusion(db as never, {
      fusionId: id(4),
      motif: MOTIF_DEFAIRE,
      parAdminId: ADMIN,
    }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErreurDefaireFusion);
    expect((e as Error).message).not.toMatch(/foreign key|violates/);
    expect((e as Error).message).toMatch(/lien/);
  });
});
