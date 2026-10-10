/** L8d — la liste « Futurs apporteurs » : Zone, Dossier, Dernier échange, Nous a connus par. */
import { describe, expect, it } from "vitest";

import {
  connuPar,
  dernierEchange,
  dossierCourt,
  zoneDeLaFiche,
  ORIGINES_FILTRABLES,
} from "../liste-reseau";
import { motsInterditsApporteur } from "../vocabulaire-apporteur";

const J = (j: number) => new Date(Date.UTC(2026, 9, j, 10));

describe("zone et origine", () => {
  it("la ville et les zones déclarées", () => {
    expect(
      zoneDeLaFiche({
        candidature: { ville: "Grenoble", zones: ["Isère (38)", "Savoie (73)"], zoneMobile: false },
      }),
    ).toBe("Grenoble · Isère (38), Savoie (73)");
    expect(zoneDeLaFiche({ ville: "Lyon" })).toBe("Lyon");
    expect(zoneDeLaFiche(null)).toBeNull();
  });

  it("« Nous a connus par » : la déclaration, sinon la source de l'annonce", () => {
    expect(connuPar({ candidature: { sourceConnaissance: "facebook" } })).toBe(
      "Facebook / Instagram",
    );
    expect(connuPar({ funnel: { utm: { utm_source: "leboncoin" } } })).toBe("Le Bon Coin");
    expect(connuPar({})).toBeNull();
    expect(ORIGINES_FILTRABLES.length).toBeGreaterThan(3);
  });
});

describe("dossier et dernier échange", () => {
  it("le dossier en un mot", () => {
    expect(dossierCourt("dossier-complet")).toBe("Complet");
    expect(dossierCourt("dossier-commence")).toBe("Commencé");
    expect(dossierCourt(null)).toBe("Complet");
  });

  it("le plus récent des faits connus, avec son sens", () => {
    expect(
      dernierEchange({ invitation: J(1), relances: [J(4)], reponse: J(6), envoyeLe: J(3) }),
    ).toEqual({ sens: "recu", libelle: "↙ reçu le 06/10" });
    expect(
      dernierEchange({ invitation: J(1), relances: [J(4)], reponse: null, envoyeLe: J(3) }),
    ).toEqual({
      sens: "envoye",
      libelle: "↗ rappel le 04/10",
    });
    expect(
      dernierEchange({ invitation: null, relances: [], reponse: null, envoyeLe: null }),
    ).toBeNull();
  });

  it("aucun mot de recrutement", () => {
    expect(
      motsInterditsApporteur(
        ["Complet", "Commencé", "Premier contact", "↗ envoyé le 03/10"].join(" "),
      ),
    ).toEqual([]);
  });
});
