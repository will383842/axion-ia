// @vitest-environment node

/**
 * CHANTIER QNC, L13 — la logique de preuve des documents de l'organisme.
 *
 * « Remplacée par » et les notes se DÉRIVENT du journal : ces tests disent ce
 * qu'une ligne de journal établit, et ce qu'elle n'établit pas (ligne mal
 * formée, autre table, autre action).
 */

import { describe, expect, it } from "vitest";

import {
  ACTION_DOCUMENT_REMPLACE,
  ACTION_NOTE_PIECE,
  MENTIONS_PIECE,
  horodatageParis,
  notesDepuisJournal,
  remplacementsDepuisJournal,
  separerVersions,
  validerNote,
  type LigneJournal,
} from "../documents-organisme-pur";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

function ligne(p: Partial<LigneJournal>): LigneJournal {
  return {
    id: crypto.randomUUID(),
    action: ACTION_DOCUMENT_REMPLACE,
    targetType: "SocieteDocument",
    targetId: A,
    changes: { nouveauId: B },
    adminUserId: "admin-1",
    createdAt: new Date("2026-10-17T08:00:00Z"),
    ...p,
  };
}

describe("remplacer garde l'ancien : « remplacée par » se lit au journal", () => {
  it("une ligne de remplacement étiquette l'ancienne version, pas la nouvelle", () => {
    const r = remplacementsDepuisJournal([ligne({})], "SocieteDocument");
    expect(r.get(A)).toMatchObject({ ancienId: A, nouveauId: B, parId: "admin-1" });
    expect(r.has(B)).toBe(false);
  });

  it("l'ancienne version ressort dans les remplacées, la nouvelle en vigueur — aucune ne se perd", () => {
    const r = remplacementsDepuisJournal([ligne({})], "SocieteDocument");
    const { enVigueur, remplacees } = separerVersions([{ id: A }, { id: B }, { id: C }], r);
    expect(enVigueur.map((d) => d.id)).toEqual([B, C]);
    expect(remplacees.map((d) => [d.id, d.remplacement.nouveauId])).toEqual([[A, B]]);
  });

  it("une chaîne A → B → C étiquette A et B, laisse C en vigueur", () => {
    const r = remplacementsDepuisJournal(
      [
        ligne({}),
        ligne({
          targetId: B,
          changes: { nouveauId: C },
          createdAt: new Date("2026-10-18T08:00:00Z"),
        }),
      ],
      "SocieteDocument",
    );
    const { enVigueur } = separerVersions([{ id: A }, { id: B }, { id: C }], r);
    expect(enVigueur.map((d) => d.id)).toEqual([C]);
  });

  it("deux remplacements de la même version : le PREMIER fait foi", () => {
    const r = remplacementsDepuisJournal(
      [
        ligne({ changes: { nouveauId: C }, createdAt: new Date("2026-10-18T08:00:00Z") }),
        ligne({ changes: { nouveauId: B }, createdAt: new Date("2026-10-17T08:00:00Z") }),
      ],
      "SocieteDocument",
    );
    expect(r.get(A)?.nouveauId).toBe(B);
  });

  it("une ligne d'une autre table, d'une autre action ou mal formée n'étiquette rien", () => {
    const r = remplacementsDepuisJournal(
      [
        ligne({ targetType: "ConsoleDocument" }),
        ligne({ action: "societe.document.modifie" }),
        ligne({ changes: { nouveauId: "pas-un-uuid" } }),
        ligne({ changes: null }),
        ligne({ changes: { nouveauId: A } }),
        ligne({ targetId: null }),
      ],
      "SocieteDocument",
    );
    expect(r.size).toBe(0);
  });
});

describe("notes sur une pièce : ajout seul, datées par le serveur", () => {
  function note(p: Partial<LigneJournal>): LigneJournal {
    return ligne({
      action: ACTION_NOTE_PIECE,
      targetType: "DocumentGenere",
      targetId: A,
      changes: { mention: "piece_vierge", texte: "Numéro 034 consommé à vide.", auteurNom: "Will" },
      ...p,
    });
  }

  it("les notes d'une pièce sortent dans l'ordre où elles ont été écrites, avec date et auteur", () => {
    const n = notesDepuisJournal([
      note({
        createdAt: new Date("2026-10-17T10:00:00Z"),
        changes: { mention: "note", texte: "Seconde note, plus tard.", auteurNom: "Will" },
      }),
      note({ createdAt: new Date("2026-10-17T09:00:00Z") }),
    ]);
    expect(n.get(A)?.map((x) => x.mention)).toEqual(["piece_vierge", "note"]);
    expect(n.get(A)?.[0]).toMatchObject({
      auteurNom: "Will",
      le: new Date("2026-10-17T09:00:00Z"),
    });
  });

  it("une note sans auteur ou à mention inconnue n'est pas affichée comme une note", () => {
    const n = notesDepuisJournal([
      note({ changes: { mention: "piece_vierge", texte: "Sans auteur, illisible." } }),
      note({ changes: { mention: "inconnue", texte: "Mention inconnue ici.", auteurNom: "Will" } }),
      note({ targetType: "SocieteDocument" }),
    ]);
    expect(n.size).toBe(0);
  });

  it("la note se valide sans date ni auteur venus du navigateur", () => {
    expect(
      validerNote({ mention: "ne_pas_envoyer", texte: "  Ne pas transmettre au client.  " }),
    ).toEqual({
      ok: true,
      mention: "ne_pas_envoyer",
      texte: "Ne pas transmettre au client.",
    });
    expect(validerNote({ mention: "ne_pas_envoyer", texte: "court" }).ok).toBe(false);
    expect(validerNote({ mention: "autre-chose", texte: "Texte assez long ici." }).ok).toBe(false);
    expect(validerNote({ mention: "note", texte: "x".repeat(2001) }).ok).toBe(false);
  });

  it("les quatre cas de l'audit du 16/10 ont chacun leur mention", () => {
    const cles = MENTIONS_PIECE.map((m) => m.key);
    for (const k of [
      "ne_pas_envoyer",
      "etablie_hors_delai",
      "piece_vierge",
      "piece_rectificative",
    ]) {
      expect(cles).toContain(k);
    }
  });

  it("l'horodatage est à l'heure de Paris (UTC+2 en octobre)", () => {
    expect(horodatageParis(new Date("2026-10-16T22:30:00Z"))).toBe("le 17/10/2026 à 00:30");
  });
});
