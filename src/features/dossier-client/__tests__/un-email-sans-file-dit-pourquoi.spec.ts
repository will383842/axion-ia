/**
 * Un e-mail de suivi SANS `email_outbox` dit POURQUOI (PR 7).
 *
 * Le même `null` couvre trois cas : la demande que l'étape rédige (« en
 * préparation »), une rédaction en échec définitif (« rédaction échouée » —
 * rien ne partira, utilisez le modèle fixe), et un e-mail sorti de la file
 * (purge de rétention ou effacement RGPD, `onDelete: SetNull` : « retiré de
 * la file »). Les afficher tous « en préparation » faisait attendre Will pour
 * un e-mail qui ne viendra jamais.
 *
 * Mutation qui rougit : rendre « en_preparation » pour tout `null` (l'échec
 * et la purge se lisent « en préparation ») ; ou ignorer l'ordre (une vieille
 * ligne purgée se lit « en préparation » pendant qu'une nouvelle demande
 * tourne).
 * Contre-témoin : une ligne avec `email_outbox` garde l'état de la file.
 */

import { describe, expect, it } from "vitest";

import { etatsDesEmailsSuivi } from "../etat-email-suivi";

const le = (h: number) => new Date(Date.UTC(2026, 9, 6, h));

describe("un e-mail sans file dit pourquoi", () => {
  it("la demande que l'étape rédige est « en préparation »", () => {
    expect(etatsDesEmailsSuivi([{ statut: null, creeLe: le(9) }], "en_cours")).toEqual([
      "en_preparation",
    ]);
    expect(etatsDesEmailsSuivi([{ statut: null, creeLe: le(9) }], "a_faire")).toEqual([
      "en_preparation",
    ]);
  });

  it("une rédaction en échec définitif n'est pas « en préparation »", () => {
    expect(etatsDesEmailsSuivi([{ statut: null, creeLe: le(9) }], "echec_definitif")).toEqual([
      "redaction_echouee",
    ]);
  });

  it("un e-mail purgé de la file (étape réussie) est « retiré de la file »", () => {
    expect(etatsDesEmailsSuivi([{ statut: null, creeLe: le(9) }], "reussie")).toEqual([
      "retire_de_la_file",
    ]);
    expect(etatsDesEmailsSuivi([{ statut: null, creeLe: le(9) }], null)).toEqual([
      "retire_de_la_file",
    ]);
  });

  it("une vieille ligne purgée reste « retirée » pendant qu'une nouvelle demande tourne", () => {
    const etats = etatsDesEmailsSuivi(
      [
        { statut: null, creeLe: le(12) },
        { statut: "envoye", creeLe: le(10) },
        { statut: null, creeLe: le(8) },
      ],
      "en_cours",
    );
    expect(etats).toEqual(["en_preparation", "envoye", "retire_de_la_file"]);
  });

  it("contre-témoin : une ligne avec e-mail garde l'état de la file", () => {
    expect(
      etatsDesEmailsSuivi(
        [
          { statut: "a_valider", creeLe: le(9) },
          { statut: "refuse", creeLe: le(8) },
        ],
        "echec_definitif",
      ),
    ).toEqual(["a_valider", "refuse"]);
  });
});
