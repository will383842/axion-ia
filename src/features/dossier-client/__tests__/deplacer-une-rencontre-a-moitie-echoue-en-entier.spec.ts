// @vitest-environment node
/**
 * ⛔ Déplacer une rencontre rangée chez le mauvais client : la rencontre, ses
 * faits et ses participants changent de fiche ENSEMBLE, ou rien ne change.
 * Si l'écriture casse au milieu (ici : le journal du DEUXIÈME fait), tout est
 * annulé — pas une rencontre chez B avec des faits restés chez A.
 *
 * Mutation qui fait rougir : sortir les écritures des faits de la
 * transaction (appels sur `db` au lieu de `tx`) → le premier fait reste
 * déplacé après l'échec.
 * Contre-témoin : sans panne, tout arrive chez la nouvelle fiche, le lien
 * vers une personne de l'ancienne fiche est retiré, et c'est journalisé.
 * Angle mort : la preuve sur une vraie base (clés composées, trigger
 * différé) est Gate D ; ici la transaction de la base en mémoire.
 */

import { describe, expect, it } from "vitest";

import { deplacerRencontre } from "../deplacer";
import { dossierEnMemoire, fiche, id } from "./_dossier-en-memoire";

const ADMIN = "00000000-0000-4000-8000-0000000000ad";

function scene() {
  const a = fiche({ raisonSociale: "Fiche A" });
  const b = fiche({ raisonSociale: "Fiche B" });
  const rencontreId = id(5);
  const fait = (n: number) => ({
    id: id(6),
    clientId: a["id"],
    portee: "entreprise",
    projetId: null,
    type: "activite",
    cle: `global${n}`,
    enonce: "",
    rencontreId,
    statut: "valide",
    contactSujetId: id(7),
  });
  const base = dossierEnMemoire({
    client: [a, b],
    rencontre: [
      {
        id: rencontreId,
        source: "calendly",
        type: "visio",
        titre: "t",
        clientId: a["id"],
        rattachementStatut: "valide",
        calendlyEventId: null,
        estTestInterne: false,
      },
    ],
    fait: [fait(1), fait(2)],
    rencontreParticipant: [
      {
        id: id(8),
        rencontreId,
        role: "client",
        clientId: a["id"],
        contactId: id(7),
        emailHash: "h",
      },
    ],
  });
  return { base, a, b, rencontreId };
}

describe("⛔ déplacer une rencontre à moitié échoue en entier", () => {
  it("une panne au deuxième fait : rien n'a bougé", async () => {
    const { base, a, b, rencontreId } = scene();
    const client = base.client as unknown as Record<string, unknown>;
    let journaux = 0;
    const panne = new Proxy(client, {
      get(c, nom: string) {
        if (nom !== "$transaction") return c[nom];
        return (fn: (tx: unknown) => Promise<unknown>) =>
          (c["$transaction"] as (f: (tx: unknown) => Promise<unknown>) => Promise<unknown>)((tx) =>
            fn(
              new Proxy(tx as Record<string, unknown>, {
                get(t, m: string) {
                  if (m !== "faitEvenement") return t[m];
                  return {
                    create: async (arg: unknown) => {
                      journaux += 1;
                      if (journaux === 2) throw new Error("panne au milieu");
                      return (t[m] as { create: (a: unknown) => Promise<unknown> }).create(arg);
                    },
                  };
                },
              }),
            ),
          );
      },
    });

    await expect(
      deplacerRencontre(panne as never, {
        rencontreId,
        versClientId: b["id"] as string,
        parAdminId: ADMIN,
      }),
    ).rejects.toThrow(/panne au milieu/);
    expect(base.tables["rencontre"]?.[0]?.["clientId"]).toBe(a["id"]);
    expect(base.tables["fait"]?.every((f) => f["clientId"] === a["id"])).toBe(true);
    expect(base.tables["rencontreParticipant"]?.[0]?.["clientId"]).toBe(a["id"]);
    expect(base.tables["faitEvenement"] ?? []).toHaveLength(0);
  });

  it("contre-témoin : sans panne, tout arrive chez la nouvelle fiche", async () => {
    const { base, b, rencontreId } = scene();
    const r = await deplacerRencontre(base.client as never, {
      rencontreId,
      versClientId: b["id"] as string,
      parAdminId: ADMIN,
    });
    expect(r.faits).toBe(2);
    expect(base.tables["rencontre"]?.[0]?.["clientId"]).toBe(b["id"]);
    expect(
      base.tables["fait"]?.every((f) => f["clientId"] === b["id"] && f["contactSujetId"] === null),
    ).toBe(true);
    expect(base.tables["rencontreParticipant"]?.[0]?.["contactId"]).toBeNull();
    expect(base.tables["rencontreRattachementEvenement"]?.map((e) => e["action"])).toEqual([
      "deplace",
    ]);
  });

  it("des faits de projet sans projet d'arrivée : refus nommé", async () => {
    const { base, b, rencontreId } = scene();
    const f0 = base.tables["fait"]?.[0] as Record<string, unknown>;
    f0["portee"] = "projet";
    f0["projetId"] = id(9);
    await expect(
      deplacerRencontre(base.client as never, {
        rencontreId,
        versClientId: b["id"] as string,
        parAdminId: ADMIN,
      }),
    ).rejects.toThrow(/projet d'arrivée/);
  });
});
