/**
 * ⛔ LE BANDEAU DU PRÉAVIS ARRÊTE AVANT LE DÉMARRAGE (PR 5 ; décision de Will
 * du 29/09).
 *
 * Un client actif sous préavis : la liste du jour porte `preavis`. Le panneau
 * affiche « Pas d'enregistrement pour ce client avant le <date> : notes à la
 * main » (ou « pas encore parti » sans date) et désactive « Démarrer ». Si le
 * site refuse quand même un accord (rencontre rangée entre-temps), la capture
 * est détruite.
 *
 * Mutation qui rougit : faire rendre `null` à `bandeauPreavis` → 1er cas ;
 * classer le 409 `client_actif_preavis_en_cours` en `abandonner` → 3e cas.
 * Contre-témoin : une rencontre sans `preavis` n'a pas de bandeau.
 */

import { describe, expect, it } from "vitest";

import { bandeauPreavis } from "../../../extensions/enregistreur-meet/lib/bandeau-preavis.js";
import { classerReponse } from "../../../extensions/enregistreur-meet/lib/file-envoi.js";
import { refusPourPreavis } from "../../../src/server/visio/visio-annonce";

describe("⛔ le bandeau du préavis arrête avant le démarrage", () => {
  it("date connue : « avant le 30/10/2026 : notes à la main »", () => {
    expect(bandeauPreavis({ preavis: { finLe: "2026-10-29T23:00:00.000Z" } })).toBe(
      "Pas d'enregistrement pour ce client avant le 30/10/2026 : notes à la main.",
    );
  });

  it("préavis pas encore parti : le bandeau le dit, sans date, comme le serveur", () => {
    const texte = bandeauPreavis({ preavis: { finLe: null } });
    const serveur = refusPourPreavis({ valide: true, actif: true }, new Date(), null);
    expect(serveur.refuse && serveur.message).toBe(texte);
    expect(texte).toMatch(/pas encore parti/);
  });

  it("un accord refusé pour préavis détruit la capture", () => {
    expect(classerReponse("accord", 409, "client_actif_preavis_en_cours")).toBe("detruire");
    expect(classerReponse("session", 409, "client_actif_preavis_en_cours")).toBe("detruire");
  });

  it("contre-témoin : pas de préavis, pas de bandeau", () => {
    expect(bandeauPreavis({ preavis: null })).toBeNull();
    expect(bandeauPreavis(undefined)).toBeNull();
  });
});
